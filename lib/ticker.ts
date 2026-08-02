import { cachedJson } from "@/lib/cache";
import { fetchJson } from "@/lib/http";

export type Ticker = {
  symbol: string;
  name: string;
  priceKrw: number | null;
  priceUsd: number | null;
  change24h: number | null; // 업비트 기준 24h 변동률 (%)
  volumeKrw24h: number | null;
  kimchiPremium: number | null; // %
};

export type FxSource = "live" | "cached" | "fallback";

export type TickerSnapshot = {
  tickers: Ticker[];
  usdKrw: number;
  usdKrwSource: FxSource; // 환율 출처 — fallback이면 김프가 추정치(가짜 신호 방지용)
  updatedAt: string;
};

const COINS = [
  { symbol: "BTC", name: "비트코인", upbit: "KRW-BTC", binance: "BTCUSDT" },
  { symbol: "ETH", name: "이더리움", upbit: "KRW-ETH", binance: "ETHUSDT" },
  { symbol: "XRP", name: "리플", upbit: "KRW-XRP", binance: "XRPUSDT" },
  { symbol: "SOL", name: "솔라나", upbit: "KRW-SOL", binance: "SOLUSDT" },
  { symbol: "TRX", name: "트론", upbit: "KRW-TRX", binance: "TRXUSDT" },
];

// 캐시 TTL. 무료플랜 Vercel Cron은 하루 1회뿐이라, 실제로는 만료 후 첫 방문자 요청 때
// inline 갱신되는 stale-while-revalidate가 주 경로다. 동시 요청의 외부 호출 폭주는
// cache.ts의 inflight 합치기로 막는다.
const TTL_MS = 60_000;
const FX_TTL_MS = 15 * 60_000;
const FX_STALE_CEILING_MS = 6 * 3600_000; // 6시간 넘은 환율은 신뢰 불가 → fallback으로 강등
const FALLBACK_USD_KRW = 1380;

let fxCache: { rate: number; at: number } | null = null;

// Yahoo(KRW=X) 장중 실시간가 — meta.regularMarketPrice. Yahoo는 UA를 요구하므로
// 공용 fetchJson(UA 없음) 대신 직접 fetch 한다.
async function fetchYahooUsdKrw(): Promise<number | null> {
  try {
    const res = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/KRW=X?interval=1d&range=1d",
      {
        signal: AbortSignal.timeout(6000),
        cache: "no-store",
        headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      chart?: { result?: { meta?: { regularMarketPrice?: number } }[] };
    };
    const rate = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof rate === "number" && rate > 0 ? rate : null;
  } catch {
    return null;
  }
}

// ECB(Frankfurter) 고시환율 — 하루 1회 발표라 장중엔 정체. Yahoo 실패 시 폴백으로만 사용.
async function fetchEcbUsdKrw(): Promise<number | null> {
  try {
    const data = await fetchJson<{ rates: { KRW: number } }>(
      "https://api.frankfurter.dev/v1/latest?base=USD&symbols=KRW"
    );
    const rate = data.rates?.KRW;
    return rate && rate > 0 ? rate : null;
  } catch {
    return null;
  }
}

// 동시 호출 합치기 — 콜드 캐시에서 getTickers·getKimchiTable·getSignalRadar·getMarketBar가
// 한꺼번에 환율을 요구할 때 Yahoo/ECB 중복 호출을 1회로 묶는다.
let fxInflight: Promise<{ rate: number; source: FxSource }> | null = null;

