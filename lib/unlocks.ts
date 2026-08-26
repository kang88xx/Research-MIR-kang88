import { prisma } from "@/lib/prisma";
import { cachedJson } from "@/lib/cache";
import { fetchJson } from "@/lib/http";
import { getBubbles } from "@/lib/market";

/* ── 언락 일정 수집 (Coindar API 2.0) ──────────────────────────────
   버블맵 상위 100종목(스테이블 제외)을 기준으로 Coindar의 Token Unlock
   이벤트를 조회해 캘린더 검수 큐(pending_review)에 초안으로 넣는다.
   크론 없음 — 어드민 버튼(/admin/events) 또는 scripts/sync-unlocks.ts 로만 실행.
   Coindar는 크라우드소싱(T3)이라 단독 발행 금지: 공식 원문 확인 후 발행한다.
   (docs/data-collection/sources.yaml coindar 항목 참조) */

const COINDAR_BASE = "https://coindar.org/api/v2";
const COINS_CACHE_KEY = "coindar-coins";
const COINS_TTL_MS = 7 * 24 * 3600_000; // 코인 id 매핑은 거의 안 바뀜
const TAGS_CACHE_KEY = "coindar-tags";
const TAGS_TTL_MS = 30 * 24 * 3600_000;
const LOOKAHEAD_DAYS = 180;

type CoindarCoin = { id: string; name: string; symbol: string };
type CoindarTag = { id: string; name: string };
// 문서 기준 모든 값이 문자열로 온다. date_start는 "yyyy-m-d HH:mm" | "yyyy-m-d" | "yyyy-m" | "yyyy-QX"
type CoindarEvent = {
  caption: string;
  source: string; // Coindar 이벤트 페이지 URL — 응답에 숫자 id가 없어 이 URL이 유일 키
  source_reliable: string;
  important: string;
  date_start: string;
  date_end: string;
  coin_id: string;
  tags: string; // 태그 id CSV
};

export type UnlockSyncResult = {
  ok: boolean;
  message: string;
  totalBubble: number;
  matched: number;
  unmatched: string[];
  fetched: number;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  // 무엇이 바뀌었는지 보고용 상세 목록 (CLI·로그에서 사용)
  createdItems: { date: string; ticker: string; title: string }[];
  updatedItems: { ticker: string; title: string; oldDate: string; newDate: string }[];
};

// 토큰 오류 시에도 HTTP 200 + 문자열 본문("Invalid access_token")이 와서 배열 검사로 판별한다
async function coindarGet<T>(path: string, params: Record<string, string> = {}): Promise<T[]> {
  const token = process.env.COINDAR_ACCESS_TOKEN;
  if (!token) {
    throw new Error("COINDAR_ACCESS_TOKEN이 설정되지 않았습니다. coindar.org 가입 후 발급받아 .env.local에 추가해 주세요.");
  }
  const qs = new URLSearchParams({ access_token: token, ...params });
  const data = await fetchJson<T[] | string>(`${COINDAR_BASE}/${path}?${qs}`, 15000);
  if (!Array.isArray(data)) {
    throw new Error(`Coindar ${path} 응답 오류: ${String(data).slice(0, 80)}`);
  }
  return data;
}

// 코인 목록은 수천 건 — 매핑에 필요한 필드만 남겨 캐시 행 크기를 줄인다
async function getCoindarCoins(): Promise<CoindarCoin[]> {
  return cachedJson(COINS_CACHE_KEY, COINS_TTL_MS, async () => {
    const rows = await coindarGet<CoindarCoin>("coins");
    if (rows.length === 0) throw new Error("Coindar coins 응답이 비어 있습니다.");
    return rows.map((r) => ({ id: String(r.id), name: r.name, symbol: r.symbol }));
  });
}

async function getUnlockTagIds(): Promise<string[]> {
  const tags = await cachedJson(TAGS_CACHE_KEY, TAGS_TTL_MS, async () => {
    const rows = await coindarGet<CoindarTag>("tags");
    if (rows.length === 0) throw new Error("Coindar tags 응답이 비어 있습니다.");
    return rows.map((r) => ({ id: String(r.id), name: r.name }));
  });
  const ids = tags.filter((t) => /unlock/i.test(t.name)).map((t) => t.id);
  if (ids.length === 0) throw new Error("Coindar 태그 목록에서 언락 태그를 찾지 못했습니다.");
  return ids;
}

