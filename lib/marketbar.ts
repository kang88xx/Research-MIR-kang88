import { cachedJson } from "@/lib/cache";
import { fetchJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { kstDay } from "@/lib/time";
import { getTickers, getExchangeComparison } from "@/lib/ticker";
import { getFxHistory, getMarketOverview, type MarketOverview } from "@/lib/market";

// 비트코인 평균 채굴원가 (USD) — 폴백 상수. 실제 값은 /api/cron/mining-cost 크론이 6시간마다
// blockchain.info 해시레이트 기반으로 계산해 marketCache("btcMiningCost")에 적재하고, 아래에서 읽는다.
const BTC_MINING_AVG_COST_USD = 71_900;

// ISO 시각 → KST "M/D" (업데이트 날짜 표기용)
function kstMonthDay(iso: string): string {
  const [, mm, dd] = kstDay(new Date(iso)).split("-");
  return `${Number(mm)}/${Number(dd)}`;
}

// 크론이 적재한 채굴원가 + 갱신 시각을 읽음 (없으면 폴백 상수)
async function getStoredMiningCost(): Promise<{ costUsd: number; updatedAt: string | null }> {
  try {
    const row = await prisma.marketCache.findUnique({
      where: { key: "btcMiningCost" },
      select: { data: true, updatedAt: true },
    });
    const d = row?.data as { costUsd?: number; updatedAt?: string } | undefined;
    const c = d?.costUsd;
    return {
      costUsd: typeof c === "number" && c > 0 ? c : BTC_MINING_AVG_COST_USD,
      updatedAt: d?.updatedAt ?? row?.updatedAt?.toISOString() ?? null,
    };
  } catch {
    return { costUsd: BTC_MINING_AVG_COST_USD, updatedAt: null };
  }
}

// 상단 마켓바 — 주가지수·원자재 미니차트 타일 (나스닥·코스피·코스닥·금) + 코인·MSTR 행
export type BarStock = {
  label: string;
  value: string; // 표시용 포맷된 값
  changePct: number | null;
};
// MSTR 비트코인 트레저리 — 보유량·평단가·현재 수익률
export type BarTreasury = {
  holdings: number; // 보유 BTC
  holdingsDelta: number; // 전날 대비 보유량 변동 (BTC, 0이면 변동 없음)
  avgPriceUsd: number; // 평단가 (USD)
  returnPct: number | null; // 현재 수익률 % (BTC 현재가 대비 평단)
};
// 공포·탐욕 지수 (alternative.me) — 현재값 + 최근 6일
export type FngDay = { date: string; value: number }; // date: "M/D"
export type BarFng = {
  value: number; // 0~100
  label: string; // 한글 분류 (극단적 공포 등)
  history: FngDay[]; // 과거→현재 순 6일
};
// 테더(USDT) 김프 타일 — 현재 김프(헤드라인) + 6일 변동성 + 테더(원)·환율 보조
export type BarUsdt = {
  tetherKrw: number | null; // 업비트 테더 시세(원)
  tetherKimchi: number | null; // 현재 테더 김프(%) — 헤드라인
  usdKrw: number | null; // 환율 USD/KRW (보조)
  fxChangePct: number | null; // 환율 전일 대비(%)
  kimchiSpark: number[]; // 최근 6일(일봉) 김프(%) 시리즈 — 변동성 표시
};
// 환율 USD/KRW 타일 — 현재값(+변동) + 6일 추이
export type FxDay = { date: string; rate: number }; // date: "M/D"
export type BarFx = { fx6: FxDay[] }; // 최근 6일
// 비트코인 채굴 손익분기점 — 평균 채굴원가(= 손익분기 가격) + 원가/가격 비율
export type BarMining = {
  pricePct: number | null; // 손익분기 대비 현재가 등락(%) — 양수=채굴 이익, 음수=채굴 손실
};
export type BarTile = {
  key: string;
  label: string;
  value: string; // 표시용 포맷된 값
  changePct: number | null;
  spark: number[]; // 미니 스파크라인 시리즈
  stocks?: BarStock[]; // 대표 종목 2개 (나스닥·코스피 한정)
  group?: "index" | "crypto" | "macro"; // 표시 행 구분 (1행: 지수·금 / 2행: 코인·MSTR·공포탐욕 / 3행: 도미넌스 등)
  market?: "us" | "kr" | "gold" | "crypto"; // 장중/장마감 판별용 시장 구분
  treasury?: BarTreasury; // MSTR 비트코인 트레저리 정보
  fng?: BarFng; // 공포·탐욕 지수 타일
  barPct?: number; // 0~100 채움 막대 (도미넌스 등 비율 지표)
  dom6?: { date: string; value: number }[]; // 도미넌스 등 6일 추세 (date: "M/D", value: %)
  usdt?: BarUsdt; // USDT 압축 카드 (도미넌스+테더+환율)
  fx?: BarFx; // 환율 USD/KRW 타일 (6일 추이)
  mining?: BarMining; // 비트코인 채굴 손익분기점
  sub?: string; // 값 위 작은 보조 캡션 (예: 업데이트 날짜)
  note?: string; // 자리표시자 보조 문구 (예: 지표 찾는중…)
  placeholder?: boolean; // 미정 타일 (고민중) — fng 수신 실패 시 폴백
};
export type MarketBarData = { tiles: BarTile[]; updatedAt: string };

const TTL_MS = 5 * 60_000;

// ── Yahoo Finance (지수·원자재·환율) — 값 + 전일종가 + 스파크라인 ──
async function fetchYahooSeries(
  symbol: string
): Promise<{ price: number; prev: number; spark: number[] } | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        symbol
      )}?interval=1d&range=1mo`,
      {
        signal: AbortSignal.timeout(6000),
        cache: "no-store",
        headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      }
    );
    if (!res.ok) return null;
    const d = (await res.json()) as {
      chart?: {
        result?: {
          meta?: { regularMarketPrice?: number; chartPreviousClose?: number };
          indicators?: { quote?: { close?: (number | null)[] }[] };
        }[];
      };
    };
    const r = d?.chart?.result?.[0];
    const price = r?.meta?.regularMarketPrice;
    if (typeof price !== "number" || !Number.isFinite(price)) return null;
    const closes = (r?.indicators?.quote?.[0]?.close ?? []).filter(
      (c): c is number => typeof c === "number" && Number.isFinite(c)
    );
    // 일간 변동: 직전 거래일 종가 사용 (range=1mo의 chartPreviousClose는 한 달 전이라 부정확)
    const prevRaw = r?.meta?.chartPreviousClose;
    const prev =
      closes.length >= 2
        ? closes[closes.length - 2]
        : typeof prevRaw === "number" && prevRaw > 0
        ? prevRaw
        : price;
    return { price, prev, spark: closes.slice(-24) };
  } catch {
    return null;
  }
}


// 표시 대상 — 나스닥·코스피·코스닥·금 (그 외 지표·코인 타일 제거)
const YAHOO: { key: string; label: string; symbol: string; prefix?: string; digits?: number }[] = [
  { key: "nasdaq", label: "나스닥", symbol: "^IXIC", digits: 2 },
  { key: "kospi", label: "코스피", symbol: "^KS11", digits: 2 },
  { key: "kosdaq", label: "코스닥", symbol: "^KQ11", digits: 2 },
  { key: "gold", label: "금(Gold)", symbol: "GC=F", prefix: "$", digits: 1 },
];

// 타일별 대표 종목 2개 — 나스닥(애플·엔비디아) / 코스피(삼성전자·SK하이닉스)
const STOCKS: Record<string, { label: string; symbol: string; prefix?: string; digits?: number }[]> = {
  nasdaq: [
    { label: "코인베이스", symbol: "COIN", prefix: "$", digits: 2 },
    { label: "엔비디아", symbol: "NVDA", prefix: "$", digits: 2 },
  ],
  kospi: [
    { label: "삼성전자", symbol: "005930.KS", digits: 0 },
    { label: "SK하이닉스", symbol: "000660.KS", digits: 0 },
  ],
};

// 2행 코인(BTC·ETH) — Binance 일봉(공식 API)으로 값·전일·스파크 수신. Yahoo 의존 제거.
const BINANCE_COINS: { key: string; label: string; symbol: string; prefix?: string; digits?: number }[] = [
  { key: "btc", label: "비트코인", symbol: "BTCUSDT", prefix: "$", digits: 0 },
  { key: "eth", label: "이더리움", symbol: "ETHUSDT", prefix: "$", digits: 0 },
];

// 2행 MSTR(스트래티지) — Yahoo 주가 (코인과 달리 무료 대체 소스가 마땅치 않음).
const ROW2: {
  key: string;
  label: string;
  symbol: string;
  prefix?: string;
  digits?: number;
  market: "crypto" | "us";
}[] = [{ key: "mstr", label: "MSTR(스트래티지)", symbol: "MSTR", prefix: "$", digits: 2, market: "us" }];

// Binance 일봉 — 종가 시리즈에서 현재가·전일종가·스파크라인 추출
async function fetchBinanceDaily(
  symbol: string
): Promise<{ price: number; prev: number; spark: number[] } | null> {
  try {
    const rows = await fetchJson<(string | number)[][]>(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=30`,
      7000
    );
    const closes = rows
      .map((r) => parseFloat(String(r[4])))
      .filter((n) => Number.isFinite(n));
    if (closes.length < 2) return null;
    return { price: closes[closes.length - 1], prev: closes[closes.length - 2], spark: closes.slice(-24) };
  } catch {
    return null;
  }
}