async function fetchUsdKrw(): Promise<{ rate: number; source: FxSource }> {
  if (fxCache && Date.now() - fxCache.at < FX_TTL_MS) {
    return { rate: fxCache.rate, source: "cached" };
  }
  if (fxInflight) return fxInflight;
  fxInflight = (async () => {
    // 김프·체감 환율엔 실시간 시장가가 맞다 → Yahoo 우선, 실패 시 ECB 고시환율로 폴백.
    const rate = (await fetchYahooUsdKrw()) ?? (await fetchEcbUsdKrw());
    if (rate && rate > 0) {
      fxCache = { rate, at: Date.now() };
      return { rate, source: "live" as FxSource };
    }
    // 직전 캐시가 6시간 이내면 사용, 그보다 오래됐으면 고정환율(추정)로 강등.
    // 출처를 명시(cached/fallback)해 김프가 추정 환율로 계산됐는지 UI가 구분하게 한다.
    if (fxCache && Date.now() - fxCache.at < FX_STALE_CEILING_MS) {
      return { rate: fxCache.rate, source: "cached" as FxSource };
    }
    return { rate: FALLBACK_USD_KRW, source: "fallback" as FxSource };
  })().finally(() => {
    fxInflight = null;
  });
  return fxInflight;
}

type UpbitTicker = {
  market: string;
  trade_price: number;
  signed_change_rate: number;
  acc_trade_price_24h: number;
};

type BinanceTicker = { symbol: string; lastPrice: string };