// 버블맵 심볼 → Coindar 코인 id. 심볼 중복 시 이름 일치로만 확정(오매칭 방지).
function matchCoins(
  bubbles: { symbol: string; name: string }[],
  coindarCoins: CoindarCoin[]
): { idToBubble: Map<string, { symbol: string; name: string }>; unmatched: string[] } {
  const bySymbol = new Map<string, CoindarCoin[]>();
  for (const c of coindarCoins) {
    const key = c.symbol.toUpperCase();
    const list = bySymbol.get(key);
    if (list) list.push(c);
    else bySymbol.set(key, [c]);
  }
  const idToBubble = new Map<string, { symbol: string; name: string }>();
  const unmatched: string[] = [];
  for (const b of bubbles) {
    const candidates = bySymbol.get(b.symbol) ?? [];
    let picked: CoindarCoin | undefined;
    if (candidates.length === 1) picked = candidates[0];
    else if (candidates.length > 1) {
      picked = candidates.find((c) => c.name.trim().toLowerCase() === b.name.trim().toLowerCase());
    }
    if (picked) idToBubble.set(picked.id, b);
    else unmatched.push(b.symbol);
  }
  return { idToBubble, unmatched };
}

const pad = (n: number) => String(n).padStart(2, "0");
const utcDateStr = (d: Date) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

// date_start → 저장용 date/isTba/dateStatus.
// 저장 규칙(lib/actions.ts parseEventInput과 동일): date의 날짜부 = KST 달력 셀,
// 시각부 = 실제 UTC 시각, 00:00:00은 "시각 미지정" 센티널(정확히 UTC 00:00인 이벤트는 초=1).
function parseCoindarDate(
  raw: string
): { date: Date; isTba: boolean; tbaStatus: "tba" | null } | null {
  const dt = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2}) (\d{1,2}):(\d{2})$/);
  if (dt) {
    const [y, mo, d, h, mi] = [+dt[1], +dt[2], +dt[3], +dt[4], +dt[5]];
    const kst = new Date(Date.UTC(y, mo - 1, d, h, mi) + 9 * 3600_000);
    const sec = h === 0 && mi === 0 ? 1 : 0;
    return {
      date: new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate(), h, mi, sec)),
      isTba: false,
      tbaStatus: null,
    };
  }
  const dOnly = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (dOnly) {
    return { date: new Date(Date.UTC(+dOnly[1], +dOnly[2] - 1, +dOnly[3])), isTba: false, tbaStatus: null };
  }
  // 월만 확정 — 어드민 폼 관례("날짜는 그 달 1일로")와 동일하게 TBA 처리
  const mOnly = raw.match(/^(\d{4})-(\d{1,2})$/);
  if (mOnly) {
    return { date: new Date(Date.UTC(+mOnly[1], +mOnly[2] - 1, 1)), isTba: true, tbaStatus: "tba" };
  }
  return null; // 분기 단위("2026-Q3") 등은 캘린더 셀로 못 실음 — 스킵
}

// Coindar 이벤트 URL 끝의 숫자 id로 멱등 키를 만든다 (슬러그·언어 경로 변경에도 안전)
function externalKey(source: string): string {
  const m = source.match(/-(\d+)\/?$/);
  return m ? `coindar:${m[1]}` : `coindar:${source}`;
}

