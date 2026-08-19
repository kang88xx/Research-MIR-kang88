// ── 데일리 시장분석 — "숫자는 자동, 해석은 수동" ──
// 시세·심리·일정은 서버가 작성 시점에 수집해 글 안에 박제하고(발행 후 불변),
// 운영진은 스탠스·견해·포지션별 자문만 쓴다. 글은 Post.content에
// 마커 + JSON으로 저장해 스키마 변경 없이 기존 게시판 인프라(댓글·추천·가격 검증)를 그대로 탄다.
import { prisma } from "@/lib/prisma";
import { getTickers } from "@/lib/ticker";
import { getMarketOverview, getBubbles, fngLabelKo } from "@/lib/market";
import { getMarketBar } from "@/lib/marketbar";
import { upcomingKstRange } from "@/lib/time";

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
  verdict: string; // 판단 한 문장 (히어로)
  opinion: string; // 견해 본문 — 빈 줄로 문단 구분
  advice: DailyAdvice[];
  retro?: string;
  auto: {
    stats: DailyStat[];
    moversUp: string; // "BTW +17.3% · UB +11.7% · LIT +9.7%"
    moversDown: string;
    events: DailyEvent[];
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

// ── 자동 채움 데이터 수집 — 작성 페이지 미리보기와 발행 시점 박제가 공유 ──
export async function buildDailyAuto(): Promise<DailyData["auto"]> {
  const { now, startUtc, endUtc } = upcomingKstRange(8);

  const [tickers, overview, bubbles, bar, calendarEvents] = await Promise.all([
    getTickers(),
    getMarketOverview(),
    getBubbles(),
    getMarketBar(),
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
    stats.push({ label: "BTC", value: manwon(btc.priceKrw), delta: pct(btc.change24h), tone: tone(btc.change24h) });
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

  // ── 급등락 상위 3 — 버블맵 100종 기준 ──
  const ranked = bubbles.coins
    .filter((c) => c.change24h != null)
    .sort((a, b) => (b.change24h ?? 0) - (a.change24h ?? 0));
  const fmtMover = (c: (typeof ranked)[number]) => `${c.symbol.toUpperCase()} ${pct(c.change24h)}`;
  const moversUp = ranked.slice(0, 3).map(fmtMover).join(" · ");
  const moversDown = ranked.slice(-3).reverse().map(fmtMover).join(" · ");

  // ── 일정 — 매크로(중요도 2+) + 언락, 향후 7일 ──
  const todayKst = new Date(startUtc.getTime() + 9 * 3600_000);
  const events: DailyEvent[] = calendarEvents.map((e) => {
    const eventKst = new Date(e.date.getTime() + 9 * 3600_000);
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

  return { stats, moversUp, moversDown, events, capturedAt: new Date(now).toISOString() };
}
