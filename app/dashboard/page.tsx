import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getTickers } from "@/lib/ticker";
import { formatKrw, formatPercent } from "@/lib/format";
import MarketCards from "@/components/MarketCards";
import MarketPulse from "@/components/MarketPulse";
import KimchiTable from "@/components/KimchiTable";
import ExchangeSpread from "@/components/ExchangeSpread";
import PortfolioForm from "@/components/PortfolioForm";
import PortfolioRow from "@/components/PortfolioRow";
import PageTitle from "@/components/PageTitle";

export const dynamic = "force-dynamic";

function pnlColor(n: number | null): string {
  if (n == null) return "text-ink-500";
  if (n > 0) return "text-red-600";
  if (n < 0) return "text-indigo-700";
  return "text-ink-500";
}

export default async function DashboardPage() {
  const [session, snapshot] = await Promise.all([auth(), getTickers()]);

  const items = session?.user?.id
    ? await prisma.portfolioItem.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const tickerMap = new Map(snapshot.tickers.map((t) => [t.symbol, t]));
  const usdKrw = snapshot.usdKrw;

  const rows = items.map((item) => {
    const ticker = tickerMap.get(item.symbol);
    // 현재가는 입력 통화 기준 — 미지원 종목(주식 등)은 null → 매수금액으로 평가
    const current =
      item.currency === "USD" ? ticker?.priceUsd ?? null : ticker?.priceKrw ?? null;
    const buyTotal = item.quantity * item.buyPrice;
    const curTotal = current != null ? item.quantity * current : null;
    const toKrw = (v: number) => (item.currency === "USD" ? v * usdKrw : v);
    return {
      item,
      current,
      buyTotalKrw: toKrw(buyTotal),
      nowTotalKrw: toKrw(curTotal ?? buyTotal),
    };
  });

  const totalBuy = rows.reduce((sum, r) => sum + r.buyTotalKrw, 0);
  const totalNow = rows.reduce((sum, r) => sum + r.nowTotalKrw, 0);
  const totalPnl = totalBuy > 0 ? ((totalNow - totalBuy) / totalBuy) * 100 : null;

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

      <section className="border border-line bg-white">
        <header className="border-b border-line px-5 py-3">
          <h2 className="text-sm font-semibold text-navy-900">나의 포트폴리오</h2>
          <p className="text-[11px] text-ink-500">
            코인·주식을 원화 또는 달러로 입력하세요. 달러 종목은 현재 환율(
            {usdKrw.toLocaleString()})로 환산해 합산하며, 시세 미지원 종목은 매수금액으로
            평가됩니다.
          </p>
        </header>

        {!session?.user ? (
          <p className="px-5 py-10 text-center text-sm text-ink-500">
            포트폴리오는{" "}
            <Link href="/login" className="text-navy-700 underline-offset-2 hover:underline">
              로그인
            </Link>{" "}
            후 작성할 수 있습니다.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 border-b border-line px-5 py-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-ink-500">나의 총 자산 (현재 평가 · 원화 환산)</p>
                <p className="mt-0.5 font-mono text-2xl font-bold text-navy-900">
                  {formatKrw(totalNow)}원
                </p>
              </div>
              <div>
                <p className="text-xs text-ink-500">총 매수금액 (원화 환산)</p>
                <p className="mt-0.5 font-mono text-2xl font-bold text-navy-900">
                  {formatKrw(totalBuy)}원
                </p>
              </div>
              <div>
                <p className="text-xs text-ink-500">평가손익</p>
                <p className={`mt-0.5 font-mono text-2xl font-bold ${pnlColor(totalPnl)}`}>
                  {formatKrw(totalNow - totalBuy)}원{" "}
                  <span className="text-sm">({formatPercent(totalPnl)})</span>
                </p>
              </div>
            </div>

            {rows.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ink-500">
                아래에서 보유 종목을 추가해 보세요.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-navy-900 text-xs font-light text-white">
                    <th className="px-5 py-2 text-left font-normal">종목</th>
                    <th className="px-2 py-2 text-right font-normal">수량</th>
                    <th className="px-2 py-2 text-right font-normal">매수단가</th>
                    <th className="px-2 py-2 text-right font-normal">매수금액</th>
                    <th className="px-2 py-2 text-right font-normal">현재가</th>
                    <th className="px-2 py-2 text-right font-normal">평가금액</th>
                    <th className="px-2 py-2 text-right font-normal">수익률</th>
                    <th className="w-28 px-5 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ item, current }) => (
                    <PortfolioRow
                      key={item.id}
                      item={{
                        id: item.id,
                        symbol: item.symbol,
                        quantity: item.quantity,
                        buyPrice: item.buyPrice,
                        currency: item.currency,
                      }}
                      current={current}
                    />
                  ))}
                </tbody>
              </table>
            )}

            <div className="border-t border-line px-5 py-4">
              <PortfolioForm />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
