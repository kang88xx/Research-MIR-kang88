import { getKimchiOverview, kimchiZone, type KimchiZone } from "@/lib/kimchi";
import { formatRelativeTime } from "@/lib/format";
import KimchiTrendPopup from "@/components/KimchiTrendPopup";

// 김프 상태 톤 → 색 (한국식: 프리미엄=레드 / 역프=블루).
// CSS 토큰 참조로 다크 모드 자동 전환 — 하드코딩 hex는 다크 표면에서 헤드라인이 묻힌다(P2).
function toneColor(tone: KimchiZone["tone"]): string {
  switch (tone) {
    case "deep-discount":
    case "discount":
      return "var(--color-down)";
    case "premium":
    case "overheat":
      return "var(--color-up)";
    default:
      return "var(--color-neutral)";
  }
}

function pctText(n: number | null, digits = 2): string {
  return n != null ? `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%` : "–";
}

// 게이지 스케일 — 역프 -3% ~ 과열 +5% (실무에서 김프가 주로 움직이는 범위)
const GAUGE_MIN = -3;
const GAUGE_MAX = 5;

// 김치프리미엄 히어로 — 현재 시장 상태를 한눈에: 헤드라인 김프 + 상태 게이지 + 핵심 수치 + 7일 추이
export default async function KimchiHero() {
  const o = await getKimchiOverview();
  const zone = kimchiZone(o.usdtKimchi);
  const color = toneColor(zone.tone);
  const gaugePos =
    o.usdtKimchi != null
      ? Math.min(100, Math.max(0, ((o.usdtKimchi - GAUGE_MIN) / (GAUGE_MAX - GAUGE_MIN)) * 100))
      : null;

  const fxIsEstimate = o.usdKrwSource === "fallback";

  return (
    <section className="overflow-hidden rounded-[6px] border border-line bg-white">
      <header className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
        <h2 className="text-sm font-semibold text-navy-900">김치프리미엄 시장 현황</h2>
        <span className="eyebrow hidden sm:inline">Kimchi Premium Overview</span>
        <span className="ml-auto text-[10px] text-navy-300">
          {o.updatedAt !== new Date(0).toISOString()
            ? `${formatRelativeTime(o.updatedAt)} · 업비트·바이낸스·환율`
            : "데이터 없음"}
        </span>
      </header>

      <div className="grid grid-cols-1 gap-x-8 gap-y-6 px-5 py-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        {/* ① 헤드라인 — 테더 김프 + 상태 게이지 */}
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-ink-500">테더(USDT) 김치프리미엄</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span
              className="font-mono text-[34px] font-semibold leading-none tracking-[-0.02em] tabular-nums"
              style={{ color }}
            >
              {pctText(o.usdtKimchi)}
            </span>
            <span className="text-[14px] font-bold" style={{ color }}>
              {zone.label}
            </span>
          </div>
          <p className="mt-1.5 text-[11.5px] leading-[1.55] text-ink-500">{zone.desc}</p>

          {/* 게이지 — 역프(블루) ↔ 과열(레드), 현재 위치 마커 */}
          <div className="mt-3">
            <div
              className="relative h-[8px] rounded-[4px]"
              style={{
                background:
                  "linear-gradient(90deg,var(--color-down) 0%,var(--color-down-bg) 34%,var(--color-line) 42%,var(--color-line) 55%,var(--color-up-bg) 68%,var(--color-up) 100%)",
              }}
            >
              {gaugePos != null && (
                <span
                  className="absolute -top-[3px] h-[14px] w-[3px] -translate-x-1/2 rounded-[2px] bg-navy-900"
                  style={{ left: `${gaugePos}%` }}
                />
              )}
            </div>
            <div className="mt-1 flex justify-between font-mono text-[9px] font-medium text-ink-400">
              <span>-3% 역프</span>
              <span>0%</span>
              <span>+5% 과열</span>
            </div>
          </div>
        </div>

        {/* ② 핵심 수치 — BTC 김프 · 테더 시세 · 환율 */}
        <dl className="grid min-w-0 grid-cols-2 content-start gap-x-4 gap-y-4 lg:border-l lg:border-line lg:pl-8">
          <div>
            <dt className="text-[11px] text-ink-500">BTC 김프</dt>
            <dd
              className="mt-0.5 font-mono text-[17px] font-semibold tabular-nums"
              style={{ color: toneColor(kimchiZone(o.btcKimchi).tone) }}
            >
              {pctText(o.btcKimchi)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-ink-500">BTC 국내가</dt>
            <dd className="mt-0.5 font-mono text-[17px] font-semibold tabular-nums text-navy-900">
              {o.btcKrw != null ? `${Math.round(o.btcKrw / 1e4).toLocaleString("ko-KR")}만원` : "–"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-ink-500">테더(USDT)</dt>
            <dd className="mt-0.5 font-mono text-[17px] font-semibold tabular-nums text-navy-900">
              {o.usdtKrw != null ? `${Math.round(o.usdtKrw).toLocaleString("ko-KR")}원` : "–"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-ink-500">환율 USD/KRW</dt>
            <dd className="mt-0.5 font-mono text-[17px] font-semibold tabular-nums text-navy-900">
              {o.usdKrw != null ? o.usdKrw.toLocaleString("ko-KR", { maximumFractionDigits: 1 }) : "–"}
              {fxIsEstimate && <span className="ml-1 text-[10px] font-medium text-red-600">추정</span>}
            </dd>
          </div>
        </dl>

        {/* ③ 최근 7일 USDT 김프 추이 — 클릭 시 일간·주간·월간 레이어 팝업 */}
        <div className="min-w-0 lg:border-l lg:border-line lg:pl-8">
          <KimchiTrendPopup history={o.history} />
        </div>
      </div>

      <p className="border-t border-line px-5 py-2">
        <span className="rail">
          테더 김프 = 업비트 KRW-USDT ÷ 환율 · BTC 김프 = 업비트 ÷ (바이낸스 × 환율)
          {fxIsEstimate && <span className="text-red-600"> · ⚠ 환율 추정 — 정확도 주의</span>}
        </span>
      </p>
    </section>
  );
}
