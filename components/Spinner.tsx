// KMIR 로딩 모션 — 브랜드 컬러 호가 도는 원형 스피너.
// 훅 없는 순수 컴포넌트라 서버/클라이언트 어디서든 렌더 가능.
// 색은 토큰(var)을 참조해 라이트·다크 모드를 자동 추종한다.
// 모션 최소화 선호 시 회전은 globals.css에서 멈추고 정적 링만 남는다.
export default function Spinner({
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
      viewBox="0 0 24 24"
      role="status"
      aria-label="불러오는 중"
      className={`spinner inline-block shrink-0 ${className}`}
    >
      {/* 트랙 — 옅은 배경 링 */}
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="var(--color-navy-300)"
        strokeWidth="3"
        opacity="0.35"
      />
      {/* 러너 — 링의 1/4만 그려 회전이 보이게 (원둘레 2πr ≈ 56.5) */}
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="var(--color-brand)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="14 42"
      />
    </svg>
  );
}
