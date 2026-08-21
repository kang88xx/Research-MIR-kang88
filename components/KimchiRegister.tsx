import { getKimchiTable, getExchangeSpread } from "@/lib/ticker";
import { formatKrw, formatPercent, formatRelativeTime } from "@/lib/format";

function pctClass(n: number): string {
  if (n > 0) return "text-up";
  if (n < 0) return "text-down";
  return "text-ink-500";
}

// 코인별 김프 + 업비트↔빗썸 괴리 통합 레지스터 — E7B(K2) 확정안.
// 두 표가 따로 놀던 것을 코인당 한 줄(국내가·해외가·김프·괴리)로 합친다.
export default async function KimchiRegister() {
  const [table, spread] = await Promise.all([getKimchiTable(), getExchangeSpread()]);
  const spreadBy = new Map(spread.rows.map((r) => [r.symbol, r.spread]));
  const fxIsEstimate = table.usdKrwSource === "fallback";

  return (
    <section className="rounded-[6px] border border-line bg-white">
      <header className="flex flex-wrap items-baseline gap-2 border-b border-line px-5 py-3">
        <h2 className="text-sm font-semibold text-navy-900">코인별 김프 · 거래소 괴리</h2>
        <span className="eyebrow hidden sm:inline">By Volume Top 10</span>
        <span className="ml-auto text-[10px] text-navy-300">
          {table.rows.length === 0
            ? "데이터 없음"
            : `${formatRelativeTime(table.updatedAt)} · 업비트·바이낸스·빗썸`}
        </span>
      </header>

      {table.rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ink-500">데이터를 불러오지 못했습니다.</p>
      ) : (
        <table className="w-full text-[13px] tabular-nums">
          <thead>
            <tr className="border-b border-hairline text-[10.5px] tracking-wider text-ink-400">
              <th className="px-5 py-2 text-left font-semibold">코인</th>
              <th className="px-4 py-2 text-right font-semibold">국내가(업비트)</th>
              <th className="hidden px-4 py-2 text-right font-semibold sm:table-cell">
                해외가(바이낸스)
              </th>
              <th className="px-4 py-2 text-right font-semibold">김프</th>
              <th className="px-5 py-2 text-right font-semibold">빗썸 괴리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {table.rows.map((r) => {
              const sp = spreadBy.get(r.symbol);
              return (
                <tr key={r.symbol}>
                  <td className="px-5 py-2.5 font-bold text-ink-900">{r.symbol}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-ink-900">
                    {formatKrw(r.priceKrw)}원
                  </td>
                  <td className="hidden px-4 py-2.5 text-right font-mono text-xs text-ink-500 sm:table-cell">
                    ${r.priceUsd.toLocaleString(undefined, {
                      maximumFractionDigits: r.priceUsd >= 1 ? 2 : 6,
                    })}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-mono font-semibold ${pctClass(r.kimchi)}`}>
                    {formatPercent(r.kimchi)}
                  </td>
                  <td
                    className={`px-5 py-2.5 text-right font-mono ${
                      sp != null ? `font-semibold ${pctClass(sp)}` : "text-ink-300"
                    }`}
                  >
                    {sp != null ? formatPercent(sp) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <p className="border-t border-line px-5 py-2">
        <span className="rail">
          김프 = 업비트 KRW vs 바이낸스 USDT × 환율 · 괴리 + 업비트가 비쌈 − 빗썸이 비쌈
          {fxIsEstimate ? (
            <span className="text-up"> · ⚠ 환율 추정</span>
          ) : (
            " · 환율 시장환율(Yahoo) 기준"
          )}
        </span>
      </p>
    </section>
  );
}
