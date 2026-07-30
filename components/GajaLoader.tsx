// KMIR 로딩 모션 — 브랜드 셰브런이 뒤→앞 순차 점등.
// 훅 없는 순수 컴포넌트라 서버/클라이언트 어디서든 렌더 가능.
// 색은 토큰(var)을 참조해 라이트·다크 모드를 자동 추종한다. 키프레임은 globals.css.
export default function GajaLoader({
  size = 18,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      aria-hidden
      className={`inline-block shrink-0 ${className}`}
    >
      <path
        className="gaja-step1"
        d="M26 26 L58 60 L26 94"
        fill="none"
        stroke="var(--color-navy-300)"
        strokeWidth="17"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        className="gaja-step2"
        d="M60 26 L92 60 L60 94"
        fill="none"
        stroke="var(--color-brand)"
        strokeWidth="17"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
