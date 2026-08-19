import OrbLoader from "@/components/OrbLoader";

// KMIR 로딩 모션 — 파티클 오빗(OrbLoader)의 인라인 크기 별칭.
// 기존 호출부 API({size, className})를 그대로 유지해 사이트의 모든 인라인 로딩이
// 페이지 로더와 같은 모션을 쓴다.
export default function Spinner({
  size = 18,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return <OrbLoader size={size} className={className} />;
}
