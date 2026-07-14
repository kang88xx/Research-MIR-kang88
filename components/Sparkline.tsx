import GajaLoader from "@/components/GajaLoader";

export default function Sparkline({
  values,
  width = 280,
  height = 56,
  stroke = "#636DDB",
  baseline,
  accentRing,
  pulse,
}: {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
  baseline?: number; // 기준선 (예: 김프 0%)
  accentRing?: string; // 끝점 강조 링 색 (예: 앰버)
  pulse?: boolean; // 끝점 진행중 펄스 모션 (장중일 때만 true)
}) {
  if (values.length < 2) {
    // 자리가 좁아(76×26) 텍스트 대신 브랜드 로더만 — 의미는 title로 보존
    return (
      <div
        className="flex items-center justify-center"
        style={{ width, height }}
        title="데이터 수집 중"
      >
        <GajaLoader size={Math.min(16, height - 8)} />
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

  return (
    <svg width={width} height={height} className="block">
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
      <polyline points={points} fill="none" style={{ stroke }} strokeWidth={accentRing ? 1.4 : 1.2} />
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
