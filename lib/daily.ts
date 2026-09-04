// ── 데일리 시장분석 — "숫자는 자동, 해석은 수동" ──
// 시세·심리·일정은 서버가 작성 시점에 수집해 글 안에 박제하고(발행 후 불변),
// 운영진은 스탠스·견해·포지션별 자문만 쓴다. 글은 Post.content에
// 마커 + JSON으로 저장해 스키마 변경 없이 기존 게시판 인프라(댓글·추천·가격 검증)를 그대로 탄다.
import { prisma } from "@/lib/prisma";
import { cachedJson } from "@/lib/cache";
import { getTickers } from "@/lib/ticker";
import { getMarketOverview, getBubbles, fngLabelKo } from "@/lib/market";
import { getMarketBar } from "@/lib/marketbar";
import { parseTelegramPreview } from "@/lib/telegram";
import { upcomingKstRange, KST_MS } from "@/lib/time";

export const DAILY_MARKER = "[[KMIR-DAILY-V1]]";

// 스탠스 5단계 — 게이지 순서 그대로. key는 저장값, label은 표시값.
export const STANCES = [
  { key: "reduce", label: "축소" },
  { key: "conservative", label: "보수" },
  { key: "wait", label: "관망" },
  { key: "selective", label: "선별 매수" },
  { key: "expand", label: "확대" },
] as const;
export type StanceKey = (typeof STANCES)[number]["key"];

export function stanceLabel(key: string): string {
  return STANCES.find((s) => s.key === key)?.label ?? key;
}

// 스탠스 필 색 — 방어(레드·오커) ↔ 공격(그린) 의미 스케일, 토큰 참조로 다크 모드 자동 추종
export const STANCE_COLOR: Record<string, string> = {
  reduce: "var(--color-up)",
  conservative: "var(--color-neutral)",
  wait: "var(--color-warn)",
  selective: "var(--color-live)",
  expand: "var(--color-good)",
};

// 스탠스 칩 글리프 — Chip의 ChipIconName과 짝. 색만으로 구분하던 필에 형태 단서를 더해
// 색각 이상·흑백 출력에서도 방어/공격이 읽히게 한다.
export const STANCE_ICON: Record<string, string> = {
  reduce: "down",
  conservative: "shield",
  wait: "clock",
  selective: "target",
  expand: "trend",
};

// ── BTC 다음날 방향 예측 — 발행 다음날 같은 시각(09:00 KST) 가격으로 자동 판정·공개 ──
// 관망(neutral)은 "변동성이 거의 없다"는 예측: ±BAND% 미만 횡보해야 적중.
// 상방/하방은 각각 +BAND% 이상 / -BAND% 이하로 움직여야 적중 — 애매한 움직임에
// 방향을 걸면 미적중이 되므로, 확신 없는 날은 관망을 고르는 유인이 구조에 내장된다.
export const DIRECTIONS = [
  { key: "up", label: "상방" },
  { key: "down", label: "하방" },
  { key: "neutral", label: "관망" },
] as const;
export type DirectionKey = (typeof DIRECTIONS)[number]["key"];

export function directionLabel(key: string): string {
  return DIRECTIONS.find((d) => d.key === key)?.label ?? key;
}

export const DIRECTION_COLOR: Record<string, string> = {
  up: "var(--color-up)",
  down: "var(--color-down)",
  neutral: "var(--color-neutral)",
};

// 방향 예측 칩 글리프 — 상방↑ / 하방↓ / 관망 —
export const DIRECTION_ICON: Record<string, string> = {
  up: "up",
  down: "down",
  neutral: "flat",
};

export const DIRECTION_BAND_PCT = 1.0; // 적중 판정 기준 변동폭 (%)

// 예측 적중 여부 — changePct는 발행 시점 대비 다음날 판정 시점의 BTC 변동률(%)
export function judgeDirection(direction: DirectionKey, changePct: number): boolean {
  if (direction === "up") return changePct >= DIRECTION_BAND_PCT;
  if (direction === "down") return changePct <= -DIRECTION_BAND_PCT;
  return Math.abs(changePct) < DIRECTION_BAND_PCT;
}

