import { cachedJson } from "@/lib/cache";
import { fetchJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export type FngPoint = {
  value: number;
  classification: string;
  date: string; // ISO
};

export type MarketOverview = {
  btcDominance: number | null;
  totalMarketCapUsd: number | null;
  marketCapChange24h: number | null;
  fearGreed: FngPoint[] | null; // 과거 → 현재 순
  updatedAt: string;
};

const TTL_MS = 5 * 60_000;

type CoinGeckoGlobal = {
  data: {
    market_cap_percentage: { btc: number };
    total_market_cap: { usd: number };
    market_cap_change_percentage_24h_usd: number;
  };
};

type FngResponse = {
  data: { value: string; value_classification: string; timestamp: string }[];
};

async function fetchOverview(): Promise<MarketOverview> {
  const [global, fng] = await Promise.all([
    fetchJson<CoinGeckoGlobal>("https://api.coingecko.com/api/v3/global").catch(() => null),
    fetchJson<FngResponse>("https://api.alternative.me/fng/?limit=30").catch(() => null),
  ]);
  // 양쪽 모두 실패하면 throw — 캐시의 직전 정상값 보존(빈 데이터로 덮어쓰지 않음)
  if (!global && !fng) throw new Error("market overview unavailable");

  const fearGreed =
    fng?.data
      ?.map((d) => ({
        value: parseInt(d.value, 10),
        classification: d.value_classification,
        date: new Date(parseInt(d.timestamp, 10) * 1000).toISOString(),
      }))
      .reverse() ?? null;

  return {
    btcDominance: global?.data?.market_cap_percentage?.btc ?? null,
    totalMarketCapUsd: global?.data?.total_market_cap?.usd ?? null,
    marketCapChange24h: global?.data?.market_cap_change_percentage_24h_usd ?? null,
    fearGreed,
    updatedAt: new Date().toISOString(),
  };
}

export async function getMarketOverview(): Promise<MarketOverview> {
  try {
    return await cachedJson("overview", TTL_MS, fetchOverview);
  } catch {
    return {
      btcDominance: null,
      totalMarketCapUsd: null,
      marketCapChange24h: null,
      fearGreed: null,
      updatedAt: new Date(0).toISOString(),
    };
  }
}

// 환율 최근 추이 — 영업일 기준 마지막 6개
export type FxPoint = { date: string; rate: number };

// USD/KRW 일별 환율 — Yahoo Finance(KRW=X)를 우선 사용.
// ECB(Frankfurter)는 CET 16시 발표라 당일 값이 늦지만, Yahoo는 당일 실시간까지 포함 → 마지막 날짜가 "오늘"로 표시됨.
async function fetchFxHistoryYahoo(): Promise<FxPoint[]> {
  const res = await fetch(
    "https://query1.finance.yahoo.com/v8/finance/chart/KRW=X?interval=1d&range=1mo",
    {
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
    }
  );
  if (!res.ok) throw new Error(`yahoo KRW=X -> ${res.status}`);
  const data = (await res.json()) as {
    chart?: {
      result?: {
        timestamp?: number[];
        indicators?: { quote?: { close?: (number | null)[] }[] };
      }[];
    };
  };
  const r = data?.chart?.result?.[0];
  const ts = r?.timestamp ?? [];
  const closes = r?.indicators?.quote?.[0]?.close ?? [];
  const points = ts
    .map((t, i) => ({ date: new Date(t * 1000).toISOString().slice(0, 10), rate: closes[i] ?? 0 }))
    .filter((p) => p.rate > 0)
    .slice(-7); // 표시는 6일, 1일치 더 받아 첫 타일의 전일 대비 등락 계산용
  if (points.length === 0) throw new Error("yahoo fx history empty");
  return points;
}

// 폴백 — Yahoo 실패 시 ECB(Frankfurter, 영업일 1회 발표)
async function fetchFxHistoryEcb(): Promise<FxPoint[]> {
  const end = new Date();
  const start = new Date(end.getTime() - 12 * 86400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const data = await fetchJson<{ rates: Record<string, { KRW: number }> }>(
    `https://api.frankfurter.dev/v1/${fmt(start)}..${fmt(end)}?base=USD&symbols=KRW`
  );
  const points = Object.entries(data.rates ?? {})
    .map(([date, r]) => ({ date, rate: r.KRW }))
    .filter((p) => p.rate > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-7);
  if (points.length === 0) throw new Error("fx history empty");
  return points;
}

async function fetchFxHistory(): Promise<FxPoint[]> {
  try {
    return await fetchFxHistoryYahoo();
  } catch {
    return fetchFxHistoryEcb();
  }
}

export async function getFxHistory(): Promise<FxPoint[]> {
  try {
    return await cachedJson("fxHistory", 15 * 60_000, fetchFxHistory);
  } catch {
    return [];
  }
}


export function fngLabelKo(classification: string): string {
  switch (classification) {
    case "Extreme Fear":
      return "극단적 공포";
    case "Fear":
      return "공포";
    case "Neutral":
      return "중립";
    case "Greed":
      return "탐욕";
    case "Extreme Greed":
      return "극단적 탐욕";
    default:
      return classification;
  }
}

// ── 버블맵: 시총 상위 N + 기간별 변동률 (CoinGecko 단일 호출) ──
export type BubbleCoin = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  priceUsd: number | null;
  marketCap: number | null;
  marketCapRank: number | null; // ← "어떤 100개가 보이나"의 기준
  volume24h: number | null;
  // 버블 크기·색의 기준이 되는 값들 (기간 토글용)
  change1h: number | null;
  change24h: number | null;
  change7d: number | null;
  change30d: number | null;
  change1y: number | null;
};

export type BubbleSnapshot = {
  coins: BubbleCoin[];
  updatedAt: string;
};

type CGMarket = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number | null;
  market_cap: number | null;
  market_cap_rank: number | null;
  total_volume: number | null;
  price_change_percentage_1h_in_currency: number | null;
  price_change_percentage_24h_in_currency: number | null;
  price_change_percentage_7d_in_currency: number | null;
  price_change_percentage_30d_in_currency: number | null;
  price_change_percentage_1y_in_currency: number | null;
};

