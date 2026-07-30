import { Suspense } from "react";
import MarketBar from "@/components/MarketBar";
import FngCard from "@/components/FngCard";
import { MarketBarSkeleton } from "@/components/Skeletons";

export const dynamic = "force-dynamic";
export const metadata = { title: "각종 지표 · KMIR" };

// 각종 지표 전용 페이지 — 마켓 타일 12종 + Fear & Greed 카드만
export default function IndicatorsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="-mx-5 -mt-3">
        <Suspense fallback={<MarketBarSkeleton />}>
          <MarketBar />
        </Suspense>
      </div>
      <div className="max-w-[520px]">
        <FngCard />
      </div>
    </div>
  );
}
