import { Suspense } from "react";
import { getMarketBar } from "@/lib/marketbar";
import IndicatorGrid from "@/components/IndicatorGrid";
import { MarketBarSkeleton } from "@/components/Skeletons";
import GajaLoader from "@/components/GajaLoader";

export const dynamic = "force-dynamic";
export const metadata = { title: "각종 지표 · KMIR" };

// 대시보드와 동일한 12개 지표 순서 (크립토 핵심 → 크립토 파생 → 전통시장)
const TILE_ORDER = [
  "btc",
  "eth",
  "btcDom",
  "fng",
  "usdtKimchi",
  "fx",
  "mstr",
  "btcBreakeven",
  "nasdaq",
  "kospi",
  "kosdaq",
  "gold",
];

// 데이터는 대시보드와 같은 getMarketBar 캐시(5분)를 그대로 사용 — 추가 외부 호출 없음
async function Indicators() {
  const { tiles: rawTiles } = await getMarketBar();
  const tiles = [...rawTiles].sort((a, b) => {
    const ia = TILE_ORDER.indexOf(a.key);
    const ib = TILE_ORDER.indexOf(b.key);
    return (ia === -1 ? TILE_ORDER.length : ia) - (ib === -1 ? TILE_ORDER.length : ib);
  });

  if (tiles.length === 0) {
    return (
      <p className="rail flex items-center justify-center gap-2 py-8 text-center">
        <GajaLoader size={15} />
        마켓 데이터 불러오는 중…
      </p>
    );
  }
  return <IndicatorGrid tiles={tiles} />;
}

// 각종 지표 전용 페이지 — 12개 지표를 상세 카드로, 클릭하면 설명·해석·출처 모달
export default function IndicatorsPage() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[11.5px] text-ink-500">
        대시보드와 동일한 12개 지표입니다. 카드를 누르면 지표 설명·해석 가이드·산출 방식·출처를
        확인할 수 있습니다.
      </p>
      <Suspense fallback={<MarketBarSkeleton />}>
        <Indicators />
      </Suspense>
    </div>
  );
}
