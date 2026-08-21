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

// 5구간 존 게이지 — 데일리 스탠스 게이지와 동일한 세그먼트 문법 (kimchiZone 경계와 1:1)
const ZONES: { key: KimchiZone["tone"]; label: string }[] = [
  { key: "deep-discount", label: "심한 역프" },
  { key: "discount", label: "역프" },
  { key: "neutral", label: "중립" },
  { key: "premium", label: "프리미엄" },
  { key: "overheat", label: "과열" },
];

// 김치프리미엄 히어로 — E7B(K2) 확정안: 좌 헤드라인+존 게이지 / 우 7일 추이+핵심 수치
export default async function KimchiHero() {
  const o = await getKimchiOverview();
  const zone = kimchiZone(o.usdtKimchi);
  const color = toneColor(zone.tone);
  const zoneIdx = o.usdtKimchi != null ? ZONES.findIndex((z) => z.key === zone.tone) : -1;

  const fxIsEstimate = o.usdKrwSource === "fallback";

  return (
    <section className="overflow-hidden rounded-[6px] border border-line bg-white">
      <div className="grid grid-cols-1 gap-y-6 px-6 py-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-x-8">
        {/* ① 헤드라인 — 테더 김프 + 존 게이지 */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="text-[11px] font-medium text-ink-500">테더(USDT) 김치프리미엄</p>
            <span className="ml-auto text-[10px] text-navy-300">
              {o.updatedAt !== new Date(0).toISOString()
                ? `${formatRelativeTime(o.updatedAt)} · 업비트·바이낸스·환율`
                : "데이터 없음"}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
            <span
              className="font-mono text-[42px] font-semibold leading-none tracking-[-0.03em] tabular-nums"
              style={{ color }}
            >
              {pctText(o.usdtKimchi)}
            </span>
            <span className="text-[15px] font-bold" style={{ color }}>
              {zone.label}
            </span>
          </div>
          <p className="mt-2 text-[12.5px] leading-[1.75] text-ink-500">{zone.desc}</p>

          <div className="mt-[18px] flex gap-[3px]" aria-label={`김프 5구간 중 ${zone.label}`}>
            {ZONES.map((z, i) => (
              <i
                key={z.key}
                className="h-[7px] flex-1 rounded-[3px]"
                style={{ background: i === zoneIdx ? color : "var(--color-paper2)" }}
              />
            ))}
          </div>
          <div className="mt-1.5 flex text-[10.5px] text-ink-400">
            {ZONES.map((z, i) => (
              <span
                key={z.key}
                className="flex-1 text-center"
                style={i === zoneIdx ? { color, fontWeight: 700, fontSize: "12px" } : undefined}
              >
                {z.label}
              </span>
            ))}
          </div>
        </div>

        {/* ② 7일 추이(클릭 → 일간·주간·월간 팝업) + 핵심 수치 */}
        <div className="flex min-w-0 flex-col gap-4 lg:border-l lg:border-hairline lg:pl-8">
          <KimchiTrendPopup history={o.history} />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-hairline pt-3.5 sm:grid-cols-4">
            <div>
              <dt className="text-[10px] text-ink-500">BTC 김프</dt>
              <dd
                className="mt-0.5 font-mono text-[14px] font-semibold tabular-nums"
                style={{ color: toneColor(kimchiZone(o.btcKimchi).tone) }}
              >
                {pctText(o.btcKimchi)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] text-ink-500">BTC 국내가</dt>
              <dd className="mt-0.5 font-mono text-[14px] font-semibold tabular-nums text-navy-900">
                {o.btcKrw != null ? `${Math.round(o.btcKrw / 1e4).toLocaleString("ko-KR")}만원` : "–"}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] text-ink-500">테더(USDT)</dt>
              <dd className="mt-0.5 font-mono text-[14px] font-semibold tabular-nums text-navy-900">
                {o.usdtKrw != null ? `${Math.round(o.usdtKrw).toLocaleString("ko-KR")}원` : "–"}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] text-ink-500">환율 USD/KRW</dt>
              <dd className="mt-0.5 font-mono text-[14px] font-semibold tabular-nums text-navy-900">
                {o.usdKrw != null ? o.usdKrw.toLocaleString("ko-KR", { maximumFractionDigits: 1 }) : "–"}
                {fxIsEstimate && <span className="ml-1 text-[10px] font-medium text-up">추정</span>}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <p className="border-t border-line px-6 py-2">
        <span className="rail">
          테더 김프 = 업비트 KRW-USDT ÷ 환율 · BTC 김프 = 업비트 ÷ (바이낸스 × 환율)
          {fxIsEstimate && <span className="text-up"> · ⚠ 환율 추정 — 정확도 주의</span>}
        </span>
      </p>
    </section>
  );
}