// 포지션별 자문 — 행(포지션)은 고정, 액션 톤과 한 줄 조언만 매일 달라진다
export const ADVICE_POSITIONS = ["현물 보유", "신규 진입", "단기 트레이딩"] as const;
export const ADVICE_ACTIONS = [
  { key: "hold", label: "유지" },
  { key: "add", label: "확대" },
  { key: "wait", label: "대기" },
  { key: "avoid", label: "경계" },
  { key: "cut", label: "축소" },
] as const;
export type AdviceActionKey = (typeof ADVICE_ACTIONS)[number]["key"];

export function adviceActionLabel(key: string): string {
  return ADVICE_ACTIONS.find((a) => a.key === key)?.label ?? key;
}

export type DailyStat = {
  label: string;
  value: string;
  delta?: string;
  tone?: "up" | "down" | "flat";
};

export type DailyEvent = {
  dday: string; // "D-DAY" | "D-3"
  date: string; // "8/12(수)"
  title: string;
  importance: number; // 1~3
  unlock: boolean;
  estimated: boolean;
};

export type DailyAdvice = { position: string; action: AdviceActionKey; note: string };

export type DailyData = {
  v: 1;
  stance: StanceKey;
  direction?: DirectionKey; // 다음날 BTC 방향 예측 — 구버전 글에는 없음(판정 대상 제외)
  verdict: string; // 판단 한 문장 (히어로)
  opinion: string; // 견해 본문 — 빈 줄로 문단 구분
  advice: DailyAdvice[];
  retro?: string;
  auto: {
    stats: DailyStat[];
    moversUp: string; // "BTW +17.3% · UB +11.7% · LIT +9.7%"
    moversDown: string;
    events: DailyEvent[];
    news?: string[]; // 기관·규제 뉴스 스니펫 — AI 입력 박제(감사용), 비공식 수집
    capturedAt: string; // ISO
  };
};

export function serializeDaily(data: DailyData): string {
  return `${DAILY_MARKER}\n${JSON.stringify(data)}`;
}

// 데일리 글인지 판별해 파싱. 일반 글이면 null — 렌더러가 기존 본문 경로로 처리.
export function parseDaily(content: string): DailyData | null {
  if (!content.startsWith(DAILY_MARKER)) return null;
  try {
    const data = JSON.parse(content.slice(DAILY_MARKER.length)) as DailyData;
    return data.v === 1 && data.stance && data.verdict ? data : null;
  } catch {
    return null;
  }
}

// 목록 미리보기 — JSON 원문 대신 판단 한 문장을 보여준다
export function dailyPreviewText(content: string): string | null {
  const d = parseDaily(content);
  return d ? d.verdict : null;
}

const pct = (n: number | null | undefined): string =>
  n == null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;

const tone = (n: number | null | undefined): "up" | "down" | "flat" =>
  n == null || n === 0 ? "flat" : n > 0 ? "up" : "down";

// 만원 단위 축약 — 데일리 스탯 스트립은 좁아서 원 단위 전체 표기가 넘친다
const manwon = (krw: number | null): string =>
  krw == null ? "—" : `${Math.round(krw / 10_000).toLocaleString("ko-KR")}만원`;

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

// ── 기관·규제 뉴스 수집 — 미국 크립토 법안·규제, 기업/은행권의 BTC·ETH 대규모 매수 ──
// 봇·API 키 없이 t.me/s 공개 프리뷰에서 최근 24시간 포스트를 키워드로 거른다.
// 비공식 스니펫이므로 AI 프롬프트에서 "사실 단정 금지, 판단 참고용"으로만 쓰게 한다.
const NEWS_CHANNELS = [
  { handle: "WalterBloomberg", name: "Walter Bloomberg", cryptoOnly: false }, // 종합 속보 — 크립토 키워드 필수
  { handle: "BWEnews", name: "BWEnews", cryptoOnly: true }, // 크립토 전문 속보
  { handle: "spotonchain", name: "Spot On Chain", cryptoOnly: true }, // 온체인 대규모 이동 추적
];
// 규제·법안 + 기관 매수 시그널 키워드 (영문 채널 기준, 한국어 보조)
const NEWS_TOPIC_RE =
  /(SEC|CFTC|ETF|\bbill\b|\bact\b|regulat|congress|senate|white house|treasur|legislation|stablecoin|reserve|\bFed\b|GENIUS|CLARITY|bought|buys?\b|purchas|acquir|accumulat|adds?\s+[\d$]|holdings?|MicroStrategy|\bStrategy\b|Metaplanet|BlackRock|Fidelity|Vanguard|JPMorgan|Goldman|Morgan Stanley|\bbank\b|custod|법안|규제|매수|매입|보유)/i;
