// 등락 방향 배지 — 변동률 옆에 붙는 원형 화살표(파이낸스 표준 문법).
// 색은 한국 증시 관례를 따르되 CSS 변수를 그대로 쓰므로 다크 모드에서 자동 전환된다.
// 보합(0 · null)은 배지를 그리지 않는다 — 방향이 없는데 화살표를 두면 오독을 부른다.
export default function ChangeArrow({
  pct,
  size = 14,
  className = "",
}: {
  pct: number | null | undefined;
  size?: number;
  className?: string;
}) {
  if (pct == null || pct === 0) return null;
  const up = pct > 0;
  const color = up ? "var(--color-up)" : "var(--color-down)";
  return (
    <span
      aria-hidden
      className={`inline-grid shrink-0 place-items-center rounded-full align-middle ${className}`}
      style={{
        width: size,
        height: size,
        background: `color-mix(in srgb, ${color} 16%, transparent)`,
      }}
    >
      <svg width={size} height={size} viewBox="0 0 14 14" style={{ display: "block" }}>
        {/* 위/아래 화살표 — 굵기 1.5, 라운드 캡 (셀 높이가 작아도 뭉개지지 않는다) */}
        <path
          d={up ? "M7 10.2 V4.4 M4.2 7 L7 4.1 L9.8 7" : "M7 3.8 V9.6 M4.2 7 L7 9.9 L9.8 7"}
          fill="none"
          style={{ stroke: color }}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
