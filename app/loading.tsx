import { PageLoader } from "@/components/OrbLoader";

// 홈 진입/이동 시 즉시 표시 — 파티클 오빗 로더 (전 페이지 공통 모션)
export default function Loading() {
  return <PageLoader label="불러오는 중…" />;
}
