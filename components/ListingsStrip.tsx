import { getTodayListings, type Exchange, type Listing } from "@/lib/listings";
import { EXCHANGE_LOGOS } from "@/lib/logos";
import { formatRelativeTime } from "@/lib/format";

const EPOCH = new Date(0).toISOString();

// 영문 피드 설명 → 국문 상장 유형 표기 (거래소명은 뱃지에 별도 노출)
function koDetail(l: Listing): string {
  const t = `${l.detail} ${l.text}`.toLowerCase();
  if (/roadmap/.test(t)) return "로드맵 추가";
  if (/futures|perpetual|perp\b/.test(t)) return "선물 상장";
  if (/spot/.test(t)) return "현물 상장";
  if (/delist/.test(t)) return "상장 폐지";
  return "상장 예정";
}

// HH:mm (KST)
function kstTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

// M/D HH:mm (KST) — 상장 예정 시각용
function kstDateTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${kstTime(iso)}`;
}

// 거래소 브랜드 색 (뱃지)
const EX_COLOR: Record<Exchange, string> = {
  Binance: "#b07d00", // amber
  Upbit: "#093687", // upbit navy
  Bithumb: "#f37321", // bithumb orange
  Bybit: "#c99400", // bybit gold
  Coinbase: "#1652f0", // coinbase blue
  Robinhood: "#069c1f", // robinhood green
  OKX: "#1a1a1a", // okx black
};

const DAY_MS = 24 * 3600_000;

// 상장 예정 시각이 지금부터 24시간 내(직전 2시간 포함)면 임박 → 빨간 강조
function isImminent(scheduledAt: string | null, now: number): boolean {
  if (!scheduledAt) return false;
  const diff = new Date(scheduledAt).getTime() - now;
  return diff <= DAY_MS && diff >= -2 * 3600_000;
}

// 금일 신규 상장 예정 피드 — @NewListingsFeed 채널 기반, 캘린더 상단 노출
export default async function ListingsStrip() {
  const { listings, updatedAt, ok } = await getTodayListings();
  // 서버 컴포넌트(요청마다 1회 렌더) — 상장 임박 판정용 현재시각. SSR이라 순수성 규칙 예외.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const freshness = ok && updatedAt !== EPOCH ? `${formatRelativeTime(updatedAt)} 수집` : null;

  return (
    <section className="rounded-xl border border-line bg-white shadow-card overflow-hidden transition-shadow hover:shadow-pop">
      <header className="title-band flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-baseline gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[#e5e4e2]"><span className="h-1.5 w-1.5 rounded-full bg-[#7e95a6]" aria-hidden />신규 상장·상폐 정보</h2>
          <span className="text-xs text-[#aeb9c2]">{listings.length}건 · 예정 시각(KST)</span>
        </div>
        {freshness && <span className="text-[10px] text-[#93a5b2]">{freshness}</span>}
      </header>

      {!ok ? (
        <p className="px-4 py-6 text-center text-xs text-ink-500">
          상장 정보를 불러오지 못했습니다. 잠시 후 자동으로 다시 시도합니다.
        </p>
      ) : listings.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-ink-500">
          오늘 신규 상장·상폐 소식이 아직 없습니다.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-x-3 gap-y-2 px-4 py-3">
          {listings.map((l) => {
            const imminent = isImminent(l.scheduledAt, now);
            const exColor = EX_COLOR[l.exchange];
            const body = (
              <>
                <span
                  className="flex shrink-0 items-center gap-1 rounded-sm border px-1 text-[10px] font-semibold"
                  style={{ color: exColor, borderColor: exColor }}
                >
                  {EXCHANGE_LOGOS.has(l.exchange) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/logos/exchanges/${l.exchange}.png`}
                      alt=""
                      width={12}
                      height={12}
                      className="rounded-[2px] object-contain"
                    />
                  )}
                  {l.exchange}
                </span>
                {l.symbol && (
                  <span
                    className={`px-1 font-mono text-[11px] font-semibold ${
                      imminent ? "bg-red-50 text-red-600" : "bg-paper2 text-navy-700"
                    }`}
                  >
                    ${l.symbol}
                  </span>
                )}
                <span className={`min-w-0 flex-1 truncate ${imminent ? "text-red-700" : "text-ink-700"}`}>
                  {koDetail(l)}
                </span>
                {l.scheduledAt ? (
                  <span
                    className={`shrink-0 font-mono text-[10px] font-semibold ${
                      imminent ? "text-red-600" : "text-navy-700"
                    }`}
                    title={`상장 예정 (한국시간) · 게시 ${kstTime(l.date)} KST`}
                  >
                    {kstDateTime(l.scheduledAt)} KST
                  </span>
                ) : (
                  <span
                    className="shrink-0 font-mono text-[10px] text-ink-400"
                    title={`상장 시각 미확인 · 게시 ${kstTime(l.date)} KST`}
                  >
                    미정
                  </span>
                )}
              </>
            );
            const tileCls = `flex items-center gap-1.5 border px-2 py-1 text-xs min-w-0 max-w-full ${
              imminent
                ? "border-red-500 bg-red-50"
                : "border-line bg-paper hover:border-navy-300"
            }`;
            return (
              <li key={l.id} className="max-w-full">
                {l.url ? (
                  <a href={l.url} target="_blank" rel="noopener noreferrer" className={tileCls}>
                    {body}
                  </a>
                ) : (
                  <span className={tileCls}>{body}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
