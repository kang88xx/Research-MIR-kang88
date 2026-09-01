import Spinner from "@/components/Spinner";

// 스파크라인 — 선 + 하단 그라디언트 영역채움(파이낸스 표준 문법).
// 영역은 선 색을 그대로 받아 상단 22% → 하단 0%로 사라지므로 등락 색(레드/블루)이
// 카드 전체 톤으로 확장되고, 다크 모드에서도 CSS 변수 그대로 따라간다.
// 그라디언트 id는 stroke 값에서 파생 — 같은 색이면 같은 정의를 공유하므로
// 서버/클라이언트 렌더가 항상 일치하고(하이드레이션 안전) 중복도 무해하다.
function fillId(stroke: string) {
  return `sparkfill-${stroke.replace(/[^a-zA-Z0-9]/g, "")}`;
}

export default function Sparkline({
  values,
  width = 280,
  height = 56,
  stroke = "#636DDB",
  baseline,
  accentRing,
  pulse,
  area = true,
  guides = false,
}: {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
  baseline?: number; // 기준선 (예: 김프 0%)
  accentRing?: string; // 끝점 강조 링 색 (예: 앰버)
  pulse?: boolean; // 끝점 진행중 펄스 모션 (장중일 때만 true)
  area?: boolean; // 하단 그라디언트 영역채움 (기본 on)
  guides?: boolean; // 상·하단 점선 가이드 (큰 차트에서만)
}) {
  if (values.length < 2) {
    // 자리가 좁아(76×26) 텍스트 대신 브랜드 로더만 — 의미는 title로 보존
    return (
      <div
        className="flex items-center justify-center"
        style={{ width, height }}
        title="데이터 수집 중"
      >
        <Spinner size={Math.min(16, height - 8)} />
      </div>
    );
  }

  const pad = 4;
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (baseline != null) {
    min = Math.min(min, baseline);
    max = Math.max(max, baseline);
  }
  if (min === max) {
    min -= 1;
    max += 1;
  }

  const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / (max - min)) * (height - pad * 2);

  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const gid = fillId(stroke);
  // 영역 패스 — 선을 따라간 뒤 좌우 끝을 바닥까지 닫는다(바닥은 svg 하단, 여백 없이)
  const areaPath = `M${x(0).toFixed(1)},${height} L${values
    .map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(" L")} L${x(values.length - 1).toFixed(1)},${height} Z`;

  return (
    <svg width={width} height={height} className="block">
      {area && (
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: stroke }} stopOpacity="0.22" />
            <stop offset="100%" style={{ stopColor: stroke }} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      {/* 상·하단 점선 가이드 — 값의 최대/최소 밴드를 눈으로 잡아주는 얇은 레일 */}
      {guides && (
        <>
          <line
            x1="0"
            x2={width}
            y1={pad}
            y2={pad}
            style={{ stroke: "var(--color-navy-300)" }}
            strokeWidth="1"
            strokeDasharray="1 3"
            opacity="0.7"
          />
          <line
            x1="0"
            x2={width}
            y1={height - pad}
            y2={height - pad}
            style={{ stroke: "var(--color-navy-300)" }}
            strokeWidth="1"
            strokeDasharray="1 3"
            opacity="0.7"
          />
        </>
      )}
      {area && <path d={areaPath} fill={`url(#${gid})`} stroke="none" />}
      {baseline != null && (
        <line
          x1={pad}
          x2={width - pad}
          y1={y(baseline)}
          y2={y(baseline)}
          style={{ stroke: "var(--color-navy-300)" }}
          strokeWidth="1"
          strokeDasharray="3 3"
        />
      )}
      {/* stroke는 style로 — SVG 속성과 달리 CSS 변수(var(--color-up) 등)를 받을 수 있어
          다크 모드에서 등락 색이 자동 전환된다 (hex 문자열도 그대로 동작) */}
      <polyline
        points={points}
        fill="none"
        style={{ stroke }}
        strokeWidth={accentRing ? 1.4 : 1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {accentRing && (
        <>
          {/* 정적 링 (항상 보이는 노란 강조) */}
          <circle
            cx={x(values.length - 1)}
            cy={y(values[values.length - 1])}
            r="5"
            fill="none"
            style={{ stroke: accentRing }}
            strokeWidth="1.6"
            opacity="0.55"
          />
          {/* 펄스 링 — 확장하며 사라지는 모션 (동시접속 점과 동일 톤) */}
          <circle
            cx={x(values.length - 1)}
            cy={y(values[values.length - 1])}
            r="5"
            fill="none"
            style={{ stroke: accentRing }}
            strokeWidth="1.8"
          >
            <animate attributeName="r" values="4;11" dur="1.6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.85;0" dur="1.6s" repeatCount="indefinite" />
          </circle>
        </>
      )}
      {pulse && (
        // 진행중 펄스 — 끝점에서 확장하며 사라지는 모션 (장중 표시)
        <circle
          cx={x(values.length - 1)}
          cy={y(values[values.length - 1])}
          r="2.5"
          fill="none"
          style={{ stroke }}
          strokeWidth="1.4"
        >
          <animate attributeName="r" values="2.5;9" dur="1.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.8;0" dur="1.6s" repeatCount="indefinite" />
        </circle>
      )}
      <circle
        cx={x(values.length - 1)}
        cy={y(values[values.length - 1])}
        r={accentRing ? "3" : "2.5"}
        style={{ fill: accentRing ?? stroke }}
      />
    </svg>
  );
}