// ── MSTR(스트래티지) 비트코인 보유량·평단가 — 코인게코 기업 트레저리 공개 데이터 ──
type CgTreasuryCompany = {
  name: string;
  symbol: string;
  total_holdings: number;
  total_entry_value_usd: number;
};

// 전날 대비 보유량 변동 — DB(marketCache)에 일자별 기준값을 굳혀 KST 하루 단위로 비교.
type HoldingsBaseline = { day: string; today: number; prevDay: number };

async function rollHoldingsBaseline(current: number): Promise<number> {
  const today = kstDay();
  let rec: HoldingsBaseline | null = null;
  try {
    const row = await prisma.marketCache.findUnique({
      where: { key: "mstrBtcBaseline" },
      select: { data: true },
    });
    const d = row?.data as Partial<HoldingsBaseline> | undefined;
    if (d && typeof d.today === "number" && typeof d.prevDay === "number" && typeof d.day === "string") {
      rec = { day: d.day, today: d.today, prevDay: d.prevDay };
    }
  } catch {
    // DB 조회 실패 → 기준값 없이 변동 0 처리
  }

  let next: HoldingsBaseline;
  if (!rec) {
    next = { day: today, today: current, prevDay: current };
  } else if (rec.day === today) {
    // 같은 날 재갱신 — 전일 기준은 유지하고 당일 최신값만 반영
    next = { day: today, today: current, prevDay: rec.prevDay };
  } else {
    // 새 날 — 어제 마지막 보유량을 '전일' 기준으로 굳힘
    next = { day: today, today: current, prevDay: rec.today };
  }

  const changed =
    !rec || rec.day !== next.day || rec.today !== next.today || rec.prevDay !== next.prevDay;
  if (changed) {
    try {
      await prisma.marketCache.upsert({
        where: { key: "mstrBtcBaseline" },
        update: { data: next as object },
        create: { key: "mstrBtcBaseline", data: next as object },
      });
    } catch {
      // 기록 실패해도 표시는 진행
    }
  }
  return next.today - next.prevDay;
}

