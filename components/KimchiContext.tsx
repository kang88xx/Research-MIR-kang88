import { getMarketOverview, getFxHistory } from "@/lib/market";
import { getTickers, getExchangeComparison } from "@/lib/ticker";
import { formatPercent } from "@/lib/format";

function pctClass(n: number): string {
  if (n > 0) return "text-up";
  if (n < 0) return "text-down";
  return "text-ink-500";
}

// 시장 컨텍스트 스트립 — E7B(K2) 확정안: 도미넌스·총시총·테더·환율을 괘선 4열로.
// 기존 DominanceCard(카드+차트)를 대체하는 요약 행이다.
export default async function KimchiContext() {
  const [overview, snapshot, exchanges, fxHistory] = await Promise.all([
    getMarketOverview(),
    getTickers(),
    getExchangeComparison(),
    getFxHistory(),
  ]);

  const usdtKimchi =
    exchanges.usdtUpbit != null && snapshot.usdKrw > 0
      ? (exchanges.usdtUpbit / snapshot.usdKrw - 1) * 100
      : null;
  const fxChange =
    fxHistory.length >= 2
      ? (fxHistory[fxHistory.length - 1].rate / fxHistory[fxHistory.length - 2].rate - 1) * 100
      : null;
  const fxIsEstimate = snapshot.usdKrwSource === "fallback";

  return (
    <section className="grid grid-cols-2 rounded-[6px] border border-line bg-white tabular-nums sm:grid-cols-4">
      <div className="border-r border-hairline px-5 py-3.5 max-sm:border-b">
        <p className="text-[10.5px] text-ink-500">BTC 도미넌스</p>
        <p className="mt-1 font-mono text-[16px] font-semibold text-navy-900">
          {overview.btcDominance != null ? `${overview.btcDominance.toFixed(1)}%` : "–"}
        </p>
      </div>
      <div className="px-5 py-3.5 max-sm:border-b max-sm:border-hairline sm:border-r sm:border-hairline">
        <p className="text-[10.5px] text-ink-500">총시총</p>
        <p className="mt-1 font-mono text-[16px] font-semibold text-navy-900">
          {overview.totalMarketCapUsd != null
            ? `$${(overview.totalMarketCapUsd / 1e12).toFixed(2)}T`
            : "–"}
          {overview.marketCapChange24h != null && (
            <span className={`ml-1.5 text-[11px] ${pctClass(overview.marketCapChange24h)}`}>
              {formatPercent(overview.marketCapChange24h)}
            </span>
          )}
        </p>
      </div>
      <div className="border-r border-hairline px-5 py-3.5">
        <p className="text-[10.5px] text-ink-500">테더(USDT)</p>
        <p className="mt-1 font-mono text-[16px] font-semibold text-navy-900">
          {exchanges.usdtUpbit != null
            ? `${Math.round(exchanges.usdtUpbit).toLocaleString("ko-KR")}원`
            : "–"}
          {usdtKimchi != null && (
            <span className={`ml-1.5 text-[11px] ${pctClass(usdtKimchi)}`}>
              김프 {formatPercent(usdtKimchi)}
            </span>
          )}
        </p>
      </div>
      <div className="px-5 py-3.5">
        <p className="text-[10.5px] text-ink-500">환율 USD/KRW</p>
        <p className="mt-1 font-mono text-[16px] font-semibold text-navy-900">
          {snapshot.usdKrw.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}
          {fxIsEstimate ? (
            <span className="ml-1.5 text-[11px] text-up">추정</span>
          ) : (
            fxChange != null && (
              <span className={`ml-1.5 text-[11px] ${pctClass(fxChange)}`}>
                {formatPercent(fxChange)}
              </span>
            )
          )}
        </p>
      </div>
    </section>
  );
}
