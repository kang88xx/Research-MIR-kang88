import { prisma } from "@/lib/prisma";
import { getSignalRadar, getKrwMarketStats, getTrendLabels } from "@/lib/ticker";
import { getTodayListings, type Exchange, type Listing } from "@/lib/listings";
import { getExchangeListingSets, listingGapsFor, EX_KO } from "@/lib/exchange-listings";
import { radarChips, breadthSignal, type Signal, type SignalTone } from "@/lib/signals";
import { formatRelativeTime } from "@/lib/format";
import { upcomingKstRange } from "@/lib/time";
import SignalRadarBoard from "@/components/SignalRadarBoard";
import type { DrawerCoin } from "@/components/CoinDrawer";

// 모든 노출 거래소 한글명 (lib/exchange-listings의 EX_KO는 4곳뿐이라 별도 정의)
const EX_KO_ALL: Record<Exchange, string> = {
  Binance: "바이낸스",
  Upbit: "업비트",
  Bithumb: "빗썸",
  Bybit: "바이비트",
  Coinbase: "코인베이스",
  Robinhood: "로빈후드",
  OKX: "OKX",
};

// 오늘 상장 칩 — 거래소 + 유형(선물/현물/로드맵/상폐)을 구분해 라벨·톤을 만든다.
// 기존엔 무조건 "선물 상장"으로 오표기됐다(업비트 현물·코인베이스 로드맵 포함).
function listingChip(l: Listing): Signal {
  const ex = EX_KO_ALL[l.exchange] ?? l.exchange;
  const t = `${l.detail} ${l.text}`.toLowerCase();
  let kind = "상장";
  let tone: SignalTone = "note";
  if (/delist/.test(t)) {
    kind = "상폐";
    tone = "alert";
  } else if (/futures|perpetual|perp\b/.test(t)) {
    kind = "선물 상장";
    tone = "alert";
  } else if (/roadmap/.test(t)) {
    kind = "로드맵";
    tone = "note";
  } else if (/spot/.test(t)) {
    kind = "현물 상장";
    tone = "caution";
  }
  return { label: `${ex} ${kind}`, tone };
}

// "지금 봐야 할 코인" — 거래대금 상위 코인에 등락·김프·오늘 일정/상장 reason chip을 결합
export default async function SignalRadar() {
  const { startUtc, endUtc } = upcomingKstRange(1); // 오늘(KST)
  const [radar, stats, listings, todayEvents, trend, listingSets] = await Promise.all([
    getSignalRadar(),
    getKrwMarketStats(),
    getTodayListings(),
    // DB 정지(Neon 한도 초과 등) 시에도 레이더 자체는 떠야 하므로 일정 칩만 포기한다.
    prisma.calendarEvent
      .findMany({
        where: { date: { gte: startUtc, lt: endUtc } },
        select: { ticker: true },
      })
      .catch(() => []),
    getTrendLabels(),
    getExchangeListingSets(),
  ]);

  const eventTickers = new Set(todayEvents.map((e) => e.ticker.toUpperCase()));
  // 심볼 → 오늘 상장 항목 (첫 매칭). 거래소·유형 칩을 만들기 위해 Listing 자체를 보관.
  const listingBySym = new Map<string, Listing>();
  for (const l of listings.listings) {
    const s = l.symbol?.toUpperCase();
    if (s && !listingBySym.has(s)) listingBySym.set(s, l);
  }

  // 환율이 추정치(fallback)면 김프 신호가 가짜가 되므로 칩에서 제외한다.
  const fxEstimated = radar.usdKrwSource === "fallback";

  const items: DrawerCoin[] = radar.coins.slice(0, 10).map((coin) => {
    // 다른 메이저 거래소에 빠진 곳이 있으면 "○○ 상장 후보" 칩 (최대 2곳 표기)
    const gaps = listingGapsFor(coin.symbol, listingSets);
    const listingPotential = gaps.length
      ? gaps.slice(0, 2).map((e) => EX_KO[e]).join("·")
      : undefined;
    const lst = listingBySym.get(coin.symbol.toUpperCase());
    return {
      coin,
      chips: radarChips(coin, {
        event: eventTickers.has(coin.symbol.toUpperCase()),
        listing: lst ? listingChip(lst) : undefined,
        trend: trend[coin.symbol]?.label,
        listingPotential,
        fxEstimated,
      }),
    };
  });

  const hasBreadth = stats.total > 0;
  const breadth = hasBreadth
    ? { upPct: (stats.up / stats.total) * 100, signal: breadthSignal(stats.upRatio)! }
    : null;

  // 바이낸스 데이터가 실제로 있을 때만 출처에 표기 (다운 시 과장 방지)
  const source = radar.coins.some((c) => c.kimchi != null) ? "업비트·바이낸스" : "업비트";
  const freshness =
    radar.updatedAt === new Date(0).toISOString()
      ? "데이터 없음"
      : `${formatRelativeTime(radar.updatedAt)} · ${source}${fxEstimated ? " · 환율 추정" : ""}`;

  return <SignalRadarBoard items={items} breadth={breadth} freshness={freshness} />;
}