// ── 공포·탐욕 지수 — getMarketOverview(5분 캐시)의 alternative.me 데이터 재사용 ──
// (과거엔 여기서 alternative.me를 별도 5분 캐시로 한 번 더 호출 — 일 1회 갱신 지표에
//  중복 288콜/일이라 overview 캐시 1벌로 통합. codex 교차검수 2026-08-03)

// 영문 분류 → 한글
function fngLabelKo(cls: string, value: number): string {
  const c = cls.toLowerCase();
  if (c.includes("extreme") && c.includes("fear")) return "극단적 공포";
  if (c.includes("fear")) return "공포";
  if (c.includes("extreme") && c.includes("greed")) return "극단적 탐욕";
  if (c.includes("greed")) return "탐욕";
  if (c.includes("neutral")) return "중립";
  // 분류 누락 시 값으로 추정
  if (value < 25) return "극단적 공포";
  if (value < 45) return "공포";
  if (value < 55) return "중립";
  if (value < 75) return "탐욕";
  return "극단적 탐욕";
}

// overview.fearGreed(과거→현재 순 최대 30일)에서 타일 데이터(현재값 + 직전 6일) 구성
function fngFromOverview(fg: MarketOverview["fearGreed"]): BarFng | null {
  if (!fg || fg.length === 0) return null;
  const cur = fg[fg.length - 1];
  if (!Number.isFinite(cur.value)) return null;
  const history: FngDay[] = fg
    .slice(-7, -1) // 현재 제외 직전 6일
    .map((d) => {
      const dt = new Date(d.date);
      return { date: `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}`, value: d.value };
    })
    .filter((d) => Number.isFinite(d.value)); // 잘못된 값(NaN)이 스파크라인/색상에 들어가지 않도록
  return { value: cur.value, label: fngLabelKo(cur.classification, cur.value), history };
}