const BUBBLES_TTL_MS = 5 * 60_000; // /global 과 동일 톤(분 단위) — 시총 랭킹은 초단위 갱신 불필요

// 스테이블코인 폴백 목록 — CoinGecko 카테고리 조회 실패 시에만 사용(아래 동적 목록이 1차).
const BUBBLE_STABLES = new Set([
  "USDT", "USDC", "DAI", "TUSD", "USDS", "FDUSD", "USDE", "PYUSD", "BUSD",
  "GUSD", "USDD", "FRAX", "LUSD", "USDP", "EURT", "EURC", "USD1", "USDF",
  "USDX", "USD0", "USDB", "USDG", "RLUSD", "BUIDL", "USDY", "USTC",
]);

const STABLE_TTL_MS = 6 * 3600_000; // 스테이블 '분류'는 자주 안 바뀜 — 6시간 캐시

// CoinGecko "stablecoins" 카테고리 → 스테이블로 분류된 심볼 목록(동적).
// 하드코딩 목록이 놓치는 신규 스테이블코인(USDtb·EURS 등)까지 거른다.
// 빈/실패 시 throw → cachedJson 이 직전 정상값을 보존.
async function fetchStableSymbols(): Promise<string[]> {
  const url =
    "https://api.coingecko.com/api/v3/coins/markets" +
    "?vs_currency=usd&category=stablecoins&order=market_cap_desc&per_page=250&page=1&sparkline=false";
  const rows = await fetchJson<{ symbol: string }[]>(url, 8000);
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("coingecko stablecoins empty");
  return rows.map((r) => r.symbol.toUpperCase());
}

// 동적 스테이블 분류 + 하드코딩 폴백을 합친 제외 집합. 카테고리 조회 실패 시 폴백만 사용.
async function getStableSet(): Promise<Set<string>> {
  try {
    const syms = await cachedJson("bubble-stables", STABLE_TTL_MS, fetchStableSymbols);
    return new Set<string>([...BUBBLE_STABLES, ...syms]);
  } catch {
    return BUBBLE_STABLES;
  }
}

