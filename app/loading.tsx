import {
  SignalRadarSkeleton,
  ListingsStripSkeleton,
  HomeBoardsSkeleton,
} from "@/components/Skeletons";

// 홈으로 진입/이동 시 즉시 표시되는 풀페이지 스켈레톤(프리페치되어 즉각 노출).
// 실제 첫 화면 순서와 동일하게 맞춰 콘텐츠 도착 시 레이아웃 점프를 막는다:
// 신규상장 → 캘린더 → 버블맵 → 지금 주목할 코인 → 텔레그램 슬라이드 → 게시판.
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <ListingsStripSkeleton />
      {/* 크립토 캘린더 자리(6주 그리드) */}
      <div className="animate-pulse overflow-hidden rounded-xl border border-line bg-white shadow-card">
        <div className="h-12 border-b border-line bg-paper" />
        <div className="h-[460px] bg-white" />
      </div>
      <SignalRadarSkeleton />
      {/* 텔레그램 인기 포스팅 슬라이드 자리 */}
      <div className="h-[150px] animate-pulse rounded-xl border border-line bg-white shadow-card" />
      <HomeBoardsSkeleton />
    </div>
  );
}
