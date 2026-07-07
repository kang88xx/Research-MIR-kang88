import { cachedJson } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import { kstDay } from "@/lib/time";

// 연동 텔레그램 채널 — 홈 위젯 + 상장·상폐 후보 추출의 유일한 소스.
// (운영 결정 2026-07-07: 거래소 공지 4종 수집기 대신 이 채널에서만 추출. docs/data-collection 참조)
const CHANNEL = "kang_tearoom";
const CHANNEL_NAME = "강프로 찻방";
const FEED_KEY = "telegramFeed:v1";
const FEED_TTL_MS = 15 * 60_000; // 15분 — t.me 공개 프리뷰 폴링 주기
const MAX_POSTS = 12;

export type TgPost = {
  id: number; // 메시지 ID (t.me/{channel}/{id})
  url: string;
  title: string; // 본문 첫 줄
  excerpt: string; // 나머지 본문 미리보기
  dateIso: string; // 게시 시각 (ISO)
  views: string; // t.me 표기 그대로 ("540", "1.2K")
};
export type TelegramFeed = {
  channel: string; // 핸들 (@ 제외)
  channelName: string;
  posts: TgPost[]; // 최신순
  updatedAt: string;
};

// t.me/s HTML 엔티티 → 텍스트. &amp;는 마지막에 풀어야 "&amp;lt;" 같은 중첩 인코딩이 이중 디코딩되지 않는다.
function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

// 메시지 본문 HTML → 평문 (줄바꿈 보존)
function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  )
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// t.me/s/{channel} 공개 프리뷰 파싱 — 메시지 ID·본문·시각·조회수.
// 비공식 마크업이라 구조 변경 시 깨질 수 있음 → 실패 시 cachedJson이 stale 데이터로 폴백.
export function parseTelegramPreview(html: string): TgPost[] {
  const chunks = html.split('class="tgme_widget_message_wrap').slice(1);
  const posts: TgPost[] = [];
  for (const chunk of chunks) {
    const idMatch = chunk.match(new RegExp(`data-post="${CHANNEL}/(\\d+)"`));
    const textMatch = chunk.match(/tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/);
    const timeMatch = chunk.match(/<time datetime="([^"]+)"/);
    const viewsMatch = chunk.match(/tgme_widget_message_views">([^<]+)</);
    if (!idMatch || !textMatch || !timeMatch) continue; // 서비스 메시지(사진만 등) 제외
    const text = htmlToText(textMatch[1]);
    if (!text) continue;
    const lines = text.split(/\n+/).filter(Boolean);
    const id = Number(idMatch[1]);
    posts.push({
      id,
      url: `https://t.me/${CHANNEL}/${id}`,
      title: lines[0].slice(0, 80),
      excerpt: lines.slice(1).join(" ").slice(0, 160),
      dateIso: timeMatch[1],
      views: viewsMatch?.[1]?.trim() ?? "",
    });
  }
  // 페이지는 과거→최신 순 → 최신순으로 뒤집어 최근 N개
  return posts.reverse().slice(0, MAX_POSTS);
}

// ── 상장·상폐 후보 추출 → 캘린더 검수 큐(pending_review) 자동 기입 ──
// 발행은 어드민 검수(공식 원문 확인·날짜 확정) 후에만 — T3 2소스 원칙 (docs/data-collection §5)

const DELIST_RE = /상장\s*폐지|상폐|거래지원\s*종료|유의\s*종목|delist/i;
const LIST_RE = /상장|거래지원|리스팅|\blisting\b/i;

// 본문에서 티커 추정 — $BTC / KRW-BTC / (BTC) 패턴
function guessTicker(text: string): string {
  const m =
    text.match(/\$([A-Z0-9]{2,10})\b/) ??
    text.match(/\b(?:KRW|BTC|USDT)-([A-Z0-9]{1,10})\b/) ??
    text.match(/\(([A-Z0-9]{2,10})\)/);
  return m?.[1] ?? "코인";
}

// 처리 완료한 포스트 ID 기록 — 어드민이 초안을 삭제하거나 출처를 교체해도 다음 폴링에서
// 같은 포스트로 초안이 부활/중복 생성되지 않도록 한다. (URL 존재 검사만으로는 부족)
const SEEN_KEY = "telegramSeenPosts";
const SEEN_CAP = 500;

async function readSeenIds(): Promise<Set<number>> {
  try {
    const row = await prisma.marketCache.findUnique({ where: { key: SEEN_KEY }, select: { data: true } });
    return new Set(Array.isArray(row?.data) ? (row.data as number[]).filter((n) => Number.isInteger(n)) : []);
  } catch {
    return new Set();
  }
}

async function writeSeenIds(ids: Set<number>): Promise<void> {
  const arr = [...ids].sort((a, b) => a - b).slice(-SEEN_CAP); // 오래된 ID부터 잘라냄
  try {
    await prisma.marketCache.upsert({
      where: { key: SEEN_KEY },
      update: { data: arr },
      create: { key: SEEN_KEY, data: arr },
    });
  } catch {
    // 기록 실패 시 다음 폴링에서 재시도 (findFirst 검사로 2차 방어)
  }
}

