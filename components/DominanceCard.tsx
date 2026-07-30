import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { getTickers, getExchangeComparison } from "@/lib/ticker";
import { getMarketOverview, getFxHistory } from "@/lib/market";
import { formatPercent, formatRelativeTime } from "@/lib/format";
import Sparkline from "@/components/Sparkline";
import FxChart from "@/components/FxChart";

function changeColor(n: number | null): string {
  if (n == null) return "text-ink-500";
  if (n > 0) return "text-red-600";
  if (n < 0) return "text-indigo-700";
  return "text-ink-500";
}

// BTC 도미넌스 + 테더 김프 + 환율 USD/KRW 카드 — MarketCards·김치프리미엄 페이지 공용.
// 데이터는 자체 조회(모두 MarketCache 캐시 경유라 중복 비용 미미).
export default async function DominanceCard() {
  const [overview, domHistory, snapshot, fxHistory, exchanges] = await Promise.all([
    getMarketOverview(),
    prisma.marketSnapshot
      .findMany({ orderBy: { createdAt: "desc" }, take: 96 })
      .then((rows) => rows.reverse())
      .catch(() => []),
    getTickers(),
    getFxHistory(),
    getExchangeComparison(),
  ]);

  // 환율 — 현재값 + 전 영업일 대비 등락(색 농도용, 표시 6일)
  const fxIsEstimate = snapshot.usdKrwSource === "fallback";
  const fxDisplay = fxHistory.slice(-6);
  const fxChangeAt = (i: number): number | null => {
    const idx = fxHistory.length - fxDisplay.length + i;
    const prev = fxHistory[idx - 1];
    const cur = fxHistory[idx];
    return prev && cur ? (cur.rate / prev.rate - 1) * 100 : null;
  };
  const fxLatestChange = fxDisplay.length ? fxChangeAt(fxDisplay.length - 1) : null;

  // 테더(USDT) 김프 — 업비트 테더 시세 vs 공식환율
  const usdtKimchi =
    exchanges.usdtUpbit != null && snapshot.usdKrw > 0
      ? (exchanges.usdtUpbit / snapshot.usdKrw - 1) * 100
      : null;

  return (
    <section className="flex flex-col rounded-[6px] border border-line bg-white shadow-card transition-shadow hover:shadow-pop overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-white px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
          BTC Dominance
        </h2>
        <span className="font-mono text-[10px] tracking-[0.12em] text-ink-500 uppercase">
          {`${formatRelativeTime(overview.updatedAt)} · CoinGecko`}
        </span>
      </header>

      <div className="flex flex-1 flex-col p-5">
        {/* 도미넌스 — 콤팩트 (숫자 + 시총 + 소형 스파크라인) */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="font-sans text-[28px] font-light leading-none tracking-[-0.03em] tabular-nums text-navy-900">
              {overview.btcDominance != null ? `${overview.btcDominance.toFixed(1)}%` : "–"}
            </span>
            <p className="mt-1 text-[11px] text-ink-500">
              시총{" "}
              <span className="font-mono text-ink-700">
                {overview.totalMarketCapUsd != null ? `$${(overview.totalMarketCapUsd / 1e12).toFixed(2)}T` : "–"}
              </span>{" "}
              <span className={`font-mono ${changeColor(overview.marketCapChange24h)}`}>
                {formatPercent(overview.marketCapChange24h)}
              </span>
            </p>
          </div>
          <Sparkline
            values={domHistory.map((s) => s.btcDominance)}
            width={96}
            height={36}
            stroke="#5a616b"
            accentRing="#078f18"
          />
        </div>

        <div className="my-4 h-px bg-line" />

        {/* 테더(USDT) 타이틀 + 환율 USD/KRW 보조 (위아래 순서: 테더 → 환율) */}
        <div className="mb-1 flex flex-col gap-1">
          {exchanges.usdtUpbit != null && (
            <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-sm font-semibold text-navy-900">테더(USDT)</span>
              <span className="font-mono text-lg font-light tabular-nums text-navy-900">
                {Math.round(exchanges.usdtUpbit).toLocaleString()}원
              </span>
              {usdtKimchi != null && (
                <span
                  className={`font-mono text-[11px] tabular-nums ${
                    usdtKimchi > 0 ? "text-red-600" : usdtKimchi < 0 ? "text-indigo-700" : "text-ink-500"
                  }`}
                >
                  김프 {usdtKimchi >= 0 ? "+" : ""}
                  {usdtKimchi.toFixed(2)}%
                </span>
              )}
            </span>
          )}
          <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[12px] text-ink-500">
            환율 USD/KRW{" "}
            <span className="font-mono text-[13px] tabular-nums text-navy-900">
              {snapshot.usdKrw.toLocaleString()}
            </span>
            {fxLatestChange != null && (
              <span
                className={`font-mono text-[11px] tabular-nums ${
                  fxLatestChange >= 0 ? "text-red-600" : "text-indigo-700"
                }`}
              >
                {fxLatestChange >= 0 ? "+" : ""}
                {fxLatestChange.toFixed(2)}%
              </span>
            )}
          </span>
        </div>

        <FxChart
          points={fxDisplay.map((p, i) => ({ date: p.date, rate: p.rate, change: fxChangeAt(i) }))}
        />

        <p className="mt-auto flex items-center gap-1 pt-2 font-mono text-[10px] tracking-[0.14em] text-navy-400 uppercase">
          {fxIsEstimate ? (
            <span className="text-red-600">⚠ 환율 일시 추정 · 김프 정확도 주의</span>
          ) : (
            <>
              도미넌스
              <Image
                src="/coingecko.png"
                alt="CoinGecko"
                width={12}
                height={12}
                className="inline-block rounded-full"
              />
              CoinGecko · 환율 Yahoo · 테더 업비트
            </>
          )}
        </p>
      </div>
    </section>
  );
}