async function fetchSnapshot(): Promise<TickerSnapshot> {
  const upbitUrl = `https://api.upbit.com/v1/ticker?markets=${COINS.map((c) => c.upbit).join(",")}`;
  const binanceUrl = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(
    JSON.stringify(COINS.map((c) => c.binance))
  )}`;

  const [upbitRes, binanceRes, fx] = await Promise.all([
    fetchJson<UpbitTicker[]>(upbitUrl).catch(() => null),
    fetchJson<BinanceTicker[]>(binanceUrl).catch(() => null),
    fetchUsdKrw(),
  ]);
  // 업비트(국내 KRW가)는 필수 — 없으면 throw해서 캐시의 직전 정상값을 보존
  if (!upbitRes) throw new Error("upbit ticker unavailable");
  const usdKrw = fx.rate;

  const upbitMap = new Map(upbitRes.map((t) => [t.market, t]));
  const binanceMap = new Map(binanceRes?.map((t) => [t.symbol, t]) ?? []);

  const tickers: Ticker[] = COINS.map((coin) => {
    const up = upbitMap.get(coin.upbit);
    const bn = binanceMap.get(coin.binance);
    const priceKrw = up?.trade_price ?? null;
    const parsedUsd = bn ? parseFloat(bn.lastPrice) : NaN;
    const priceUsd = Number.isFinite(parsedUsd) ? parsedUsd : null;
    const kimchiPremium =
      priceKrw != null && priceUsd != null && priceUsd > 0
        ? (priceKrw / (priceUsd * usdKrw) - 1) * 100
        : null;
    return {
      symbol: coin.symbol,
      name: coin.name,
      priceKrw,
      priceUsd,
      change24h: up != null ? up.signed_change_rate * 100 : null,
      volumeKrw24h: up?.acc_trade_price_24h ?? null,
      kimchiPremium,
    };
  });

  return { tickers, usdKrw, usdKrwSource: fx.source, updatedAt: new Date().toISOString() };
}

// 업비트·빗썸 거래소 비교 (BTC/USDT 김프 계산용)
export type ExchangeComparison = {
  btcUpbit: number | null;
  btcBithumb: number | null;
  usdtUpbit: number | null;
  usdtBithumb: number | null;
};

async function fetchExchangeComparison(): Promise<ExchangeComparison> {
  const [upbit, bithumb] = await Promise.all([
    fetchJson<UpbitTicker[]>("https://api.upbit.com/v1/ticker?markets=KRW-BTC,KRW-USDT").catch(
      () => null
    ),
    // 빗썸 2.0 API는 업비트 호환 포맷
    fetchJson<UpbitTicker[]>("https://api.bithumb.com/v1/ticker?markets=KRW-BTC,KRW-USDT").catch(
      () => null
    ),
  ]);

  // 양쪽 모두 실패하면 throw — 캐시의 직전 정상값 보존
  if (!upbit && !bithumb) throw new Error("exchange comparison unavailable");

  const pick = (rows: UpbitTicker[] | null, market: string) =>
    rows?.find((r) => r.market === market)?.trade_price ?? null;

  return {
    btcUpbit: pick(upbit, "KRW-BTC"),
    btcBithumb: pick(bithumb, "KRW-BTC"),
    usdtUpbit: pick(upbit, "KRW-USDT"),
    usdtBithumb: pick(bithumb, "KRW-USDT"),
  };
}

export async function getExchangeComparison(): Promise<ExchangeComparison> {
  try {
    return await cachedJson("exchange", TTL_MS, fetchExchangeComparison);
  } catch {
    return { btcUpbit: null, btcBithumb: null, usdtUpbit: null, usdtBithumb: null };
  }
}

// ── KRW 시장 폭(breadth) + 거래대금 TOP — 업비트 전 KRW마켓 단일 호출 ──
export type MarketMover = {
  market: string; // KRW-BTC
  symbol: string; // BTC
  priceKrw: number;
  change24h: number; // %
  volumeKrw24h: number;
};

export type KrwMarketStats = {
  up: number;
  down: number;
  flat: number;
  total: number; // 유동성 필터 후 종목 수
  upRatio: number; // up / total
  topVolume: MarketMover[];
  updatedAt: string;
};

const LIQUIDITY_FLOOR_KRW = 1e8; // 24h 거래대금 1억원 미만은 잡코인 왜곡 방지로 제외
const KRW_STATS_TTL_MS = 60_000;

// 업비트 전 KRW마켓 원본 — breadth/거래대금/김프표가 공유하는 단일 호출(30초 캐시)
// fetchedAt(실제 수신 시각)을 함께 반환해 파생 데이터의 신선도가 거짓이 되지 않게 한다.
type AllKrwResult = { rows: UpbitTicker[]; fetchedAt: number };
let allKrwCache: { rows: UpbitTicker[]; at: number } | null = null;
let allKrwInflight: Promise<AllKrwResult> | null = null;

async function getAllKrwTickers(): Promise<AllKrwResult> {
  if (allKrwCache && Date.now() - allKrwCache.at < KRW_STATS_TTL_MS) {
    return { rows: allKrwCache.rows, fetchedAt: allKrwCache.at };
  }
  if (!allKrwInflight) {
    allKrwInflight = fetchJson<UpbitTicker[]>(
      "https://api.upbit.com/v1/ticker/all?quote_currencies=KRW",
      7000
    )
      .then((rows) => {
        const at = Date.now();
        allKrwCache = { rows, at };
        return { rows, fetchedAt: at };
      })
      .finally(() => {
        allKrwInflight = null;
      });
  }
  try {
    return await allKrwInflight;
  } catch {
    if (allKrwCache) return { rows: allKrwCache.rows, fetchedAt: allKrwCache.at };
    return { rows: [], fetchedAt: 0 };
  }
}

// 업비트 마켓 한글명 맵 — 심볼(BTC) → 한글명(비트코인). 마켓 목록은 거의 안 변해 6시간 캐시.
type UpbitMarket = { market: string; korean_name: string; english_name: string };
let upbitNamesCache: { map: Map<string, string>; at: number } | null = null;
let upbitNamesInflight: Promise<Map<string, string>> | null = null;
const UPBIT_NAMES_TTL_MS = 6 * 60 * 60_000;

async function getUpbitNamesKo(): Promise<Map<string, string>> {
  if (upbitNamesCache && Date.now() - upbitNamesCache.at < UPBIT_NAMES_TTL_MS) {
    return upbitNamesCache.map;
  }
  if (!upbitNamesInflight) {
    upbitNamesInflight = fetchJson<UpbitMarket[]>("https://api.upbit.com/v1/market/all", 7000)
      .then((rows) => {
        const map = new Map<string, string>();
        for (const r of rows) {
          if (r.market.startsWith("KRW-")) map.set(r.market.replace("KRW-", ""), r.korean_name);
        }
        upbitNamesCache = { map, at: Date.now() };
        return map;
      })
      .finally(() => {
        upbitNamesInflight = null;
      });
  }
  try {
    return await upbitNamesInflight;
  } catch {
    return upbitNamesCache?.map ?? new Map();
  }
}

// 바이낸스 전체 현물가 맵 — 김프표/시그널레이더가 공유(중복 호출 방지, 60초 인메모리)
let bnPriceCache: { map: Map<string, number>; at: number } | null = null;
let bnPriceInflight: Promise<Map<string, number>> | null = null;

async function getBinancePrices(): Promise<Map<string, number>> {
  if (bnPriceCache && Date.now() - bnPriceCache.at < KRW_STATS_TTL_MS) return bnPriceCache.map;
  if (!bnPriceInflight) {
    bnPriceInflight = fetchJson<{ symbol: string; price: string }[]>(
      "https://api.binance.com/api/v3/ticker/price",
      7000
    )
      .then((bn) => {
        const map = new Map<string, number>();
        for (const b of bn) {
          const p = parseFloat(b.price);
          if (Number.isFinite(p)) map.set(b.symbol, p);
        }
        bnPriceCache = { map, at: Date.now() };
        return map;
      })
      .finally(() => {
        bnPriceInflight = null;
      });
  }
  return bnPriceInflight;
}

const EMPTY_KRW_STATS: KrwMarketStats = {
  up: 0,
  down: 0,
  flat: 0,
  total: 0,
  upRatio: 0,
  topVolume: [],
  updatedAt: new Date(0).toISOString(),
};

async function fetchKrwMarketStats(): Promise<KrwMarketStats> {
  const { rows, fetchedAt } = await getAllKrwTickers();
  if (rows.length === 0) throw new Error("upbit all-KRW unavailable"); // 캐시 보존
  const liquid = rows.filter((r) => (r.acc_trade_price_24h ?? 0) >= LIQUIDITY_FLOOR_KRW);
  let up = 0;
  let down = 0;
  let flat = 0;
  for (const r of liquid) {
    if (r.signed_change_rate > 0) up++;
    else if (r.signed_change_rate < 0) down++;
    else flat++;
  }
  const total = liquid.length;
  const topVolume: MarketMover[] = [...liquid]
    .sort((a, b) => b.acc_trade_price_24h - a.acc_trade_price_24h)
    .slice(0, 7)
    .map((r) => ({
      market: r.market,
      symbol: r.market.replace("KRW-", ""),
      priceKrw: r.trade_price,
      change24h: r.signed_change_rate * 100,
      volumeKrw24h: r.acc_trade_price_24h,
    }));
  return {
    up,
    down,
    flat,
    total,
    upRatio: total > 0 ? up / total : 0,
    topVolume,
    updatedAt: fetchedAt > 0 ? new Date(fetchedAt).toISOString() : EMPTY_KRW_STATS.updatedAt,
  };
}

export async function getKrwMarketStats(): Promise<KrwMarketStats> {
  try {
    return await cachedJson("krwStats", KRW_STATS_TTL_MS, fetchKrwMarketStats);
  } catch {
    return EMPTY_KRW_STATS;
  }
}

// ── 김치프리미엄 확장표 — 거래대금 상위 코인별 김프 ──
export type KimchiRow = {
  symbol: string;
  priceKrw: number;
  priceUsd: number;
  kimchi: number; // %
  volumeKrw24h: number;
};

export type KimchiTable = {
  rows: KimchiRow[];
  usdKrw: number;
  usdKrwSource: FxSource;
  updatedAt: string;
};

const KIMCHI_TTL_MS = 60_000;

async function fetchKimchiTable(): Promise<KimchiTable> {
  const [{ rows: krwRows, fetchedAt }, fx] = await Promise.all([getAllKrwTickers(), fetchUsdKrw()]);

  if (krwRows.length === 0) throw new Error("upbit all-KRW unavailable"); // 캐시 보존

  // 바이낸스 전체 현물가 (공유 캐시) — 실패 시 throw → 빈 표로 덮어쓰지 않음
  const priceMap = await getBinancePrices();

  const candidates = [...krwRows]
    .filter((r) => (r.acc_trade_price_24h ?? 0) >= LIQUIDITY_FLOOR_KRW)
    .sort((a, b) => b.acc_trade_price_24h - a.acc_trade_price_24h);

  const rows: KimchiRow[] = [];
  for (const r of candidates) {
    const symbol = r.market.replace("KRW-", "");
    const usd = priceMap.get(`${symbol}USDT`);
    if (usd == null || !Number.isFinite(usd) || usd <= 0) continue; // 페어 없음/이상치 제외
    rows.push({
      symbol,
      priceKrw: r.trade_price,
      priceUsd: usd,
      kimchi: (r.trade_price / (usd * fx.rate) - 1) * 100,
      volumeKrw24h: r.acc_trade_price_24h,
    });
    if (rows.length >= 10) break;
  }

  return {
    rows,
    usdKrw: fx.rate,
    usdKrwSource: fx.source,
    updatedAt: fetchedAt > 0 ? new Date(fetchedAt).toISOString() : new Date(0).toISOString(),
  };
}

export async function getKimchiTable(): Promise<KimchiTable> {
  try {
    return await cachedJson("kimchi", KIMCHI_TTL_MS, fetchKimchiTable);
  } catch {
    return {
      rows: [],
      usdKrw: FALLBACK_USD_KRW,
      usdKrwSource: "fallback",
      updatedAt: new Date(0).toISOString(),
    };
  }
}

// ── KRW 시그널 레이더 — "지금 주목할 코인" 어텐션 랭킹 (등락·거래대금 급증·김프) ──
export type RadarCoin = {
  symbol: string;
  nameKo: string; // 한글명 (업비트 마켓 기준)
  priceKrw: number;
  change24h: number; // %
  kimchi: number | null; // % (바이낸스 USDT 페어 없으면 null)
  volumeKrw24h: number;
  volumeRank: number; // 유동성 종목 내 거래대금 순위(1-base)
  surge: number | null; // 거래대금 급증배수 — 오늘 24h ÷ 직전 7일 평균 (일봉 8개 미만이면 null)
  score: number; // 어텐션 점수 — 선정·정렬 기준 (아래 attentionScore)
};

export type SignalRadar = { coins: RadarCoin[]; updatedAt: string; usdKrwSource: FxSource };

const RADAR_TTL_MS = 60_000;

// 어텐션 점수 — "지금 주목할 이유"의 크기. 등락률과 거래대금(절대 규모·급증)을 중심으로 합산.
// 김프 이탈은 참고 수준의 소가중치 (운영 결정 2026-07-13: 등락·거래량 중심, 김프 비중 축소).
// 급증배수는 8배로 캡해 극단 종목이 점수를 무한 독식하지 않게 한다.
function attentionScore(
  change24h: number,
  volumeKrw24h: number,
  surge: number | null,
  kimchi: number | null
): number {
  const changePt = Math.abs(change24h) * 2; // ±10% → 20pt
  // 절대 거래대금 — 100억원 기준 0pt, 10배마다 ±12pt (1000억 +12pt, 10억 -12pt).
  // 저유동성 코인이 자기 대비 급증배수만으로 상위를 독식하지 않게 규모로 보정한다.
  const volumePt = volumeKrw24h > 0 ? (Math.log10(volumeKrw24h) - 10) * 12 : -24;
  const surgePt = surge != null ? Math.min(surge, 8) * 4 : 0; // 3배 급증 → 12pt
  const kimchiPt = kimchi != null ? Math.abs(kimchi) * 0.5 : 0; // 김프 ±3% → 1.5pt
  return changePt + volumePt + surgePt + kimchiPt;
}

// 거래대금 급증배수 — 오늘 24h 누적(티커) ÷ 직전 7일 평균(일봉). 일봉 8개 미만(신규상장)이면 null.
// 기준선(직전 7일 평균)은 하루 단위로만 변하므로 마켓별 15분 캐시 — 레이더 60초 TTL마다
// 캔들 20콜을 쏘던 최대 트래픽원(일 ~2.9만콜)을 ~1/15로 줄인다. null(신규상장)도 캐시.
const SURGE_BASE_TTL_MS = 15 * 60_000;
const surgeBaseCache = new Map<string, { base: number | null; at: number }>();

async function fetchVolumeSurge(market: string, todayVolKrw: number): Promise<number | null> {
  const hit = surgeBaseCache.get(market);
  if (hit && Date.now() - hit.at < SURGE_BASE_TTL_MS) {
    return hit.base != null && hit.base > 0 ? todayVolKrw / hit.base : null;
  }
  try {
    const candles = await fetchJson<{ candle_acc_trade_price: number }[]>(
      `https://api.upbit.com/v1/candles/days?market=${market}&count=8`,
      5000
    );
    if (candles.length < 8) {
      // [0]=오늘(부분) — 기준선은 이전 7일. 신규상장(이력 부족)도 캐시해 재조회 방지.
      surgeBaseCache.set(market, { base: null, at: Date.now() });
      return null;
    }
    const base = candles.slice(1, 8).reduce((a, c) => a + c.candle_acc_trade_price, 0) / 7;
    surgeBaseCache.set(market, { base, at: Date.now() });
    return base > 0 ? todayVolKrw / base : null;
  } catch {
    return null; // 네트워크 실패는 캐시하지 않음 — 다음 사이클에 재시도
  }
}

