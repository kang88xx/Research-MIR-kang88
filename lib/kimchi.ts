import { cachedJson } from "@/lib/cache";
import { fetchJson } from "@/lib/http";
import { getTickers, getExchangeComparison, type FxSource } from "@/lib/ticker";
import { getFxHistory } from "@/lib/market";
import { fetchUsdtDailyCloses } from "@/lib/marketbar";

// ── 김치프리미엄 페이지 개요 — 기존 캐시 소스만 조합해 추가 외부 트래픽 최소화 ──
// getTickers(60s)·getExchangeComparison(60s)·getFxHistory(캐시)·업비트 USDT 일봉(여기서 5분 캐시)

export type KimchiDay = { date: string; value: number }; // date: "M/D", value: 김프 %

export type KimchiOverview = {
  usdtKimchi: number | null; // 테더(USDT) 김프 % — 헤드라인
  usdtKrw: number | null; // 업비트 테더 시세(원)
  btcKimchi: number | null; // BTC 김프 % (업비트 vs 바이낸스×환율)
  btcKrw: number | null; // 업비트 BTC 시세(원)
  usdKrw: number | null; // 환율 USD/KRW
  usdKrwSource: FxSource;
  history: KimchiDay[]; // 최근 7일 USDT 김프 추이 (과거→현재)
  updatedAt: string;
};

const TTL_MS = 5 * 60_000;

// 김프 구간 판정 — 페이지 공용 (색·라벨 일관성)
export type KimchiZone = {
  label: string; // 한글 상태
  desc: string; // 한 줄 해석
  tone: "deep-discount" | "discount" | "neutral" | "premium" | "overheat";
};

export function kimchiZone(pct: number | null): KimchiZone {
  if (pct == null)
    return {
      label: "표시 보류",
      desc: "환율·시세 수신이 불안정해 김프를 표시하지 않습니다. 잠시 후 다시 확인하세요.",
      tone: "neutral",
    };
  if (pct <= -2)
    return {
      label: "심한 역프리미엄",
      desc: "국내가가 해외보다 크게 낮음 — 국내 매수세 위축·자금 유출 신호",
      tone: "deep-discount",
    };
  if (pct <= -0.5)
    return {
      label: "역프리미엄",
      desc: "국내가가 해외보다 낮음 — 국내 수요가 상대적으로 약한 구간",
      tone: "discount",
    };
  if (pct < 1)
    return {
      label: "중립",
      desc: "국내외 가격이 대체로 균형 — 뚜렷한 쏠림 없음",
      tone: "neutral",
    };
  if (pct < 3)
    return {
      label: "프리미엄",
      desc: "국내가가 해외보다 높음 — 국내 매수세가 우위인 구간",
      tone: "premium",
    };
  return {
    label: "과열",
    desc: "김프 +3% 이상 — 국내 수요 과열, 역사적으로 단기 고점 부근에서 자주 관찰",
    tone: "overheat",
  };
}

async function fetchKimchiOverview(): Promise<KimchiOverview> {
  const [snapshot, exchanges, fxHistory, usdtDaily] = await Promise.all([
    getTickers(),
    getExchangeComparison(),
    getFxHistory(),
    fetchUsdtDailyCloses(),
  ]);

  // 환율이 고정 폴백(추정치)이면 김프를 계산하지 않는다 — 가짜 환율로 만든 김프가
  // "과열/역프" 헤드라인으로 나가는 것을 차단 (P1: FALLBACK_USD_KRW 1380 오표시 방지).
  const fxTrusted = snapshot.usdKrwSource !== "fallback";
  const usdKrw = snapshot.usdKrw > 0 ? snapshot.usdKrw : null;
  const usdtKrw = exchanges.usdtUpbit ?? null;
  const usdtKimchi =
    fxTrusted && usdtKrw != null && usdKrw != null ? (usdtKrw / usdKrw - 1) * 100 : null;

  const btcRow = snapshot.tickers.find((t) => t.symbol === "BTC");
  // BTC 김프도 같은 환율로 계산된 값이므로 폴백 환율이면 신뢰 불가 → 숨김
  const btcKimchi = fxTrusted ? btcRow?.kimchiPremium ?? null : null;
  const btcKrw = btcRow?.priceKrw ?? null;

  // 일봉 USDT 종가 ÷ 해당일(이하 최근 영업일) 환율 → 김프 % 시리즈 (최근 7일)
  const fxSorted = fxHistory.filter((p) => p.rate > 0).sort((a, b) => a.date.localeCompare(b.date));
  const fxFor = (date: string): number | null => {
    if (fxSorted.length === 0) return null;
    let rate = fxSorted[0].rate;
    for (const p of fxSorted) if (p.date <= date) rate = p.rate;
    return rate;
  };
  const history: KimchiDay[] = usdtDaily
    .map((d) => {
      const rate = fxFor(d.date);
      if (rate == null) return null;
      const [, mm, dd] = d.date.split("-");
      return { date: `${Number(mm)}/${Number(dd)}`, value: (d.close / rate - 1) * 100 };
    })
    .filter((d): d is KimchiDay => d != null)
    .slice(-7);

  // 핵심값이 하나도 없으면 실패 처리 — 캐시의 직전 정상값 보존
  if (usdtKimchi == null && btcKimchi == null && history.length === 0) {
    throw new Error("kimchi overview unavailable");
  }

  return {
    usdtKimchi,
    usdtKrw,
    btcKimchi,
    btcKrw,
    usdKrw,
    usdKrwSource: snapshot.usdKrwSource,
    history,
    updatedAt: new Date().toISOString(),
  };
}