async function fetchBubbles(): Promise<BubbleSnapshot> {
  // 스테이블로 '분류'된 코인 집합(동적) — 신규 스테이블코인까지 제외
  const stables = await getStableSet();
  // 스테이블 제외 후에도 100개가 남도록 넉넉히(250개) 받아온다
  const url =
    "https://api.coingecko.com/api/v3/coins/markets" +
    "?vs_currency=usd&order=market_cap_desc&per_page=250&page=1" +
    "&sparkline=false&price_change_percentage=1h%2C24h%2C7d%2C30d%2C1y";
  // 빈 배열이면 throw → cachedJson 이 캐시의 직전 정상값을 보존(빈 데이터로 안 덮음)
  const rows = await fetchJson<CGMarket[]>(url, 8000);
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("coingecko markets empty");

  const coins: BubbleCoin[] = rows
    .filter((r) => !stables.has(r.symbol.toUpperCase()))
    .slice(0, 100)
    .map((r) => ({
    id: r.id,
    symbol: r.symbol.toUpperCase(),
    name: r.name,
    image: r.image,
    priceUsd: r.current_price ?? null,
    marketCap: r.market_cap ?? null,
    marketCapRank: r.market_cap_rank ?? null,
    volume24h: r.total_volume ?? null,
    change1h: r.price_change_percentage_1h_in_currency ?? null,
    change24h: r.price_change_percentage_24h_in_currency ?? null,
    change7d: r.price_change_percentage_7d_in_currency ?? null,
    change30d: r.price_change_percentage_30d_in_currency ?? null,
    change1y: r.price_change_percentage_1y_in_currency ?? null,
  }));

  return { coins, updatedAt: new Date().toISOString() };
}

export async function getBubbles(): Promise<BubbleSnapshot> {
  try {
    // -v2: 스테이블 동적 제외 + 수집량 250 — 옛 캐시 무시하고 즉시 새 필터로 갱신
    return await cachedJson("bubbles-v2", BUBBLES_TTL_MS, fetchBubbles);
  } catch {
    return { coins: [], updatedAt: new Date(0).toISOString() };
  }
}

// 버블 스냅샷의 코인 id 집합 — 인스턴스 메모리에 캐시.
// /api/bubbles/tickers 는 요청마다 id 유효성만 확인하면 되는데, getBubbles()를 그대로 부르면
// 클릭 한 번에 31KB짜리 스냅샷 JSON을 DB에서 읽고 파싱한다. id 집합만 따로 들고 있으면
// 캐시 적중 클릭의 DB 왕복이 2회→1회로 줄어든다(실측 ~115ms → ~60ms).
let bubbleIdSet: { ids: Set<string>; at: number } | null = null;

export async function isBubbleCoinId(id: string): Promise<boolean> {
  if (bubbleIdSet && Date.now() - bubbleIdSet.at < BUBBLES_TTL_MS) {
    return bubbleIdSet.ids.has(id);
  }
  const snapshot = await getBubbles();
  // 빈 스냅샷(조회 실패)은 메모하지 않는다 — 모든 id가 404가 되어버린다
  if (snapshot.coins.length === 0) return false;
  bubbleIdSet = { ids: new Set(snapshot.coins.map((c) => c.id)), at: Date.now() };
  return bubbleIdSet.ids.has(id);
}

// ── 버블맵 클릭 카드: 코인별 실제 상장 거래소 상위 3곳 (24h 거래대금 합산 기준) ──
// 심볼로 URL을 조립하던 방식은 미상장 코인에도 업비트 버튼이 뜨던 문제(오링크)가 있어
// CoinGecko tickers로 실제 상장 여부·거래대금을 확인한다.
export type CoinExchange = {
  name: string; // CoinGecko 거래소 표시명 (예: "Upbit", "Coinbase Exchange")
  identifier: string; // CoinGecko 거래소 id (예: "upbit", "gdax") — 클라이언트 한글 라벨 매핑용
  url: string; // 해당 거래소 최대 거래대금 페어의 trade_url
};

export type CoinExchangesResult = { exchanges: CoinExchange[]; updatedAt: string };

type CGTicker = {
  market?: { name?: string; identifier?: string } | null;
  trade_url?: string | null;
  converted_volume?: { usd?: number | null } | null;
  trust_score?: string | null; // green | yellow | red | null
  is_anomaly?: boolean;
  is_stale?: boolean;
};