// 게시글에서 상장/상폐 후보를 찾아 검수 큐에 기입 (포스트 ID + URL 이중 멱등).
// 주의: 인스턴스 간 동시 실행(캐시 만료 직후 동시 요청)에는 이론상 중복 가능 —
// 검수 큐에서 사람이 거르는 전제라 unique 제약 대신 허용한다.
async function extractListingDrafts(posts: TgPost[]): Promise<number> {
  let created = 0;
  const seen = await readSeenIds();
  let seenChanged = false;
  for (const p of posts) {
    if (seen.has(p.id)) continue;
    const text = `${p.title}\n${p.excerpt}`;
    const isDelist = DELIST_RE.test(text);
    const isList = !isDelist && LIST_RE.test(text);
    if (!isDelist && !isList) {
      seen.add(p.id); // 비매칭 포스트도 기록해 매 폴링 재검사 방지
      seenChanged = true;
      continue;
    }

    try {
      const exists = await prisma.calendarEvent.findFirst({
        where: { sourceUrl: p.url },
        select: { id: true },
      });
      if (exists) {
        seen.add(p.id);
        seenChanged = true;
        continue;
      }

      const ticker = guessTicker(text);
      await prisma.calendarEvent.create({
        data: {
          date: new Date(`${kstDay(new Date(p.dateIso))}T00:00:00Z`), // 포착일(KST) — 검수 때 실제 일정으로 수정
          isTba: false,
          ticker,
          title: `${ticker} ${isDelist ? "상폐·거래지원 종료" : "상장"} 후보 (텔레그램 포착)`.slice(0, 80),
          description: `${text.slice(0, 300)}\n\n※ ${CHANNEL_NAME} 채널에서 자동 포착된 후보입니다. 공식 공지 원문을 확인해 날짜·내용을 수정한 뒤 발행하세요.`,
          category: isDelist ? "bad" : "good",
          groupMain: "크립토",
          groupSub: isDelist ? "상폐·리스크" : "TGE·상장",
          sourceUrl: p.url,
          dateStatus: "estimated",
          importance: 2,
          reviewStatus: "pending_review",
          sources: [{ name: `${CHANNEL_NAME} (텔레그램)`, url: p.url, tier: 3, isOfficial: false }],
        },
      });
      created++;
      seen.add(p.id); // 생성 성공 후에만 기록 — 실패 건은 다음 폴링에서 재시도
      seenChanged = true;
    } catch {
      // 개별 실패는 다음 폴링에서 재시도
    }
  }
  if (seenChanged) await writeSeenIds(seen);
  return created;
}

// 수집 본체 — t.me/s 조회 + 파싱 + 상장 후보 추출. 위젯 캐시(fetcher)와 크론이 공유.
// 주의: 검수 큐 초안 생성(DB 쓰기)이 홈 SSR의 캐시 갱신 경로에서도 실행된다 — 무료 플랜에선
// 크론이 하루 1회뿐이라 의도한 트레이드오프. 포스트 ID 멱등 처리로 중복 기입은 방지된다.
export async function collectTelegramFeed(): Promise<TelegramFeed> {
  const res = await fetch(`https://t.me/s/${CHANNEL}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
  });
  if (!res.ok) throw new Error(`t.me/s/${CHANNEL} ${res.status}`);
  const posts = parseTelegramPreview(await res.text());
  if (posts.length === 0) throw new Error("telegram preview parse: 0 posts"); // 마크업 변경 감지 → stale 폴백
  await extractListingDrafts(posts);
  return { channel: CHANNEL, channelName: CHANNEL_NAME, posts, updatedAt: new Date().toISOString() };
}

// 홈 위젯용 — DB 캐시(15분 SWR). 실패 시 null (위젯이 샘플 데이터로 폴백).
export async function getTelegramFeed(): Promise<TelegramFeed | null> {
  try {
    return await cachedJson(FEED_KEY, FEED_TTL_MS, collectTelegramFeed);
  } catch {
    return null;
  }
}

// 크론·헬스체크용 — 강제 갱신. cachedJson을 거치지 않고 직접 수집해 실패를 그대로 전파한다
// (cachedJson은 실패 시 stale 캐시로 폴백하므로, 이를 쓰면 수집이 며칠째 깨져도 ok로 보고되는 문제)
export async function refreshTelegramFeed(): Promise<TelegramFeed> {
  const feed = await collectTelegramFeed();
  try {
    await prisma.marketCache.upsert({
      where: { key: FEED_KEY },
      update: { data: feed as object },
      create: { key: FEED_KEY, data: feed as object },
    });
  } catch {
    // 캐시 기록 실패해도 수집 자체는 성공 — 피드는 반환
  }
  return feed;
}
