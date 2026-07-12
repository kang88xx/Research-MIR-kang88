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
  reactions: number; // 이모지 반응 총합 (♥ 468 등) — 프리뷰에서 파싱, 없으면 0
};
export type TelegramFeed = {
  channel: string; // 핸들 (@ 제외)
  channelName: string;
  posts: TgPost[]; // 최신순
  updatedAt: string;
};

// ── 인기 포스팅 (멀티 채널) ──
// 한국 크립토 채널 25곳(2026-07-12 telemetr.io 랭킹에서 큐레이션, 전 채널 t.me/s 프리뷰 검증)
// 에서 조회수 상위 12개를 뽑는다. 제외 원칙(운영 결정 2026-07-12): 거래소 공지·실시간 알람·
// 봇/자동 중계(예: 새우잡이어선 — 거래소 공지 리포스트 봇)·뉴스 매체(고빈도로 순위 독식)·
// 미러 중복 채널(예: hoon_trading은 shipalnam과 동일 글 게시 → 한쪽만 유지).
export type TgRankedPost = TgPost & {
  channel: string; // 핸들 (@ 제외)
  channelName: string;
  viewCount: number; // views 표기를 숫자화 ("1.2K" → 1200)
  score: number; // 랭킹 점수 — 조회수·반응 혼합 (아래 rankScore 참조)
};
export type TelegramPopular = {
  posts: TgRankedPost[]; // 조회수 내림차순 톱 N
  channelsOk: number; // 이번 수집에서 성공한 채널 수 (30 미만이면 일부 실패)
  updatedAt: string;
};

const POPULAR_KEY = "telegramPopular:v1";
const POPULAR_TTL_MS = 15 * 60_000; // 15분 — 30채널 × 96사이클/일 ≈ 2,900요청으로 차단 리스크 억제
const POPULAR_TOP = 12;
const POPULAR_WINDOW_MS = 24 * 3600_000; // 1차 랭킹 윈도우 — 부족하면 72h로 확장
const FETCH_CONCURRENCY = 10;

