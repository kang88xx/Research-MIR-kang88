import TickerTable from "@/components/TickerTable";
import DominanceCard from "@/components/DominanceCard";
import FngCard from "@/components/FngCard";

// 실시간 시세 · 도미넌스+환율 · 공포탐욕 3카드 — 홈/대시보드 공용
export default function MarketCards() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {/* 01 · 실시간 시세 */}
      <TickerTable />

      {/* 02 · BTC DOMINANCE(압축) + 환율 USD/KRW — 김치프리미엄 페이지와 공용 카드 */}
      <DominanceCard />

      {/* 03 · FEAR & GREED — 각종 지표 페이지와 공용 카드 */}
      <FngCard />
    </div>
  );
}
