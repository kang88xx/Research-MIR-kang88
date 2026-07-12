type Pt = { date: string; rate: number; change: number | null };

// USD/KRW 최근 N영업일 라인 차트 — 값·날짜·등락 라벨을 상시 표시(호버 불필요)
export default function FxChart({ points }: { points: Pt[] }) {
  if (points.length === 0) return null;

  const W = 320;
  const H = 134;
  const padX = 26;
  const padTop = 22;
  const padBottom = 30;
  const innerW = W - padX * 2;
  const innerH = H - padTop - padBottom;

  const rates = points.map((p) => p.rate);
  const min = Math.min(...rates);
  const max = Math.max(...rates);
  const span = max - min || 1;

  const x = (i: number) =>
    points.length === 1 ? padX + innerW / 2 : padX + (innerW * i) / (points.length - 1);
  const y = (r: number) => padTop + innerH - ((r - min) / span) * innerH;
  const color = (ch: number | null) => (ch == null ? "#7d858f" : ch >= 0 ? "#e5443b" : "#2e7ce6");

  const linePts = points.map((p, i) => `${x(i).toFixed(1)},${y(p.rate).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="USD/KRW 최근 영업일 추이">
      <polyline
        points={linePts}
        fill="none"
        stroke="#5a616b"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {points.map((p, i) => {
        const cx = x(i);
        const cy = y(p.rate);
        const c = color(p.change);
        const d = new Date(p.date + "T00:00:00Z");
        return (
          <g key={p.date} fontFamily="ui-monospace, monospace">
            <circle cx={cx} cy={cy} r={3} fill={c} />
            {/* 환율값 — 점 위 */}
            <text x={cx} y={cy - 8} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--color-navy-900)">
              {Math.round(p.rate).toLocaleString()}
            </text>
            {/* 날짜 — 하단 */}
            <text x={cx} y={H - 16} textAnchor="middle" fontSize="9.5" fill="#9aa4c8">
              {d.getUTCMonth() + 1}/{d.getUTCDate()}
            </text>
            {/* 등락 — 최하단 */}
            <text x={cx} y={H - 4} textAnchor="middle" fontSize="9" fill={c}>
              {p.change == null ? "·" : `${p.change >= 0 ? "+" : ""}${p.change.toFixed(2)}%`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
