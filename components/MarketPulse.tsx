import Link from "next/link";
import { getKrwMarketStats } from "@/lib/ticker";
import { formatKrw, formatVolume, formatPercent, formatRelativeTime } from "@/lib/format";
import { breadthSignal, toneClass } from "@/lib/signals";

function changeColor(n: number | null): string {
  if (n == null) return "text-ink-500";
  if (n > 0) return "text-red-600";
  if (n < 0) return "text-indigo-700";
  return "text-ink-500";
}

// KRW 시장 폭(breadth) + 거래대금 TOP — 업비트 전 KRW마켓 기준
export default async function MarketPulse() {
  const stats = await getKrwMarketStats();
  const hasData = stats.total > 0;
  const upPct = hasData ? (stats.up / stats.total) * 100 : null;
  const downPct = hasData ? (stats.down / stats.total) * 100 : null;
  const sig = breadthSignal(hasData ? stats.upRatio : null);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[320px_1fr]">
      {/* 시장 폭 — 내용 높이만큼만 (옆 리스트 높이에 맞춰 늘어나며 생기는 하단 여백 방지) */}
      <section className="flex flex-col self-start border border-line bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="eyebrow">KRW Market Breadth</h2>
          <span className="text-[10px] text-navy-300">
            {hasData ? `${formatRelativeTime(stats.updatedAt)} · 업비트` : "데이터 없음"}
          </span>
        </div>
        {hasData ? (
          <>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <p className="font-mono text-4xl font-medium tracking-tight text-red-600">
                {upPct!.toFixed(0)}%
              </p>
              <span className="text-[11px] text-ink-500">상승 비율</span>
              {sig && (
                <span
                  className={`ml-auto rounded px-1.5 py-0.5 text-[11px] font-semibold ${toneClass(
                    sig.tone
                  )}`}
                >
                  {sig.label}
                </span>
              )}
            </div>
            {/* 상승/하락 스택 바 (빨강=상승, 파랑=하락) */}
            <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-paper2">
              <div className="bg-red-500" style={{ width: `${upPct}%` }} />
              <div className="bg-indigo-500" style={{ width: `${downPct}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-[11px]">
              <span className="text-red-600">상승 {stats.up}</span>
              <span className="text-ink-500">보합 {stats.flat}</span>
              <span className="text-indigo-700">하락 {stats.down}</span>
            </div>
            <p className="mt-4 border-t border-line pt-3">
              <span className="rail">거래대금 1억원 이상 {stats.total}종목 기준</span>
            </p>
          </>
        ) : (
          <p className="mt-4 text-sm text-ink-500">데이터를 불러오지 못했습니다.</p>
        )}
      </section>

      {/* 거래대금 TOP */}
      <section className="flex flex-col border border-line bg-white">
        <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <h2 className="text-sm font-semibold text-navy-900">거래대금 TOP · 업비트 KRW</h2>
          <span className="text-[10px] text-navy-300">24h 누적</span>
        </header>
        {stats.topVolume.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-ink-500">데이터 없음</p>
        ) : (
          <ul className="divide-y divide-line">
            {stats.topVolume.map((m, i) => (
              <li key={m.market} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span
                  className={`w-4 shrink-0 text-center text-xs font-bold ${
                    i < 3 ? "text-navy-700" : "text-navy-300"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="w-14 shrink-0 font-semibold text-navy-900">{m.symbol}</span>
                <span className="flex-1 text-right font-mono text-ink-900">
                  {formatKrw(m.priceKrw)}
                </span>
                <span className={`w-16 shrink-0 text-right font-mono ${changeColor(m.change24h)}`}>
                  {formatPercent(m.change24h)}
                </span>
                <span className="w-16 shrink-0 text-right font-mono text-xs text-ink-500">
                  {formatVolume(m.volumeKrw24h)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-auto border-t border-line px-4 py-2">
          <Link href="/dashboard" className="rail hover:text-navy-900">
            전체 지표 보기 +
          </Link>
        </p>
      </section>
    </div>
  );
}
