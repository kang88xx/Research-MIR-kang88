// KMIR 오브 로더 — 크기 다른 점 3개가 각자 반경·속도·방향으로 공전하는 파티클 오빗.
// 훅 없는 순수 컴포넌트라 서버/클라이언트 어디서든 렌더 가능. 모션 최소화 선호 시
// 회전은 globals.css에서 멈추고 정적 점만 남는다. 색은 토큰만 사용해 다크 모드 자동 추종.
// 점 크기는 size에 비례(최소 2px)해 18px 인라인 스피너부터 56px 페이지 로더까지 공용.

// 공전 궤도 1겹 — 래퍼가 회전하고 점은 12시 방향에 고정
function Orbit({
  inset,
  dot,
  color,
  variant = "",
}: {
  inset: string;
  dot: number;
  color: string;
  variant?: string;
}) {
  return (
    <span aria-hidden="true" className={`orb-orbit absolute ${variant}`} style={{ inset }}>
      <span
        className="absolute left-1/2 top-0 rounded-full"
        style={{ width: dot, height: dot, marginLeft: -dot / 2, background: color }}
      />
    </span>
  );
}

const dotPx = (size: number, ratio: number) => Math.max(2, Math.round(size * ratio));

export default function OrbLoader({ size = 56, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      role="status"
      aria-label="불러오는 중"
      className={`relative inline-block shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <Orbit inset="0" dot={dotPx(size, 0.11)} color="var(--color-brand)" />
      <Orbit inset="16%" dot={dotPx(size, 0.09)} color="var(--color-navy-600)" variant="orb-orbit--rev" />
      <Orbit inset="32%" dot={dotPx(size, 0.07)} color="var(--color-navy-300)" variant="orb-orbit--slow" />
    </span>
  );
}

// 페이지 로딩 화면 — 라우트 loading.tsx 공용 (가운데 오브 + 한 줄 라벨)
export function PageLoader({ label = "불러오는 중…" }: { label?: string }) {
  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center gap-4">
      <OrbLoader size={56} />
      <p className="text-[12.5px] font-medium text-ink-400">{label}</p>
    </div>
  );
}
