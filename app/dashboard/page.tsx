import MarketCards from "@/components/MarketCards";
import MarketPulse from "@/components/MarketPulse";
import KimchiTable from "@/components/KimchiTable";
import ExchangeSpread from "@/components/ExchangeSpread";
import PageTitle from "@/components/PageTitle";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div id="indicators" className="scroll-mt-4">
        <PageTitle eyebrow="Data Dashboard" title="데이터 대시보드" />
        <MarketCards />
      </div>

      <MarketPulse />

      <div id="kimchi" className="grid grid-cols-1 gap-6 scroll-mt-4 lg:grid-cols-2">
        <KimchiTable />
        <ExchangeSpread />
      </div>
    </div>
  );
}