const COIN_EXCHANGES_TTL_MS = 12 * 3600_000; // 상장 여부·거래대금 순위는 반나절 단위면 충분

// CoinGecko 무료 API 레이트리밋 보호 — tickers 호출을 전역 직렬화 + 최소 간격.
// 콜드 캐시 상태에서 버블을 연달아 클릭하면 클릭마다 외부 호출이 나가 6번째쯤부터
// 429가 터지고 거래소 버튼이 빈 카드가 나오던 문제(사용자 보고). 큐로 간격을 벌리면
// 뒤 클릭은 몇 초 늦게라도 성공하고, 성공 결과는 12h 캐시라 재발하지 않는다.
const CG_CALL_GAP_MS = 2200;
// 큐 대기 상한 — 이보다 깊게 쌓이면 기다리게 두지 않고 즉시 실패시킨다.
// 큐는 전역 FIFO라, 상한이 없으면 동시 클릭 N번째 사용자가 N×2.2초를 스피너만 보게 된다.
// 즉시 실패하면 카드가 "잠시 후 다시" 안내로 바로 확정되고, 성공한 코인은 12h 캐시로 남는다.
const CG_MAX_QUEUE_DEPTH = 4;
let cgQueue: Promise<unknown> = Promise.resolve();
let cgQueueDepth = 0;
let cgLastCallAt = 0;

function throttledCoinGecko<T>(task: () => Promise<T>): Promise<T> {
  if (cgQueueDepth >= CG_MAX_QUEUE_DEPTH) {
    return Promise.reject(new Error("coingecko queue saturated"));
  }
  cgQueueDepth += 1;
  const run = cgQueue.then(async () => {
    const wait = cgLastCallAt + CG_CALL_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    try {
      return await task();
    } finally {
      cgLastCallAt = Date.now();
      cgQueueDepth -= 1;
    }
  });
  cgQueue = run.catch(() => {}); // 실패해도 큐는 계속 흐른다
  return run;
}

// 429 등 일시 오류 대비 백오프 재시도 (총 2회 시도).
// 3회 + [0,3s,6s] 백오프였을 땐 실패 코인 하나가 응답 11초를 찍고(실측) 그동안 전역 큐를
// 점유해 다른 사용자 클릭까지 밀렸다. 재시도는 한 번이면 일시적 429는 대부분 흡수되고,
// 최악 지연이 ~15초 → ~6초로 내려간다.
async function fetchJsonWithRetry<T>(url: string, timeoutMs: number): Promise<T> {
  let lastErr: unknown;
  for (const delay of [0, 1500]) {
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    try {
      return await throttledCoinGecko(() => fetchJson<T>(url, timeoutMs));
    } catch (err) {
      lastErr = err;
      // 큐 포화는 재시도해도 같은 이유로 막힌다 — 즉시 포기하고 자리를 비워준다
      if (err instanceof Error && err.message === "coingecko queue saturated") break;
    }
  }
  throw lastErr;
}

// 주요 거래소 허용목록(CoinGecko 거래소 id) — CoinGecko의 volume/trust 정렬 모두
// 워시트레이딩 거래소(BTCC·Pionex·Tapbit 등, green 뱃지까지 달고 있음)가 상위를 차지해
// API 정렬만으로는 못 거른다. 이용자가 실제 쓰는 주요 거래소로 한정하고 그 안에서 거래대금순.
const MAJOR_EXCHANGES = new Set([
  "upbit", "bithumb", "coinone", "korbit", // 국내
  "binance", "binance_us", "gdax", "okex", "bybit_spot",
  "kraken", "kucoin", "gate", "mexc", "huobi", "htx", "bitget", "bitfinex",
  "crypto_com", "bitstamp", "gemini", "bitvavo", "hyperliquid-spot",
]);

