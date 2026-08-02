import { getKimchiTable } from "@/lib/ticker";
import { formatKrw, formatPercent, formatRelativeTime } from "@/lib/format";

function changeColor(n: number | null): string {
  if (n == null) return "text-ink-500";
  if (n > 0) return "text-red-600";
  if (n < 0) return "text-indigo-700";
  return "text-ink-500";
}

// 거래대금 상위 코인별 김치프리미엄 — 한국 시그니처 지표 (유동성 필터 후 TOP 10)
export default async function KimchiTable() {
  const table = await getKimchiTable();
  const fxIsEstimate = table.usdKrwSource === "fallback";

  return (
    <section className="flex flex-col border border-line bg-white">
      <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold text-navy-900">김치프리미엄 · 거래대금 TOP</h2>
          <span className="eyebrow hidden sm:inline">Kimchi Premium</span>
        </div>
        <span className="text-[10px] text-navy-300">
          {table.rows.length === 0
            ? "데이터 없음"
            : `${formatRelativeTime(table.updatedAt)} · 업비트·바이낸스`}
        </span>
      </header>

      {table.rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-ink-500">데이터를 불러오지 못했습니다.</p>
      ) : (
        <ul className="divide-y divide-line">
          {table.rows.map((r) => (
            <li key={r.symbol} className="flex items-center gap-3 px-4 py-2 text-sm">
              <span className="w-12 shrink-0 font-semibold text-navy-900">{r.symbol}</span>
              <span className="flex-1 whitespace-nowrap text-right font-mono text-ink-900">
                {formatKrw(r.priceKrw)}원
              </span>
              <span className="hidden w-24 shrink-0 text-right font-mono text-xs text-ink-500 sm:block">
                ${r.priceUsd.toLocaleString(undefined, { maximumFractionDigits: r.priceUsd >= 1 ? 2 : 6 })}
              </span>
              <span className={`w-16 shrink-0 text-right font-mono font-semibold ${changeColor(r.kimchi)}`}>
                {formatPercent(r.kimchi)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="border-t border-line px-4 py-2">
        <span className="rail">
          업비트 KRW vs 바이낸스 USDT × 환율
          {fxIsEstimate ? (
            <span className="text-red-600"> · ⚠ 환율 추정</span>
          ) : (
            // 실제 소스 순서: Yahoo 시장환율 우선, ECB(Frankfurter)는 폴백 (lib/ticker fetchUsdKrw)
            " · 환율 시장환율(Yahoo) 기준"
          )}
        </span>
      </p>
    </section>
  );
}
