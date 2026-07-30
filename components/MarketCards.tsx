import { getMarketOverview, fngLabelKo } from "@/lib/market";
import { fngSignal, toneClass } from "@/lib/signals";
import FngGauge from "@/components/FngGauge";
import TickerTable from "@/components/TickerTable";
import DominanceCard from "@/components/DominanceCard";

function fngColor(value: number): string {
  if (value <= 25) return "text-red-600";
  if (value <= 45) return "text-orange-500";
  if (value <= 55) return "text-ink-900";
  if (value <= 75) return "text-emerald-600";
  return "text-emerald-700";
}

// 카드 상단 타이틀 바 — Cobak: 밝은 헤더 + 그린 점 + 잉크 타이틀 (검은 바 폐지)
function CardHead({ title, meta }: { title: string; meta: string }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-white px-4 py-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
        <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
        {title}
      </h2>
      <span className="font-mono text-[10px] tracking-[0.12em] text-ink-500 uppercase">{meta}</span>
    </header>
  );
}

// 실시간 시세 · 도미넌스+환율 · 공포탐욕 3카드 — 홈/대시보드 공용
export default async function MarketCards() {
  const overview = await getMarketOverview();

  const latestFng = overview.fearGreed?.at(-1) ?? null;
  const fngSig = latestFng ? fngSignal(latestFng.classification) : null;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {/* 01 · 실시간 시세 (기존 김치프리미엄 카드 대체) */}
      <TickerTable />

      {/* 02 · BTC DOMINANCE(압축) + 환율 USD/KRW — 김치프리미엄 페이지와 공용 카드 */}
      <DominanceCard />

      {/* 03 · FEAR & GREED */}
      <section className="flex flex-col rounded-[6px] border border-line bg-white shadow-card transition-shadow hover:shadow-pop overflow-hidden">
        <CardHead title="Fear &amp; Greed" meta="Daily" />
        <div className="flex flex-1 flex-col p-5">
        {latestFng ? (
          <>
            <div className="flex flex-col items-center">
              <div className="w-full max-w-[220px]">
                <FngGauge value={latestFng.value} label={fngLabelKo(latestFng.classification)} />
              </div>
              {fngSig && (
                <span className={`mt-2 rounded px-2 py-1 text-[11px] font-semibold ${toneClass(fngSig.tone)}`}>
                  {fngSig.label}
                </span>
              )}
            </div>

            <div className="mt-4 grid grid-cols-6 gap-1.5">
              {overview.fearGreed!.slice(-7, -1).map((p) => {
                const d = new Date(p.date);
                return (
                  <div key={p.date} className="border border-line bg-paper px-1 py-1.5 text-center">
                    <p className="font-mono text-[10px] text-ink-300">
                      {d.getUTCMonth() + 1}/{d.getUTCDate()}
                    </p>
                    <p className={`mt-0.5 font-mono text-[13px] tabular-nums ${fngColor(p.value)}`}>{p.value}</p>
                  </div>
                );
              })}
            </div>
            <p className="mt-auto pt-3 font-mono text-[10px] tracking-[0.14em] text-navy-400 uppercase">
              지난 6일 · BTC 기준 ·{" "}
              <a
                href="https://alternative.me/crypto/fear-and-greed-index/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-dotted underline-offset-2 transition-colors hover:text-navy-600"
              >
                Alternative.me
              </a>
            </p>
          </>
        ) : (
          <p className="mt-4 text-sm text-ink-500">데이터를 불러오지 못했습니다.</p>
        )}
        </div>
      </section>
    </div>
  );
}