async function fetchSignalRadar(): Promise<SignalRadar> {
  // 어텐션 랭킹: 시총 상위 고정이 아니라 "지금 주목할 이유"가 있는 종목을 전 KRW 마켓에서 선별.
  // (운영 결정 2026-07-12: 메이저는 상단 마켓바에 상시 표시되므로 이 테이블은 전부 어텐션순)
  // 1차(무비용): |등락|+거래대금 규모(+김프 소가중) → 상위 20개만 일봉 조회로 급증배수 → 최종 점수 상위 12.
  const [{ rows: krwRows, fetchedAt }, fx, priceMap, namesKo] = await Promise.all([
    getAllKrwTickers(),
    fetchUsdKrw(),
    getBinancePrices().catch(() => new Map<string, number>()), // 김프는 보조 — 실패해도 레이더는 동작
    getUpbitNamesKo().catch(() => new Map<string, string>()), // 한글명도 보조 — 실패 시 심볼 폴백
  ]);
  if (krwRows.length === 0) throw new Error("upbit all-KRW unavailable");

  // 스테이블코인(USDT·USDC 등)은 '봐야 할 코인'에서 제외
  const RADAR_STABLES = new Set(["USDT", "USDC", "DAI", "TUSD", "USDS", "FDUSD"]);
  // 레이더 전용 유동성 하한 10억원 — 거래대금이 너무 낮은 코인은 후보에서 제외
  // (공용 LIQUIDITY_FLOOR_KRW 1억은 시장 통계용이라 그대로 둔다. 운영 결정 2026-07-13)
  const RADAR_VOLUME_FLOOR_KRW = 1e9;
  const marketWide = krwRows.filter((r) => (r.acc_trade_price_24h ?? 0) >= LIQUIDITY_FLOOR_KRW);
  const liquid = marketWide
    .filter((r) => (r.acc_trade_price_24h ?? 0) >= RADAR_VOLUME_FLOOR_KRW)
    .filter((r) => !RADAR_STABLES.has(r.market.replace("KRW-", "")));

  // 업비트 KRW 거래대금 순위(시장 전체) — "거래대금 N위" 배지의 기준은 그대로 유지
  const byVolume = [...marketWide].sort((a, b) => b.acc_trade_price_24h - a.acc_trade_price_24h);
  const volumeRank = new Map<string, number>();
  byVolume.forEach((r, i) => volumeRank.set(r.market.replace("KRW-", ""), i + 1));

  const kimchiOf = (symbol: string, priceKrw: number): number | null => {
    const usd = priceMap.get(`${symbol}USDT`);
    return usd != null && Number.isFinite(usd) && usd > 0
      ? (priceKrw / (usd * fx.rate) - 1) * 100
      : null;
  };

  // 1차 후보: 등락·김프만으로 상위 20개 (일봉 조회 비용을 후보군에만 지불)
  const prelim = [...liquid]
    .map((r) => {
      const symbol = r.market.replace("KRW-", "");
      return {
        r,
        symbol,
        prelimScore: attentionScore(
          r.signed_change_rate * 100,
          r.acc_trade_price_24h,
          null,
          kimchiOf(symbol, r.trade_price)
        ),
      };
    })
    .sort((a, b) => b.prelimScore - a.prelimScore)
    .slice(0, 20);

  // 후보 20개 일봉 → 급증배수 (업비트 quotation 10/s 제한 고려, 4개씩 배치)
  const surgeBySym = new Map<string, number | null>();
  for (let i = 0; i < prelim.length; i += 4) {
    const batch = prelim.slice(i, i + 4);
    const results = await Promise.all(
      batch.map((c) => fetchVolumeSurge(c.r.market, c.r.acc_trade_price_24h))
    );
    batch.forEach((c, j) => surgeBySym.set(c.symbol, results[j]));
  }

  const coins: RadarCoin[] = prelim
    .map(({ r, symbol }) => {
      const kimchi = kimchiOf(symbol, r.trade_price);
      const change24h = r.signed_change_rate * 100;
      const surge = surgeBySym.get(symbol) ?? null;
      return {
        symbol,
        nameKo: namesKo.get(symbol) ?? symbol,
        priceKrw: r.trade_price,
        change24h,
        kimchi,
        volumeKrw24h: r.acc_trade_price_24h,
        volumeRank: volumeRank.get(symbol) ?? 0,
        surge,
        score: attentionScore(change24h, r.acc_trade_price_24h, surge, kimchi),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  return {
    coins,
    updatedAt: fetchedAt > 0 ? new Date(fetchedAt).toISOString() : new Date(0).toISOString(),
    usdKrwSource: fx.source,
  };
}

export async function getSignalRadar(): Promise<SignalRadar> {
  try {
    return await cachedJson("radar", RADAR_TTL_MS, fetchSignalRadar);
  } catch {
    return { coins: [], updatedAt: new Date(0).toISOString(), usdKrwSource: "fallback" };
  }
}

// ── 업비트 ↔ 빗썸 괴리율 — 동일 코인 거래소 간 가격차(차익 신호) ──
export type SpreadRow = {
  symbol: string;
  upbit: number;
  bithumb: number;
  spread: number; // (업비트/빗썸 - 1) × 100, %
};
export type ExchangeSpread = { rows: SpreadRow[]; updatedAt: string };

type BithumbAll = { status: string; data: Record<string, { closing_price: string }> };

async function fetchExchangeSpread(): Promise<ExchangeSpread> {
  const { rows: krwRows, fetchedAt } = await getAllKrwTickers();
  if (krwRows.length === 0) throw new Error("upbit all-KRW unavailable");

  // 빗썸 전체 KRW 1콜 (특정 코인 미상장으로 인한 전체 실패 방지). 실패 시 throw → 캐시 보존
  const res = await fetchJson<BithumbAll>("https://api.bithumb.com/public/ticker/ALL_KRW", 7000);
  if (res?.status !== "0000" || !res.data) throw new Error("bithumb ALL_KRW error"); // 논리 실패도 캐시 보존
  const bdata = res.data;

  const top = [...krwRows]
    .filter((r) => (r.acc_trade_price_24h ?? 0) >= LIQUIDITY_FLOOR_KRW)
    .sort((a, b) => b.acc_trade_price_24h - a.acc_trade_price_24h)
    .slice(0, 30);

  const rows: SpreadRow[] = [];
  for (const r of top) {
    const sym = r.market.replace("KRW-", "");
    const bp = parseFloat(bdata[sym]?.closing_price ?? "");
    if (!Number.isFinite(bp) || bp <= 0) continue; // 빗썸 미상장/이상치 제외
    rows.push({ symbol: sym, upbit: r.trade_price, bithumb: bp, spread: (r.trade_price / bp - 1) * 100 });
  }
  if (rows.length === 0) throw new Error("no upbit/bithumb overlap"); // 빈 표 캐싱 방지
  // 괴리 절댓값 큰 순으로 상위 8개
  rows.sort((a, b) => Math.abs(b.spread) - Math.abs(a.spread));

  return {
    rows: rows.slice(0, 8),
    updatedAt: fetchedAt > 0 ? new Date(fetchedAt).toISOString() : new Date(0).toISOString(),
  };
}

export async function getExchangeSpread(): Promise<ExchangeSpread> {
  try {
    return await cachedJson("spread", KRW_STATS_TTL_MS, fetchExchangeSpread);
  } catch {
    return { rows: [], updatedAt: new Date(0).toISOString() };
  }
}

// ── 추세 라벨 — 레이더 상위 코인의 일봉으로 MA20/RSI14 기반 단순 추세 ──
export type TrendInfo = { label: string; rsi: number | null };
export type TrendMap = Record<string, TrendInfo>; // symbol → 추세

const TREND_TTL_MS = 10 * 60_000;

function computeRsi(closes: number[]): number | null {
  if (closes.length < 15) return null;
  const recent = closes.slice(-15); // 14개 변화량
  let gain = 0;
  let loss = 0;
  for (let i = 1; i < recent.length; i++) {
    const d = recent[i] - recent[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  const avgGain = gain / 14;
  const avgLoss = loss / 14;
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

async function fetchTrendForMarket(market: string): Promise<TrendInfo | null> {
  try {
    const candles = await fetchJson<{ trade_price: number }[]>(
      `https://api.upbit.com/v1/candles/days?market=${market}&count=30`,
      5000
    );
    const closes = candles.map((c) => c.trade_price).reverse(); // 과거→현재
    if (closes.length < 15) return null;
    const price = closes[closes.length - 1];
    const ma20 = closes.length >= 20 ? closes.slice(-20).reduce((a, b) => a + b, 0) / 20 : null;
    const rsi = computeRsi(closes);
    let label: string;
    if (rsi != null && rsi >= 70) label = "과매수";
    else if (rsi != null && rsi <= 30) label = "과매도";
    else if (ma20 != null) label = price >= ma20 ? "상승추세" : "하락추세";
    else label = price >= closes[0] ? "상승추세" : "하락추세";
    return { label, rsi };
  } catch {
    return null;
  }
}

async function fetchTrendLabels(): Promise<TrendMap> {
  const radar = await getSignalRadar();
  const syms = radar.coins.slice(0, 8).map((c) => c.symbol);
  const map: TrendMap = {};
  // 업비트 quotation 제한(10/sec) 고려 — 4개씩 배치
  for (let i = 0; i < syms.length; i += 4) {
    const batch = syms.slice(i, i + 4);
    const results = await Promise.all(batch.map((s) => fetchTrendForMarket(`KRW-${s}`)));
    batch.forEach((s, j) => {
      const r = results[j];
      if (r) map[s] = r;
    });
  }
  return map;
}

export async function getTrendLabels(): Promise<TrendMap> {
  try {
    return await cachedJson("trend", TREND_TTL_MS, fetchTrendLabels);
  } catch {
    return {};
  }
}

export async function getTickers(): Promise<TickerSnapshot> {
  try {
    return await cachedJson("tickers", TTL_MS, fetchSnapshot);
  } catch {
    return {
      tickers: [],
      usdKrw: FALLBACK_USD_KRW,
      usdKrwSource: "fallback",
      updatedAt: new Date(0).toISOString(),
    };
  }
}

