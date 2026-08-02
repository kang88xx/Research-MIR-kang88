import KimchiHero from "@/components/KimchiHero";
import KimchiTable from "@/components/KimchiTable";
import ExchangeSpread from "@/components/ExchangeSpread";
import DominanceCard from "@/components/DominanceCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "김치 프리미엄 · KMIR" };

// 김치 프리미엄 전용 페이지 — 시장 상황 한눈 요약(히어로) + 코인별 김프 TOP +
// 업비트↔빗썸 괴리 + 도미넌스·환율 컨텍스트
export default function KimchiPage() {
  return (
    <div className="flex flex-col gap-6">
      <KimchiHero />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_400px]">
        <KimchiTable />
        <div className="flex flex-col gap-6">
          <ExchangeSpread />
          <DominanceCard />
        </div>
      </div>
    </div>
  );
}