const NEWS_CRYPTO_RE = /(bitcoin|\bbtc\b|ethereum|\beth\b|crypto|coin|token|digital asset|blockchain|비트코인|이더리움|크립토|코인)/i;
const NEWS_MAX = 8;

async function collectRegulatoryNews(): Promise<string[]> {
  const cutoff = Date.now() - 24 * 3600_000;
  const perChannel = await Promise.all(
    NEWS_CHANNELS.map(async (ch) => {
      try {
        const res = await fetch(`https://t.me/s/${ch.handle}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
          headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
        });
        if (!res.ok) return [];
        return parseTelegramPreview(await res.text(), ch.handle, 20)
          .filter((p) => new Date(p.dateIso).getTime() >= cutoff)
          .map((p) => ({ ch, text: `${p.title} ${p.excerpt}`.trim(), at: p.dateIso }))
          .filter(
            (x) => NEWS_TOPIC_RE.test(x.text) && (ch.cryptoOnly || NEWS_CRYPTO_RE.test(x.text))
          );
      } catch {
        return []; // 채널 단위 실패 허용 — 뉴스는 보조 입력
      }
    })
  );
  return perChannel
    .flat()
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, NEWS_MAX)
    .map((x) => `[${x.ch.name}] ${x.text.slice(0, 220)}`);
}

// 30분 캐시 — 크론 발행과 수기 작성 미리보기가 공유, 실패 시 빈 배열
async function getRegulatoryNews(): Promise<string[]> {
  try {
    return await cachedJson("dailyNews:v1", 30 * 60_000, collectRegulatoryNews);
  } catch {
    return [];
  }
}

// 조 단위 달러 축약 — "$3.82T" / "$982B"
const usdCompact = (n: number | null | undefined): string => {
  if (n == null) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${Math.round(n / 1e9).toLocaleString("en-US")}B`;
  return `$${Math.round(n / 1e6).toLocaleString("en-US")}M`;
};

// ── 자동 채움 데이터 수집 — 작성 페이지 미리보기와 발행 시점 박제가 공유 ──
export async function buildDailyAuto(): Promise<DailyData["auto"]> {
  const { now, startUtc, endUtc } = upcomingKstRange(8);

  const [tickers, overview, bubbles, bar, news, prevDaily, calendarEvents] = await Promise.all([
    getTickers(),
    getMarketOverview(),
    getBubbles(),
    getMarketBar(),
    getRegulatoryNews(),
    // 직전 데일리의 BTC 기록가 — 스탯 스트립의 BTC 변동률을 "전일(직전 데일리) 대비"로 표기해
    // 방향 예측 적중 판정(priceAtPost 대비)과 같은 기준을 쓰게 한다.
    prisma.post
      .findFirst({
        where: { board: { slug: "analysis" }, content: { startsWith: DAILY_MARKER }, priceAtPost: { not: null } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { priceAtPost: true },
      })
      .catch(() => null),
    prisma.calendarEvent
      .findMany({
        where: {
          date: { gte: startUtc, lt: endUtc },
          reviewStatus: "published",
          OR: [
            { groupMain: "매크로", importance: { gte: 2 } },
            { groupSub: "언락" },
          ],
        },
        orderBy: [{ date: "asc" }, { importance: "desc" }],
        take: 10,
        select: {
          date: true,
          title: true,
          importance: true,
          groupSub: true,
          dateStatus: true,
        },
      })
      .catch(() => []),
  ]);

  // ── 스탯 스트립 ──
  const stats: DailyStat[] = [];
  const btc = tickers.tickers.find((t) => t.symbol === "BTC");
  const eth = tickers.tickers.find((t) => t.symbol === "ETH");
  if (btc) {
    // 전일(직전 데일리 기록가) 대비 변동률. 직전 데일리가 없으면 24h 변동률로 대체.
    const prevKrw = prevDaily?.priceAtPost ?? null;
    const vsPrev =
      btc.priceKrw != null && prevKrw != null && prevKrw > 0 ? ((btc.priceKrw - prevKrw) / prevKrw) * 100 : null;
    const btcChange = vsPrev ?? btc.change24h;
    stats.push({
      label: "BTC",
      value: manwon(btc.priceKrw),
      delta: vsPrev != null ? `전일 ${pct(vsPrev)}` : pct(btc.change24h),
      tone: tone(btcChange),
    });
    stats.push({ label: "김프", value: pct(btc.kimchiPremium), tone: tone(btc.kimchiPremium) });
  }
  if (eth) {
    stats.push({ label: "ETH", value: manwon(eth.priceKrw), delta: pct(eth.change24h), tone: tone(eth.change24h) });
  }

  const fng = overview.fearGreed;
  const fngToday = fng?.at(-1);
  const fngPrev = fng?.at(-2);
  if (fngToday) {
    stats.push({
      label: "공포탐욕",
      value: `${fngToday.value} ${fngLabelKo(fngToday.classification)}`,
      delta: fngPrev ? `전일 ${fngPrev.value}` : undefined,
      tone: "flat",
    });
  }

  stats.push({ label: "환율", value: tickers.usdKrw.toLocaleString("ko-KR", { maximumFractionDigits: 1 }) });

  const gold = bar.tiles.find((t) => t.key === "gold");
  if (gold?.value) {
    stats.push({ label: "금", value: gold.value, delta: pct(gold.changePct), tone: tone(gold.changePct) });
  }

  // ── 유동성 — 크립토 총 시총(24h 변화)·BTC 도미넌스·BTC/ETH 24h 거래대금 ──
  if (overview.totalMarketCapUsd != null) {
    stats.push({
      label: "총시총",
      value: usdCompact(overview.totalMarketCapUsd),
      delta: overview.marketCapChange24h != null ? pct(overview.marketCapChange24h) : undefined,
      tone: tone(overview.marketCapChange24h),
    });
  }
  if (overview.btcDominance != null) {
    stats.push({ label: "BTC 도미넌스", value: `${overview.btcDominance.toFixed(1)}%` });
  }
  const btcBubble = bubbles.coins.find((c) => c.symbol.toUpperCase() === "BTC");
  const ethBubble = bubbles.coins.find((c) => c.symbol.toUpperCase() === "ETH");
  if (btcBubble?.volume24h != null) {
    stats.push({ label: "BTC 거래대금", value: usdCompact(btcBubble.volume24h) });
  }
  if (ethBubble?.volume24h != null) {
    stats.push({ label: "ETH 거래대금", value: usdCompact(ethBubble.volume24h) });
  }

  // ── 급등락 상위 3 — 버블맵 100종 기준 ──
  const ranked = bubbles.coins
    .filter((c) => c.change24h != null)
    .sort((a, b) => (b.change24h ?? 0) - (a.change24h ?? 0));
  const fmtMover = (c: (typeof ranked)[number]) => `${c.symbol.toUpperCase()} ${pct(c.change24h)}`;
  const moversUp = ranked.slice(0, 3).map(fmtMover).join(" · ");
  const moversDown = ranked.slice(-3).reverse().map(fmtMover).join(" · ");

  // ── 일정 — 매크로(중요도 2+) + 언락, 향후 7일 ──
  const todayKst = new Date(startUtc.getTime() + KST_MS);
  const events: DailyEvent[] = calendarEvents.map((e) => {
    const eventKst = new Date(e.date.getTime() + KST_MS);
    const diffDays = Math.round(
      (Date.UTC(eventKst.getUTCFullYear(), eventKst.getUTCMonth(), eventKst.getUTCDate()) -
        Date.UTC(todayKst.getUTCFullYear(), todayKst.getUTCMonth(), todayKst.getUTCDate())) /
        86400_000
    );
    return {
      dday: diffDays <= 0 ? "D-DAY" : `D-${diffDays}`,
      date: `${eventKst.getUTCMonth() + 1}/${eventKst.getUTCDate()}(${WEEKDAY_KO[eventKst.getUTCDay()]})`,
      title: e.title,
      importance: e.importance,
      unlock: e.groupSub === "언락",
      estimated: e.dateStatus !== "confirmed",
    };
  });

  return {
    stats,
    moversUp,
    moversDown,
    events,
    news: news.length ? news : undefined,
    capturedAt: new Date(now).toISOString(),
  };
}