// ── 테더(USDT) 김프 6일 변동성 — 업비트 KRW-USDT 일봉 종가 ÷ 환율 ──
// 업비트 일봉(최신→과거) 종가를 과거→최신 순으로 반환. 실패 시 빈 배열.
// marketbar(5분)·kimchiOverview(5분)가 각자 호출하던 것을 DB 캐시 1벌(15분)로 공유 —
// 일봉 데이터라 15분이면 충분하고 업비트 중복 호출(일 ~576콜)을 절반 이하로 줄인다.
async function fetchUsdtDailyClosesRaw(): Promise<{ date: string; close: number }[]> {
  const rows = await fetchJson<{ candle_date_time_kst: string; trade_price: number }[]>(
    "https://api.upbit.com/v1/candles/days?market=KRW-USDT&count=8",
    7000
  );
  if (!Array.isArray(rows)) throw new Error("upbit USDT candles malformed"); // 캐시 보존
  return rows
    .map((r) => ({ date: r.candle_date_time_kst.slice(0, 10), close: r.trade_price }))
    .filter((d) => Number.isFinite(d.close) && d.close > 0)
    .reverse();
}

export async function fetchUsdtDailyCloses(): Promise<{ date: string; close: number }[]> {
  try {
    return await cachedJson("usdtDaily:v1", 15 * 60_000, fetchUsdtDailyClosesRaw);
  } catch {
    return [];
  }
}

// 일봉 테더 종가 + 환율 6일치를 날짜로 맞춰 김프(%) 시리즈 구성 (최근 6일).
// 환율은 대상일 이하 중 가장 최근 값을 사용 — 주말엔 직전 영업일 환율로 대체된다.
function buildKimchiSeries(
  daily: { date: string; close: number }[],
  fxHistory: { date: string; rate: number }[]
): number[] {
  if (daily.length === 0) return [];
  const fxSorted = fxHistory.filter((p) => p.rate > 0).sort((a, b) => a.date.localeCompare(b.date));
  if (fxSorted.length === 0) return [];
  const fxFor = (date: string): number => {
    let rate = fxSorted[0].rate;
    for (const p of fxSorted) if (p.date <= date) rate = p.rate;
    return rate;
  };
  return daily.map((d) => (d.close / fxFor(d.date) - 1) * 100).slice(-6);
}

// BTC 도미넌스 — marketSnapshot(5분 간격 기록)에서 현재값 + KST 일자별 6일 추세.
// TradingView는 무료 이력이 없어, 이미 누적된 스냅샷으로 추세를 구성(현재값도 동일 소스라 일관).
async function fetchBtcDominanceSeries(): Promise<{
  current: number | null;
  trend6: { date: string; value: number }[];
}> {
  try {
    const since = new Date(Date.now() - 7 * 24 * 3600_000);
    const rows = await prisma.marketSnapshot.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, btcDominance: true },
    });
    if (rows.length === 0) return { current: null, trend6: [] };
    // KST 일자별 마지막 값 (asc 정렬이라 같은 날은 뒤가 덮어씀)
    const byDay = new Map<string, number>();
    for (const r of rows) byDay.set(kstDay(r.createdAt), r.btcDominance);
    const trend6 = [...byDay.entries()].slice(-6).map(([day, value]) => {
      const [, mm, dd] = day.split("-");
      return { date: `${Number(mm)}/${Number(dd)}`, value };
    });
    const current = rows[rows.length - 1].btcDominance;
    return { current, trend6 };
  } catch {
    return { current: null, trend6: [] };
  }
}

async function fetchMstrTreasury(btcUsd: number | null): Promise<BarTreasury | null> {
  try {
    const d = await fetchJson<{ companies?: CgTreasuryCompany[] }>(
      "https://api.coingecko.com/api/v3/companies/public_treasury/bitcoin",
      7000
    );
    const c = d.companies?.find(
      (x) => x.symbol?.toUpperCase().startsWith("MSTR") || /strategy|microstrategy/i.test(x.name)
    );
    if (!c || !(c.total_holdings > 0)) return null;
    const avgPriceUsd = c.total_entry_value_usd > 0 ? c.total_entry_value_usd / c.total_holdings : 0;
    const holdingsDelta = await rollHoldingsBaseline(c.total_holdings);
    return {
      holdings: c.total_holdings,
      holdingsDelta,
      avgPriceUsd,
      returnPct: btcUsd != null && avgPriceUsd > 0 ? (btcUsd / avgPriceUsd - 1) * 100 : null,
    };
  } catch {
    return null;
  }
}

