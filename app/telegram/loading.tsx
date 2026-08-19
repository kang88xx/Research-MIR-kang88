import { PageLoader } from "@/components/OrbLoader";

// 텔레그램 페이지 진입 시 즉시 표시 — 데이터 SSR 동안 오브 로더 노출
export default function Loading() {
  return <PageLoader label="텔레그램 트렌딩 불러오는 중…" />;
}