async function fetchCoinExchanges(id: string): Promise<CoinExchangesResult> {
  const url =
    `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/tickers` +
    `?order=volume_desc&depth=false`;
  const data = await fetchJsonWithRetry<{ tickers?: CGTicker[] }>(url, 8000);
  if (!Array.isArray(data.tickers)) throw new Error("coingecko tickers unavailable");

  // 주요 거래소 + 정상 티커만 — 이상치·스테일 제외
  const pool = data.tickers.filter(
    (t) =>
      !t.is_anomaly &&
      !t.is_stale &&
      t.market?.identifier &&
      MAJOR_EXCHANGES.has(t.market.identifier)
  );

  // 거래소별 USD 거래대금 합산 + 대표 페어(볼륨순 첫 trade_url)
  const byExchange = new Map<string, { name: string; url: string | null; volume: number }>();
  for (const t of pool) {
    const key = t.market!.identifier!;
    const entry = byExchange.get(key) ?? { name: t.market!.name ?? key, url: null, volume: 0 };
    entry.volume += t.converted_volume?.usd ?? 0;
    entry.url ??= t.trade_url ?? null; // volume_desc 순서 → 첫 trade_url이 최대 페어
    byExchange.set(key, entry);
  }

  // CoinGecko trade_url에 붙는 제휴 코드(?ref=...) 제거
  const cleanUrl = (raw: string): string => {
    try {
      const u = new URL(raw);
      u.searchParams.delete("ref");
      return u.toString();
    } catch {
      return raw;
    }
  };

  // 상위 3곳 — 주요 거래소 상장이 3곳 미만이면 있는 만큼만(무명 거래소로 채우지 않는다)
  const exchanges: CoinExchange[] = [...byExchange.entries()]
    .filter(([, e]) => e.url != null)
    .sort(([, a], [, b]) => b.volume - a.volume)
    .slice(0, 3)
    .map(([identifier, e]) => ({ name: e.name, identifier, url: cleanUrl(e.url!) }));

  return { exchanges, updatedAt: new Date().toISOString() };
}

const COIN_TICKERS_KEY = (id: string) => `coin-tickers-v4:${id}`;

export async function getCoinExchanges(id: string): Promise<CoinExchangesResult> {
  try {
    // -v4: 주요 거래소 허용목록 + ref 파라미터 제거 — 옛 캐시 무시
    return await cachedJson(COIN_TICKERS_KEY(id), COIN_EXCHANGES_TTL_MS, () =>
      fetchCoinExchanges(id)
    );
  } catch {
    // 실패 시 빈 목록 — 카드에는 코인게코 버튼만 남는다
    return { exchanges: [], updatedAt: new Date(0).toISOString() };
  }
}

// 크론용 — 버블맵 상위 코인의 거래소 캐시를 미리 데운다.
// 클릭 시점에 캐시가 비어 있으면 레이트리밋 큐(2.2초 간격) 때문에 최소 2.4초를 기다려야 한다.
// 캐시가 차 있으면 같은 클릭이 ~60ms에 끝나므로, 콜드 클릭 자체를 없애는 게 가장 큰 개선이다.
// TTL 12h / 크론 1시간 간격이라 매 회차 조금씩만 채워도 상위권은 항상 따뜻하게 유지된다.
export async function warmCoinExchanges(
  maxCoins: number,
  budgetMs: number
): Promise<{ warmed: number; skipped: number }> {
  const deadline = Date.now() + budgetMs;
  const { coins } = await getBubbles();
  if (coins.length === 0) return { warmed: 0, skipped: 0 };

  const wanted = coins.slice(0, maxCoins).map((c) => c.id);
  // 이미 신선한 키는 건너뛴다 — 외부 호출 없이 남은 예산을 미수집 코인에 쓴다
  let fresh = new Set<string>();
  try {
    const cutoff = new Date(Date.now() - COIN_EXCHANGES_TTL_MS);
    const rows = await prisma.marketCache.findMany({
      where: { key: { in: wanted.map(COIN_TICKERS_KEY) }, updatedAt: { gt: cutoff } },
      select: { key: true },
    });
    fresh = new Set(rows.map((r) => r.key));
  } catch {
    // 조회 실패 시엔 전부 대상으로 두고 예산이 허용하는 만큼만 처리
  }

  let warmed = 0;
  const stale = wanted.filter((id) => !fresh.has(COIN_TICKERS_KEY(id)));
  for (const id of stale) {
    if (Date.now() >= deadline) break; // 크론 maxDuration 초과 방지
    await getCoinExchanges(id); // 내부에서 실패를 흡수 — 한 코인 실패가 워밍을 멈추지 않는다
    warmed += 1;
  }
  return { warmed, skipped: stale.length - warmed };
}