const POPULAR_CHANNELS: { handle: string; name: string }[] = [
  // 시황·분석·인플루언서
  { handle: "twitchoong", name: "우리는 트윗충" },
  { handle: "godofcandle", name: "캔들의 신 관점" },
  { handle: "bchosn", name: "변창호 코인사관학교" },
  { handle: "seaotterbtc", name: "해달의 투자 정보" },
  { handle: "fireant_crypto", name: "불개미 CRYPTO" },
  { handle: "shipalnam", name: "쉽게 알려주는 남자" },
  { handle: "chavoonnam", name: "차분남" },
  { handle: "murphybus", name: "은퇴번복 머피" },
  { handle: "waitstudy", name: "매실남" },
  { handle: "bit_dtr", name: "코인에 미친남자" },
  { handle: "dontak00", name: "돈타쿠" },
  { handle: "gemhive", name: "젬하 크립토" },
  { handle: "cryptofamily_ilhyun", name: "조일현" },
  { handle: "researchsena", name: "세나 리서치" },
  // 커뮤니티·정보공유
  { handle: "wecryptotogether", name: "코인같이투자" },
  { handle: "enjoymyhobby", name: "취미생활방" },
  { handle: "bsc_farmer_kr", name: "DeFi 농부 조선생" },
  { handle: "marshallog", name: "마샬 공유방" },
  { handle: "btc_alt_info", name: "코인 정보 공유방" },
  { handle: "kookookoob", name: "쿠쿠쿱" },
  { handle: "gensencoin", name: "갱생코인" },
  { handle: "rowna999", name: "로우나의 투자방" },
  { handle: "c0wfarm", name: "흑우농장" },
  { handle: "chikointhebox", name: "치코의 택배상자" },
  { handle: "raoni1", name: "라오니" },
];

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
export function parseTelegramPreview(html: string, channel: string = CHANNEL, limit: number = MAX_POSTS): TgPost[] {
  const chunks = html.split('class="tgme_widget_message_wrap').slice(1);
  const posts: TgPost[] = [];
  for (const chunk of chunks) {
    const idMatch = chunk.match(new RegExp(`data-post="${channel}/(\\d+)"`));
    const textMatch = chunk.match(/tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/);
    const timeMatch = chunk.match(/<time datetime="([^"]+)"/);
    const viewsMatch = chunk.match(/tgme_widget_message_views">([^<]+)</);
    if (!idMatch || !textMatch || !timeMatch) continue; // 서비스 메시지(사진만 등) 제외
    const text = htmlToText(textMatch[1]);
    if (!text) continue;
    const lines = text.split(/\n+/).filter(Boolean);
    const id = Number(idMatch[1]);

    // 이모지 반응 총합 — <span class="tgme_reaction"><i ...><b>❤</b></i>184</span> 형태의 수치 합산.
    // 마크업 변형(커스텀 이모지 등)으로 못 읽으면 0 — 랭킹에서 불리해질 뿐 수집은 계속된다.
    let reactions = 0;
    const reactionsBlock = chunk.match(/tgme_widget_message_reactions[\s\S]*?(?=<div class="tgme_widget_message_footer)/);
    if (reactionsBlock) {
      for (const m of reactionsBlock[0].matchAll(/<\/i>\s*([\d.,]+[KM]?)\s*<\/span>/gi)) {
        reactions += viewsToNumber(m[1]);
      }
    }

    posts.push({
      id,
      url: `https://t.me/${channel}/${id}`,
      title: lines[0].slice(0, 80),
      excerpt: lines.slice(1).join(" ").slice(0, 160),
      dateIso: timeMatch[1],
      views: viewsMatch?.[1]?.trim() ?? "",
      reactions,
    });
  }
  // 페이지는 과거→최신 순 → 최신순으로 뒤집어 최근 N개
  return posts.reverse().slice(0, limit);
}

// t.me 조회수 표기 → 숫자 ("540" / "1.2K" / "3.4M"). 파싱 불가 시 0 (순위 최하위로 밀림)
export function viewsToNumber(v: string): number {
  const m = v.trim().match(/^([\d.,]+)\s*([KM]?)$/i);
  if (!m) return 0;
  const n = parseFloat(m[1].replace(/,/g, ""));
  if (!Number.isFinite(n)) return 0;
  const unit = m[2].toUpperCase();
  return Math.round(n * (unit === "M" ? 1e6 : unit === "K" ? 1e3 : 1));
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

// ── 인기 포스팅 수집 본체 ──

// 랭킹 점수 — 조회수 단독 랭킹은 뷰봇(조회수 조작)에 취약해 반응 참여를 곱연산으로 섞는다.
//   score = views^0.7 × (reactions+1)^0.3
// 뷰봇은 조회수만 부풀리고 반응은 못 만들므로: 반응 0 × 2만뷰 ≈ 1,000점 < 반응 400 × 1만뷰 ≈ 3,800점.
// 반응 기능을 끈 채널은 전 포스트 반응 0이라 일괄 불이익 → 중립 참여율(조회수의 1%)로 대체한다.
const NEUTRAL_REACTION_RATE = 0.01; // 정상 채널의 통상 반응/조회 비율 하한 근사
function rankScore(viewCount: number, reactions: number): number {
  return Math.pow(Math.max(viewCount, 1), 0.7) * Math.pow(reactions + 1, 0.3);
}

// 단일 채널 수집 — 실패는 null (일부 채널 실패 허용)
async function fetchChannelPosts(ch: { handle: string; name: string }): Promise<TgRankedPost[] | null> {
  try {
    const res = await fetch(`https://t.me/s/${ch.handle}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
    });
    if (!res.ok) return null;
    // 프리뷰 페이지는 최근 ~20개를 담는다 — 랭킹 후보로 전부 수집
    const posts = parseTelegramPreview(await res.text(), ch.handle, 20);
    const reactionsOff = posts.every((p) => p.reactions === 0); // 채널이 반응 기능을 껐다고 간주
    return posts.map((p) => {
      const viewCount = viewsToNumber(p.views);
      return {
        ...p,
        channel: ch.handle,
        channelName: ch.name,
        viewCount,
        score: rankScore(viewCount, reactionsOff ? Math.round(viewCount * NEUTRAL_REACTION_RATE) : p.reactions),
      };
    });
  } catch {
    return null;
  }
}

// 30채널 병렬 수집(동시성 제한) → 24h 윈도우 조회수 톱12 (부족 시 72h → 전체 최신순 보충).
// 강프로 찻방(상장·상폐 추출 파이프라인)은 랭킹 풀에 넣지 않고 별도 15분 캐시로 함께 갱신한다.
export async function collectTelegramPopular(): Promise<TelegramPopular> {
  const results: (TgRankedPost[] | null)[] = [];
  for (let i = 0; i < POPULAR_CHANNELS.length; i += FETCH_CONCURRENCY) {
    const batch = POPULAR_CHANNELS.slice(i, i + FETCH_CONCURRENCY);
    results.push(...(await Promise.all(batch.map(fetchChannelPosts))));
  }
  const ok = results.filter((r) => r !== null);
  // 과반 실패면 수집 실패로 간주 → cachedJson이 stale 캐시로 폴백
  if (ok.length < POPULAR_CHANNELS.length / 2) {
    throw new Error(`telegram popular: ${ok.length}/${POPULAR_CHANNELS.length} channels only`);
  }

  const all = ok.flat();
  const now = Date.now();
  const inWindow = (p: TgRankedPost, ms: number) => now - new Date(p.dateIso).getTime() < ms;
  const byScore = (a: TgRankedPost, b: TgRankedPost) => b.score - a.score;

  // 채널당 대표작(점수 최고) 1개씩만 — 톱12에 같은 채널이 절대 중복되지 않는다.
  // 24h 내 포스팅 채널이 12곳 미만이면(주말·새벽) 72h → 전체로 윈도우를 넓혀 다른 채널로 충원.
  const bestByChannel = new Map<string, TgRankedPost>();
  const addBest = (candidates: TgRankedPost[]) => {
    for (const p of candidates) {
      const cur = bestByChannel.get(p.channel);
      if (!cur || p.score > cur.score) bestByChannel.set(p.channel, p);
    }
  };
  addBest(all.filter((p) => inWindow(p, POPULAR_WINDOW_MS)));
  if (bestByChannel.size < POPULAR_TOP) {
    addBest(all.filter((p) => inWindow(p, 3 * POPULAR_WINDOW_MS) && !bestByChannel.has(p.channel)));
  }
  if (bestByChannel.size < POPULAR_TOP) {
    addBest(all.filter((p) => !bestByChannel.has(p.channel)));
  }

  return {
    posts: [...bestByChannel.values()].sort(byScore).slice(0, POPULAR_TOP),
    channelsOk: ok.length,
    updatedAt: new Date().toISOString(),
  };
}

// 홈 위젯용 — DB 캐시(15분 SWR). 실패 시 null (위젯이 샘플 데이터로 폴백).
// 상장·상폐 후보 추출(강프로 찻방)도 같은 사이클에서 계속 돌도록 여기서 함께 트리거한다.
export async function getTelegramPopular(): Promise<TelegramPopular | null> {
  try {
    const [popular] = await Promise.all([
      cachedJson(POPULAR_KEY, POPULAR_TTL_MS, collectTelegramPopular),
      getTelegramFeed(), // 자체 15분 캐시 — 만료 시에만 실제 수집·추출 실행
    ]);
    return popular;
  } catch {
    return null;
  }
}

// 크론·헬스체크용 — 강제 갱신 (stale 폴백 없이 실패 전파)
export async function refreshTelegramPopular(): Promise<TelegramPopular> {
  const popular = await collectTelegramPopular();
  try {
    await prisma.marketCache.upsert({
      where: { key: POPULAR_KEY },
      update: { data: popular as object },
      create: { key: POPULAR_KEY, data: popular as object },
    });
  } catch {
    // 캐시 기록 실패해도 수집 자체는 성공
  }
  return popular;
}