async function fetchMarketBar(): Promise<MarketBarData> {
  // 지수·원자재 + 대표 종목을 한 번에 병렬 호출
  const stockDefs = Object.entries(STOCKS).flatMap(([tileKey, arr]) =>
    arr.map((s) => ({ tileKey, ...s }))
  );
  const [yh, st, r2, coins] = await Promise.all([
    Promise.all(YAHOO.map((y) => fetchYahooSeries(y.symbol))),
    Promise.all(stockDefs.map((s) => fetchYahooSeries(s.symbol))),
    Promise.all(ROW2.map((c) => fetchYahooSeries(c.symbol))),
    Promise.all(BINANCE_COINS.map((c) => fetchBinanceDaily(c.symbol))), // BTC·ETH (Binance)
  ]);

  // MSTR 트레저리 수익률 계산용 BTC 현재가(USD) — Binance BTC 결과 재사용
  const btcUsd = coins[BINANCE_COINS.findIndex((c) => c.key === "btc")]?.price ?? null;
  const [treasury, fng, btcDom, usdtDaily, tickerSnap, exchanges, fxHistory, miningInfo] =
    await Promise.all([
      fetchMstrTreasury(btcUsd),
      getMarketOverview().then((o) => fngFromOverview(o.fearGreed)),
      fetchBtcDominanceSeries(), // BTC 도미넌스 현재값 + 6일 추세 (marketSnapshot)
      fetchUsdtDailyCloses(), // 테더(USDT) 일봉 종가 — 김프 6일 변동성용
      getTickers(), // 김치프리미엄(BTC) + 환율 출처
      getExchangeComparison(), // 테더(USDT) 업비트 시세
      getFxHistory(), // 환율 USD/KRW 6일 추이
      getStoredMiningCost(), // 크론 적재 채굴원가 + 갱신 시각
    ]);
  const btcDominance = btcDom.current;
  const miningCost = miningInfo.costUsd;
  const miningUpdatedAt = miningInfo.updatedAt;
  // USDT/환율 데이터 — 테더(원)·김프 + 환율·변동 + 환율 시리즈(미니차트 / 6일 추이)
  const usdtKrw = exchanges.usdtUpbit ?? null;
  const usdKrw = tickerSnap.usdKrw > 0 ? tickerSnap.usdKrw : null;
  const usdtKimchi = usdtKrw != null && usdKrw != null ? (usdtKrw / usdKrw - 1) * 100 : null;
  const kimchiSpark = buildKimchiSeries(usdtDaily, fxHistory); // 최근 6일 김프 변동성
  const fxRates = fxHistory.map((p) => p.rate).filter((r) => r > 0);
  const fxChangePct =
    fxRates.length >= 2 ? (fxRates[fxRates.length - 1] / fxRates[fxRates.length - 2] - 1) * 100 : null;
  const fx6: FxDay[] = fxHistory
    .filter((p) => p.rate > 0)
    .slice(-6)
    .map((p) => {
      const d = new Date(p.date);
      return { date: `${d.getUTCMonth() + 1}/${d.getUTCDate()}`, rate: p.rate };
    });

  // 종목 결과를 타일 키별로 묶기
  const stocksByTile: Record<string, BarStock[]> = {};
  stockDefs.forEach((s, i) => {
    const r = st[i];
    if (!r) return;
    (stocksByTile[s.tileKey] ??= []).push({
      label: s.label,
      value: `${s.prefix ?? ""}${r.price.toLocaleString(undefined, { maximumFractionDigits: s.digits ?? 2 })}`,
      changePct: r.prev > 0 ? ((r.price - r.prev) / r.prev) * 100 : null,
    });
  });

  const tiles: BarTile[] = [];
  YAHOO.forEach((y, i) => {
    const r = yh[i];
    if (!r) return;
    tiles.push({
      key: y.key,
      label: y.label,
      value: `${y.prefix ?? ""}${r.price.toLocaleString(undefined, { maximumFractionDigits: y.digits ?? 2 })}`,
      changePct: r.prev > 0 ? ((r.price - r.prev) / r.prev) * 100 : null,
      spark: r.spark,
      stocks: stocksByTile[y.key],
      group: "index",
    });
  });

  // 2행 코인 — BTC·ETH (Binance)
  BINANCE_COINS.forEach((c, i) => {
    const r = coins[i];
    if (!r) return;
    tiles.push({
      key: c.key,
      label: c.label,
      value: `${c.prefix ?? ""}${r.price.toLocaleString(undefined, { maximumFractionDigits: c.digits ?? 2 })}`,
      changePct: r.prev > 0 ? ((r.price - r.prev) / r.prev) * 100 : null,
      spark: r.spark,
      group: "crypto",
      market: "crypto",
    });
  });

  // 2행 MSTR (Yahoo) — 개별 실패는 건너뜀
  ROW2.forEach((c, i) => {
    const r = r2[i];
    if (!r) return;
    tiles.push({
      key: c.key,
      label: c.label,
      value: `${c.prefix ?? ""}${r.price.toLocaleString(undefined, { maximumFractionDigits: c.digits ?? 2 })}`,
      changePct: r.prev > 0 ? ((r.price - r.prev) / r.prev) * 100 : null,
      spark: r.spark,
      group: "crypto",
      market: c.market,
      treasury: c.key === "mstr" ? treasury ?? undefined : undefined,
    });
  });

  // 4번째 칸 — 공포·탐욕 지수 (수신 실패 시 자리표시자 폴백)
  tiles.push({
    key: "fng",
    label: "공포·탐욕 지수",
    value: "",
    changePct: null,
    spark: [],
    group: "crypto",
    fng: fng ?? undefined,
    placeholder: !fng,
  });

  // 3행 — 테더(USDT) 김프 · BTC 도미넌스 · 채굴 손익분기점 · 환율
  tiles.push({
    key: "usdtKimchi",
    label: "테더(USDT) 김프",
    value: usdtKimchi != null ? `${usdtKimchi >= 0 ? "+" : ""}${usdtKimchi.toFixed(2)}%` : "-",
    changePct: null,
    spark: [],
    group: "macro",
    usdt: {
      tetherKrw: usdtKrw,
      tetherKimchi: usdtKimchi,
      usdKrw,
      fxChangePct,
      kimchiSpark,
    },
    placeholder: usdtKimchi == null,
  });
  tiles.push({
    key: "btcDom",
    label: "BTC 도미넌스",
    value: btcDominance != null ? `${btcDominance.toFixed(2)}%` : "-",
    changePct: null,
    spark: [],
    group: "macro",
    dom6: btcDom.trend6.length > 0 ? btcDom.trend6 : undefined,
    barPct: btcDom.trend6.length > 0 ? undefined : btcDominance ?? undefined, // 이력 없으면 막대 폴백
    placeholder: btcDominance == null,
  });
  tiles.push({
    key: "btcBreakeven",
    label: "비트코인 채굴 손익분기점",
    value: `$${Math.round(miningCost).toLocaleString()}`,
    changePct: null,
    spark: [],
    group: "macro",
    sub: miningUpdatedAt ? `업데이트 ${kstMonthDay(miningUpdatedAt)}` : undefined,
    mining: {
      pricePct: btcUsd && btcUsd > 0 ? (btcUsd / miningCost - 1) * 100 : null,
    },
  });
  tiles.push({
    key: "fx",
    label: "환율 USD/KRW",
    value: usdKrw != null ? usdKrw.toLocaleString("ko-KR", { maximumFractionDigits: 2 }) : "-",
    changePct: fxChangePct,
    spark: [],
    group: "macro",
    fx: { fx6 },
    placeholder: usdKrw == null || fx6.length === 0,
  });

  // 인덱스(Yahoo)가 전부 실패해도 코인·매크로 타일이 있으면 바를 그린다.
  // 의미 있는(플레이스홀더가 아닌) 타일이 하나도 없을 때만 실패 처리해 캐시를 건너뛴다.
  // 주의: btcBreakeven 타일은 폴백 상수 덕에 항상 non-placeholder라 판정에서 제외 —
  // 안 그러면 전 소스 동시 장애 때도 "성공"으로 처리돼 정상 캐시를 덮어쓴다 (P1 가드 복구).
  if (!tiles.some((t) => !t.placeholder && t.key !== "btcBreakeven")) {
    throw new Error("market bar unavailable");
  }

  return { tiles, updatedAt: new Date().toISOString() };
}

export async function getMarketBar(): Promise<MarketBarData> {
  try {
    // 캐시 키 버전 — 타일 데이터 형태 변경 시 올려 구(舊) 형태 캐시로 인한 크래시 방지 (v2: 김프·채굴% 개편)
    return await cachedJson("marketbar:v2", TTL_MS, fetchMarketBar);
  } catch {
    return { tiles: [], updatedAt: new Date(0).toISOString() };
  }
}
