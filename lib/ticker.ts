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

// 동시 호출 합치기 — 콜드 캐시에서 getTickers·getKimchiTable·getMarketBar가
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

// ── 업비트 전 KRW마켓 공용 소스 (김프표·괴리율이 공유) ──
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

// 바이낸스 전체 현물가 맵 — 김프표가 사용(중복 호출 방지, 60초 인메모리)
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