export async function getKimchiOverview(): Promise<KimchiOverview> {
  try {
    return await cachedJson("kimchiOverview:v1", TTL_MS, fetchKimchiOverview);
  } catch {
    return {
      usdtKimchi: null,
      usdtKrw: null,
      btcKimchi: null,
      btcKrw: null,
      usdKrw: null,
      usdKrwSource: "fallback",
      history: [],
      updatedAt: new Date(0).toISOString(),
    };
  }
}

// ── 장기 김프 히스토리 — 추이 팝업(일간·주간·월간)용 ──
// 업비트 USDT 일봉 200일 + Yahoo 환율 1년치로 일별 김프 시리즈를 만든다.
// 팝업에서만 쓰는 저빈도 데이터라 30분 캐시로 외부 호출을 억제한다.

export type KimchiHistoryDay = { date: string; value: number }; // date: "YYYY-MM-DD"
export type KimchiHistory = { days: KimchiHistoryDay[]; updatedAt: string };

const HISTORY_TTL_MS = 30 * 60_000;

async function fetchUsdtDailyClosesLong(): Promise<{ date: string; close: number }[]> {
  const rows = await fetchJson<{ candle_date_time_kst: string; trade_price: number }[]>(
    "https://api.upbit.com/v1/candles/days?market=KRW-USDT&count=200",
    7000
  );
  if (!Array.isArray(rows)) throw new Error("upbit USDT candles malformed");
  return rows
    .map((r) => ({ date: r.candle_date_time_kst.slice(0, 10), close: r.trade_price }))
    .filter((d) => Number.isFinite(d.close) && d.close > 0)
    .reverse();
}

// 환율 1년치 — Yahoo KRW=X (marketbar의 6일 버전과 동일 소스, 범위만 다름)
async function fetchFxHistoryLong(): Promise<{ date: string; rate: number }[]> {
  const res = await fetch(
    "https://query1.finance.yahoo.com/v8/finance/chart/KRW=X?interval=1d&range=1y",
    {
      signal: AbortSignal.timeout(7000),
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
    }
  );
  if (!res.ok) throw new Error(`yahoo KRW=X 1y -> ${res.status}`);
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
    .filter((p) => p.rate > 0);
  if (points.length === 0) throw new Error("yahoo fx 1y empty");
  return points;
}

async function fetchKimchiHistory(): Promise<KimchiHistory> {
  const [daily, fxHistory] = await Promise.all([fetchUsdtDailyClosesLong(), fetchFxHistoryLong()]);
  const fxSorted = fxHistory.sort((a, b) => a.date.localeCompare(b.date));
  // 대상일 이하 중 가장 최근 환율 — 주말·휴일은 직전 영업일 값으로 대체
  const fxFor = (date: string): number | null => {
    if (fxSorted.length === 0 || date < fxSorted[0].date) return null;
    let rate = fxSorted[0].rate;
    for (const p of fxSorted) if (p.date <= date) rate = p.rate;
    return rate;
  };
  const days: KimchiHistoryDay[] = daily
    .map((d) => {
      const rate = fxFor(d.date);
      return rate != null ? { date: d.date, value: (d.close / rate - 1) * 100 } : null;
    })
    .filter((d): d is KimchiHistoryDay => d != null);
  if (days.length === 0) throw new Error("kimchi history unavailable");
  return { days, updatedAt: new Date().toISOString() };
}

export async function getKimchiHistory(): Promise<KimchiHistory> {
  try {
    return await cachedJson("kimchiHistory:v1", HISTORY_TTL_MS, fetchKimchiHistory);
  } catch {
    return { days: [], updatedAt: new Date(0).toISOString() };
  }
}
