// 공포·탐욕 반원 게이지 — 색상 밴드 + 바늘 인포그래픽 (SVG, 서버 렌더)
const BANDS = [
  { from: 0, to: 25, color: "#DC2626" }, // 극단적 공포
  { from: 25, to: 45, color: "#F59E0B" }, // 공포
  { from: 45, to: 55, color: "#A0A6BB" }, // 중립
  { from: 55, to: 75, color: "#34D399" }, // 탐욕
  { from: 75, to: 100, color: "#059669" }, // 극단적 탐욕
];

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

// value 0 → 180°(왼쪽 끝), value 100 → 0°(오른쪽 끝)
function valueToDeg(value: number): number {
  return 180 - (Math.max(0, Math.min(100, value)) / 100) * 180;
}

function arcPath(cx: number, cy: number, r: number, fromVal: number, toVal: number): string {
  const start = polar(cx, cy, r, valueToDeg(fromVal));
  const end = polar(cx, cy, r, valueToDeg(toVal));
  return `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} A ${r} ${r} 0 0 1 ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
}

export default function FngGauge({
  value,
  label,
  width = 220,
}: {
  value: number;
  label: string;
  width?: number;
}) {
  const cx = width / 2;
  const r = width * 0.4;
  const topPad = 8;
  const cy = topPad + r; // 받침점(반원 baseline)
  const height = cy + width * 0.3; // baseline 아래에 수치·라벨 공간 확보

  const band = BANDS.find((b) => value >= b.from && value <= b.to) ?? BANDS[2];
  const needleDeg = valueToDeg(value);
  const tip = polar(cx, cy, r - 3, needleDeg); // 컬러 밴드까지 닿도록
  const tail = polar(cx, cy, 14, needleDeg + 180); // 받침점 뒤로 살짝

  return (
    <svg width={width} height={height} className="block" role="img" aria-label={`공포·탐욕 지수 ${value} (${label})`}>
      {BANDS.map((b) => (
        <path
          key={b.from}
          d={arcPath(cx, cy, r, b.from + 0.8, b.to - 0.8)}
          fill="none"
          stroke={b.color}
          strokeWidth={13}
          strokeLinecap="butt"
          opacity={value >= b.from && value <= b.to ? 1 : 0.32}
        />
      ))}

      {/* 바늘 — 받침점에서 현재 값의 밴드를 향함 */}
      <line
        x1={tail.x}
        y1={tail.y}
        x2={tip.x}
        y2={tip.y}
        stroke="var(--color-navy-900)"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r={4.5} fill="var(--color-navy-900)" />
      <circle cx={cx} cy={cy} r={1.8} fill="var(--color-surface)" />

      {/* 양끝 라벨 — baseline 모서리 */}
      <text x={cx - r} y={cy + 13} textAnchor="middle" fontSize={9} fill="#A0A6BB">
        공포 0
      </text>
      <text x={cx + r} y={cy + 13} textAnchor="middle" fontSize={9} fill="#A0A6BB">
        100 탐욕
      </text>

      {/* 값 + 분류 — baseline 아래 중앙, 바늘과 겹치지 않음 */}
      <text
        x={cx}
        y={cy + width * 0.16}
        textAnchor="middle"
        fontSize={width * 0.15}
        fontWeight={600}
        fill={band.color}
        fontFamily="var(--font-geist-mono), monospace"
      >
        {value}
      </text>
      <text
        x={cx}
        y={cy + width * 0.16 + width * 0.075}
        textAnchor="middle"
        fontSize={width * 0.058}
        fontWeight={600}
        fill="var(--color-ink-900)"
      >
        {label}
      </text>
    </svg>
  );
}