export async function syncUnlockEvents(): Promise<UnlockSyncResult> {
  // 토큰은 여기서 먼저 검사 — cachedJson 내부에서 던지면 "marketCache 사용 불가"로
  // 감싸져 안내 메시지가 어드민 버튼까지 전달되지 않는다.
  if (!process.env.COINDAR_ACCESS_TOKEN) {
    throw new Error("COINDAR_ACCESS_TOKEN이 설정되지 않았습니다. coindar.org 가입 후 발급받아 .env.local에 추가해 주세요.");
  }
  const snapshot = await getBubbles();
  if (snapshot.coins.length === 0) {
    throw new Error("버블맵 스냅샷이 비어 있습니다(CoinGecko 조회 실패). 잠시 후 다시 시도해 주세요.");
  }
  const bubbles = snapshot.coins.map((c) => ({ symbol: c.symbol, name: c.name }));

  const [coindarCoins, unlockTagIds] = await Promise.all([getCoindarCoins(), getUnlockTagIds()]);
  const { idToBubble, unmatched } = matchCoins(bubbles, coindarCoins);
  if (idToBubble.size === 0) throw new Error("버블맵 종목과 Coindar 코인 매칭이 0건입니다.");

  // 오늘(UTC 기준 어제부터, 시차 경계 보호) ~ +180일 언락 이벤트, 페이지네이션
  const now = Date.now();
  const start = utcDateStr(new Date(now - 24 * 3600_000));
  const end = utcDateStr(new Date(now + LOOKAHEAD_DAYS * 24 * 3600_000));
  const events: CoindarEvent[] = [];
  for (let page = 1; page <= 5; page++) {
    const batch = await coindarGet<CoindarEvent>("events", {
      page: String(page),
      page_size: "100",
      filter_date_start: start,
      filter_date_end: end,
      filter_coins: [...idToBubble.keys()].join(","),
      filter_tags: unlockTagIds.join(","),
      sort_by: "date_start",
      order_by: "0",
    });
    events.push(...batch);
    if (batch.length < 100) break;
  }

  // 같은 이벤트가 중복 응답돼도 한 번만 처리
  const seen = new Map<string, CoindarEvent>();
  for (const ev of events) if (!seen.has(externalKey(ev.source))) seen.set(externalKey(ev.source), ev);

  const existing = await prisma.calendarEvent.findMany({
    where: { externalId: { in: [...seen.keys()] } },
    select: { id: true, externalId: true, date: true, isTba: true, reviewStatus: true, ticker: true, title: true },
  });
  const byKey = new Map(existing.map((e) => [e.externalId!, e]));

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let skipped = 0;
  const createdItems: UnlockSyncResult["createdItems"] = [];
  const updatedItems: UnlockSyncResult["updatedItems"] = [];

  for (const [key, ev] of seen) {
    const bubble = idToBubble.get(String(ev.coin_id));
    const parsed = parseCoindarDate(ev.date_start.trim());
    if (!bubble || !parsed) {
      skipped++;
      continue;
    }
    const reliable = ev.source_reliable === "true";
    const dateStatus = parsed.tbaStatus ?? (reliable ? "confirmed" : "estimated");
    const nextCheckMs = parsed.date.getTime() - 7 * 24 * 3600_000; // 언락 = D-7 재확인 관례
    const nextCheck = nextCheckMs > now ? new Date(nextCheckMs) : null;
    const prev = byKey.get(key);

    if (!prev) {
      const caption = ev.caption.trim();
      const title = `${bubble.name}(${bubble.symbol}) 토큰 언락`.slice(0, 80);
      await prisma.calendarEvent.create({
        data: {
          date: parsed.date,
          isTba: parsed.isTba,
          ticker: bubble.symbol.slice(0, 20),
          title,
          description: caption ? `${caption} (출처: Coindar, 공식 원문 확인 후 발행)` : "",
          category: "bad", // 언락은 공급 증가 — 기존 시드 관례와 동일
          groupMain: "크립토",
          groupSub: "언락",
          sourceUrl: ev.source,
          dateStatus,
          importance: ev.important === "true" ? 2 : 1,
          sources: [{ name: "Coindar", url: ev.source, tier: 3, isOfficial: false }],
          reviewStatus: "pending_review",
          nextCheck,
          externalId: key,
        },
      });
      created++;
      createdItems.push({ date: utcDateStr(parsed.date), ticker: bubble.symbol, title });
    } else if (prev.date.getTime() !== parsed.date.getTime() || prev.isTba !== parsed.isTba) {
      // 날짜 변경만 자동 반영 — 제목·설명 등 어드민 수정분은 덮지 않는다.
      // 발행된 이벤트는 needs_recheck로 내려 재확인을 요구한다(캘린더에는 계속 노출).
      await prisma.calendarEvent.update({
        where: { id: prev.id },
        data: {
          date: parsed.date,
          isTba: parsed.isTba,
          dateStatus: "revised",
          reviewStatus: prev.reviewStatus === "published" ? "needs_recheck" : prev.reviewStatus,
          nextCheck,
        },
      });
      updated++;
      updatedItems.push({
        ticker: prev.ticker,
        title: prev.title,
        oldDate: utcDateStr(prev.date),
        newDate: utcDateStr(parsed.date),
      });
    } else {
      unchanged++;
    }
  }

  const parts = [
    `신규 ${created}건`,
    `날짜변경 ${updated}건`,
    `변동없음 ${unchanged}건`,
  ];
  if (skipped > 0) parts.push(`스킵 ${skipped}건`);
  const message =
    `언락 동기화 완료: ${parts.join(", ")} ` +
    `(대상 ${idToBubble.size}/${bubbles.length}종목, 수집 ${seen.size}건` +
    (unmatched.length > 0 ? `, 미매칭 ${unmatched.slice(0, 8).join("·")}${unmatched.length > 8 ? " 외" : ""}` : "") +
    `)`;

  return {
    ok: true,
    message,
    totalBubble: bubbles.length,
    matched: idToBubble.size,
    unmatched,
    fetched: seen.size,
    created,
    updated,
    unchanged,
    skipped,
    createdItems,
    updatedItems,
  };
}
