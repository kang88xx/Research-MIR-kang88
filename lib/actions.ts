"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NICK_MAX_CHANGES, type NicknameResult } from "@/lib/nickname";
import { EDITOR_MIN_LEVEL } from "@/lib/roles";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

// 승인된(또는 운영진) 회원만 통과. 서버 액션은 proxy.ts 페이지 게이트와 별개의 POST
// 엔드포인트이므로(승인 대기 유저도 /pending 경유로 액션 호출 가능), 콘텐츠를 변경하는
// 모든 액션은 이 헬퍼로 승인 여부를 직접 재확인한다(Codex 지적 P1).
async function requireApprovedUserId(): Promise<string> {
  const userId = await requireUserId();
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { approved: true, level: true },
  });
  if (!me || (!me.approved && me.level < EDITOR_MIN_LEVEL)) {
    throw new Error("관리자 승인 후 이용할 수 있습니다.");
  }
  return userId;
}

export async function createPost(formData: FormData) {
  const userId = await requireApprovedUserId();
  const boardSlug = String(formData.get("board") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();

  if (!title || title.length > 100) throw new Error("제목은 1~100자로 입력해 주세요.");
  if (!content || content.length > 20000) throw new Error("내용을 입력해 주세요.");

  // 도배 방지 — 사용자당 10분 5건. 저장소 장애 시 fail-closed(막음)로 우회 불가.
  const { checkRateLimit } = await import("@/lib/ratelimit");
  if (!(await checkRateLimit(`post:${userId}`, 5, 10 * 60_000, true))) {
    throw new Error("글을 너무 자주 작성하고 있습니다. 잠시 후 다시 시도해 주세요.");
  }

  const board = await prisma.board.findUnique({ where: { slug: boardSlug } });
  if (!board) throw new Error("게시판을 찾을 수 없습니다.");

  // 시장 분석 게시판: 운영진 전용 + 작성 시점 가격 자동 기록 (예측 검증용)
  let priceAtPost: number | null = null;
  let priceSymbol: string | null = null;
  if (board.slug === "analysis") {
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { level: true } });
    if (!me || me.level < EDITOR_MIN_LEVEL) {
      throw new Error("시장 분석 글은 운영진만 작성할 수 있습니다.");
    }
    const symbol = String(formData.get("symbol") ?? "BTC");
    const { getTickers } = await import("@/lib/ticker");
    const snapshot = await getTickers();
    const ticker = snapshot.tickers.find((t) => t.symbol === symbol);
    if (ticker?.priceKrw != null) {
      priceAtPost = ticker.priceKrw;
      priceSymbol = symbol;
    }
  }

  const post = await prisma.post.create({
    data: { boardId: board.id, userId, title, content, priceAtPost, priceSymbol },
  });

  const basePath = board.type === "forum" ? `/forum/${board.slug}` : `/${board.slug}`;
  revalidatePath(basePath);
  redirect(`${basePath}/${post.id}`);
}

// ── 데일리 시장분석 발행 — 자동 데이터(시세·심리·일정)는 발행 시점에 수집해 박제 ──
export async function createDailyPost(formData: FormData) {
  const userId = await requireApprovedUserId();
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { level: true } });
  if (!me || me.level < EDITOR_MIN_LEVEL) {
    throw new Error("시장 분석 글은 운영진만 작성할 수 있습니다.");
  }

  const { STANCES, DIRECTIONS, ADVICE_POSITIONS, ADVICE_ACTIONS, buildDailyAuto, serializeDaily } =
    await import("@/lib/daily");

  const title = String(formData.get("title") ?? "").trim();
  const stance = String(formData.get("stance") ?? "");
  const direction = String(formData.get("direction") ?? "");
  const verdict = String(formData.get("verdict") ?? "").trim();
  const opinion = String(formData.get("opinion") ?? "").trim();
  const retro = String(formData.get("retro") ?? "").trim();

  if (!title || title.length > 100) throw new Error("제목은 1~100자로 입력해 주세요.");
  if (!STANCES.some((s) => s.key === stance)) throw new Error("스탠스를 선택해 주세요.");
  if (!DIRECTIONS.some((d) => d.key === direction))
    throw new Error("내일 BTC 방향 예측을 선택해 주세요.");
  if (!verdict || verdict.length > 200) throw new Error("오늘의 판단을 1~200자로 입력해 주세요.");
  if (!opinion || opinion.length > 10000) throw new Error("견해 본문을 입력해 주세요.");

  const advice = ADVICE_POSITIONS.map((position, i) => {
    const action = String(formData.get(`advice-action-${i}`) ?? "");
    const note = String(formData.get(`advice-note-${i}`) ?? "").trim();
    if (!ADVICE_ACTIONS.some((a) => a.key === action)) throw new Error("자문 액션을 선택해 주세요.");
    if (!note || note.length > 300) throw new Error(`${position} 자문을 1~300자로 입력해 주세요.`);
    return { position, action: action as (typeof ADVICE_ACTIONS)[number]["key"], note };
  });

  const board = await prisma.board.findUnique({ where: { slug: "analysis" } });
  if (!board) throw new Error("게시판을 찾을 수 없습니다.");

  const auto = await buildDailyAuto();
  const content = serializeDaily({
    v: 1,
    stance: stance as (typeof STANCES)[number]["key"],
    direction: direction as (typeof DIRECTIONS)[number]["key"],
    verdict,
    opinion,
    advice,
    retro: retro || undefined,
    auto,
  });

  // 가격 검증은 기존 규칙 그대로 — 데일리는 BTC 기준 고정
  const { getTickers } = await import("@/lib/ticker");
  const snapshot = await getTickers();
  const btc = snapshot.tickers.find((t) => t.symbol === "BTC");

  const post = await prisma.post.create({
    data: {
      boardId: board.id,
      userId,
      title,
      content,
      priceAtPost: btc?.priceKrw ?? null,
      priceSymbol: btc?.priceKrw != null ? "BTC" : null,
    },
  });

  revalidatePath("/analysis");
  redirect(`/analysis/${post.id}`);
}

// 게시글이 속한 보드의 기본 경로(/analysis · /forum/<slug>). 없는 글이면 null.
// 댓글/투표 후 올바른 페이지를 재검증하기 위해 사용.
async function postBasePath(postId: number): Promise<string | null> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { board: { select: { slug: true, type: true } } },
  });
  if (!post) return null;
  return post.board.type === "forum" ? `/forum/${post.board.slug}` : `/${post.board.slug}`;
}

export async function createComment(postId: number, formData: FormData) {
  const userId = await requireApprovedUserId();
  if (!Number.isInteger(postId)) throw new Error("잘못된 요청입니다.");
  const content = String(formData.get("content") ?? "").trim();
  if (!content || content.length > 2000) throw new Error("댓글 내용을 입력해 주세요.");

  // 도배 방지 — 사용자당 5분 10건. 저장소 장애 시 fail-closed(막음)로 우회 불가.
  const { checkRateLimit } = await import("@/lib/ratelimit");
  if (!(await checkRateLimit(`comment:${userId}`, 10, 5 * 60_000, true))) {
    throw new Error("댓글을 너무 자주 작성하고 있습니다. 잠시 후 다시 시도해 주세요.");
  }

  // 존재 확인 + 실제 보드 경로 확보 (없는 글이면 raw Prisma 오류 대신 친화적 메시지)
  const basePath = await postBasePath(postId);
  if (!basePath) throw new Error("게시글을 찾을 수 없습니다.");

  await prisma.$transaction([
    prisma.comment.create({ data: { postId, userId, content } }),
    prisma.post.update({
      where: { id: postId },
      data: { commentCount: { increment: 1 } },
    }),
  ]);

  revalidatePath(`${basePath}/${postId}`);
}

export async function votePost(postId: number, value: 1 | -1) {
  const userId = await requireApprovedUserId();
  // 서버 액션 인자는 클라이언트가 임의 값으로 호출 가능 — 타입 표기만 믿지 않고 런타임 검증
  if (value !== 1 && value !== -1) return { ok: false as const, message: "잘못된 요청입니다." };
  if (!Number.isInteger(postId)) return { ok: false as const, message: "잘못된 요청입니다." };

  const basePath = await postBasePath(postId);
  if (!basePath) return { ok: false as const, message: "게시글을 찾을 수 없습니다." };

  const existing = await prisma.vote.findUnique({
    where: { postId_userId: { postId, userId } },
  });
  if (existing) {
    return { ok: false as const, message: "이미 투표한 글입니다." };
  }

  try {
    await prisma.$transaction([
      prisma.vote.create({ data: { postId, userId, value } }),
      prisma.post.update({
        where: { id: postId },
        data: value === 1 ? { upvotes: { increment: 1 } } : { downvotes: { increment: 1 } },
      }),
    ]);
  } catch (e) {
    // 동시 투표 race — 유니크 제약(P2002) 위반은 "이미 투표"로 정상 처리
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return { ok: false as const, message: "이미 투표한 글입니다." };
    }
    throw e;
  }

  revalidatePath(`${basePath}/${postId}`);
  return { ok: true as const, message: value === 1 ? "추천했습니다." : "비추천했습니다." };
}

export async function logout() {
  const { signOut } = await import("@/lib/auth");
  await signOut({ redirectTo: "/" });
}

/* ───────────────────────── 닉네임 설정/변경 ───────────────────────── */

// 닉네임 설정/변경. 구글 신규(미확정)는 최초 1회 무료, 그 외엔 총 3회까지 차감.
export async function changeNickname(formData: FormData): Promise<NicknameResult> {
  const userId = await requireApprovedUserId();
  const nickname = String(formData.get("nickname") ?? "").trim();

  if (nickname.length < 2 || nickname.length > 12) {
    return { ok: false, message: "닉네임은 2~12자로 입력해 주세요." };
  }
  if (/\s/.test(nickname)) {
    return { ok: false, message: "닉네임에 공백은 사용할 수 없습니다." };
  }

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { nickname: true, nicknameChanges: true, nicknameConfirmed: true },
  });
  if (!me) return { ok: false, message: "사용자를 찾을 수 없습니다." };

  const isInitial = !me.nicknameConfirmed; // 미확정 → 최초 설정(무료)
  const remainingBefore = NICK_MAX_CHANGES - me.nicknameChanges;

  // 같은 닉: 미확정이면 확정 처리만, 확정이면 무변경
  if (nickname === me.nickname) {
    if (isInitial) {
      await prisma.user.update({ where: { id: userId }, data: { nicknameConfirmed: true } });
      revalidatePath("/settings");
      revalidatePath("/", "layout");
      return { ok: true, message: "닉네임이 설정되었습니다.", remaining: remainingBefore };
    }
    return { ok: false, message: "현재 닉네임과 동일합니다.", remaining: remainingBefore };
  }

  // 확정 사용자만 횟수 제한 적용
  if (!isInitial && me.nicknameChanges >= NICK_MAX_CHANGES) {
    return { ok: false, message: `닉네임은 최대 ${NICK_MAX_CHANGES}회까지만 변경할 수 있습니다.`, remaining: 0 };
  }

  const dup = await prisma.user.findUnique({ where: { nickname }, select: { id: true } });
  if (dup) return { ok: false, message: "이미 사용 중인 닉네임입니다.", remaining: remainingBefore };

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        nickname,
        nicknameConfirmed: true,
        ...(isInitial ? {} : { nicknameChanges: { increment: 1 } }),
      },
    });
  } catch {
    // 중복 확인과 갱신 사이의 동시 변경 (유니크 제약 위반)
    return { ok: false, message: "이미 사용 중인 닉네임입니다.", remaining: remainingBefore };
  }

  revalidatePath("/settings");
  revalidatePath("/", "layout"); // 헤더 닉네임 즉시 갱신
  const remaining = isInitial ? NICK_MAX_CHANGES : NICK_MAX_CHANGES - (me.nicknameChanges + 1);
  return {
    ok: true,
    message: isInitial ? "닉네임이 설정되었습니다." : `닉네임을 변경했습니다. (남은 변경 ${remaining}회)`,
    remaining,
  };
}

/* ───────────────────────── 운영진 권한 ───────────────────────── */

// 운영진(Lv10+)만 어드민 — 별도 role 컬럼 없이 기존 레벨 관례 재사용
async function requireAdmin(): Promise<string> {
  const userId = await requireUserId();
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { level: true } });
  if (!me || me.level < EDITOR_MIN_LEVEL) {
    throw new Error("운영진만 접근할 수 있습니다.");
  }
  return userId;
}

// 회원 승인/해제 — 승인 전 계정은 proxy.ts 게이트가 사이트 열람을 막는다.
// 운영진(Lv10+) 계정은 게이트를 항상 통과하므로 여기서 해제해도 잠기지 않는다.
export async function setMemberApproval(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const approve = formData.get("approve") === "1";
  if (!userId) throw new Error("대상 회원이 없습니다.");

  await prisma.user.update({
    where: { id: userId },
    data: { approved: approve, approvedAt: approve ? new Date() : null },
  });
  revalidatePath("/admin/members");
}

export async function isAdmin(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { level: true },
  });
  return !!me && me.level >= EDITOR_MIN_LEVEL;
}

// 업데이트 버튼 — 시세 캐시를 비우고 강제로 새 데이터를 받아오게 한 뒤 전체 재검증.
// (무거운 스크랩 listings·bubbles는 제외 — 해당 페이지에서만 필요)
const MARKET_CACHE_KEYS = [
  "marketbar",
  "tickers",
  "exchange",
  "overview",
  "fxHistory",
  "kimchi",
  "spread",
];

export async function refreshMarketData(): Promise<void> {
  // 승인 회원만 + 사용자별 60초 & 전역 20초 쿨다운 — 반복 캐시 비우기로 외부 API를
  // 두들기는 악용 차단. failClosed=true: DB 장애 시 rate limit이 열려서 삭제가 통과하는
  // 우회를 막는다(쿨다운 판정 불가면 캐시 삭제 없이 재검증만).
  const userId = await requireApprovedUserId();
  const { checkRateLimit } = await import("@/lib/ratelimit");
  // 순차 검사 + 실패 시 환불 — 전역 쿨다운에 막혔을 뿐인데 사용자 60초 슬롯까지
  // 소비되는 것을 막는다(Codex 교차검수). 환불 실패는 무시(다음 창에서 자연 회복).
  const userKey = `refresh:user:${userId}`;
  const userOk = await checkRateLimit(userKey, 1, 60_000, true);
  const globalOk = userOk && (await checkRateLimit("refresh:global", 1, 20_000, true));
  if (userOk && !globalOk) {
    await prisma.rateLimit
      .updateMany({ where: { key: userKey, count: { gt: 0 } }, data: { count: { decrement: 1 } } })
      .catch(() => {});
  }
  if (userOk && globalOk) {
    try {
      await prisma.marketCache.deleteMany({ where: { key: { in: MARKET_CACHE_KEYS } } });
    } catch {
      // 캐시 비우기 실패는 무시 — 재검증은 그대로 진행
    }
  }
  revalidatePath("/", "layout");
}

/* ───────────────────────── 캘린더 이벤트 (어드민 입력·검수) ─────────────────────────
   docs/data-collection/templates/event-entry.md 양식을 폼으로 옮긴 것.
   T3(SNS·뉴스) 발견 이벤트는 pending_review로 두고 공식 원문 확인 후 발행한다. */

const EVENT_CATEGORIES = ["important", "good", "bad", "neutral"] as const;
const EVENT_GROUPS = ["크립토", "주식", "매크로", "이벤트"] as const;
const EVENT_DATE_STATUSES = ["confirmed", "estimated", "tba", "revised", "postponed", "cancelled"] as const;
const EVENT_REVIEW_STATUSES = ["draft", "pending_review", "published", "needs_recheck", "archived"] as const;

function pickEnum<T extends readonly string[]>(v: unknown, allowed: T, fallback: T[number]): T[number] {
  const s = String(v ?? "");
  return (allowed as readonly string[]).includes(s) ? (s as T[number]) : fallback;
}

function parseEventInput(formData: FormData) {
  const dateStr = String(formData.get("date") ?? "").trim(); // KST 달력일 "YYYY-MM-DD"
  const timeStr = String(formData.get("time") ?? "").trim(); // KST "HH:MM" (선택)
  const ticker = String(formData.get("ticker") ?? "").trim().toUpperCase();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const groupSub = String(formData.get("groupSub") ?? "").trim() || "기타";
  const isTba = formData.get("isTba") != null;
  const importance = Math.min(3, Math.max(1, parseInt(String(formData.get("importance") ?? "1"), 10) || 1));
  const nextCheckStr = String(formData.get("nextCheck") ?? "").trim();

  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error("날짜는 YYYY-MM-DD 형식으로 입력해 주세요.");
  if (!ticker || ticker.length > 20) throw new Error("티커는 1~20자로 입력해 주세요.");
  if (!title || title.length > 80) throw new Error("제목은 1~80자로 입력해 주세요.");
  if (description.length > 2000) throw new Error("설명은 2000자 이내로 입력해 주세요.");

  // TBA 이중 소스 정합 — isTba 체크박스와 dateStatus="tba" 중 하나만 켜도 둘 다 TBA로 통일
  let dateStatus = pickEnum(formData.get("dateStatus"), EVENT_DATE_STATUSES, "confirmed");
  let tba = isTba;
  if (dateStatus === "tba") tba = true;
  else if (tba) dateStatus = "tba";

  // 저장 규칙: date = 달력 셀(UTC 자정). 시각 입력 시 KST HH:MM → UTC (kstH+15)%24 로 같은 셀에 싣는다.
  // KST 00:00~08:59 입력은 "셀 날짜의 익일 새벽"으로 표시됨 (기존 FOMC 표기 관례와 동일).
  let date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  // 존재하지 않는 날짜(2/31 등)가 Date.UTC에서 다음 달로 조용히 넘어가는 것을 차단
  if (
    date.getUTCFullYear() !== Number(m[1]) ||
    date.getUTCMonth() !== Number(m[2]) - 1 ||
    date.getUTCDate() !== Number(m[3])
  ) {
    throw new Error(`존재하지 않는 날짜입니다: ${dateStr}`);
  }
  const tm = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (tm && !tba) {
    const kstH = Math.min(23, Number(tm[1]));
    const min = Math.min(59, Number(tm[2]));
    const utcH = (kstH + 15) % 24;
    // KST 09:00은 UTC 00:00이 되어 "시각 미지정" 센티널(00:00:00)과 충돌 → 초=1 마커로 구분
    // (표시는 HH:MM까지라 사용자에게는 동일하게 09:00으로 보인다)
    const sec = utcH === 0 && min === 0 ? 1 : 0;
    date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), utcH, min, sec));
  }

  // 출처 1~3행 — 전부 보존 (name+url 있는 행만). 첫 행이 대표 sourceUrl(호환)로 들어간다.
  const sources: { name: string; url: string; tier: number; isOfficial: boolean }[] = [];
  for (const i of [1, 2, 3]) {
    const name = String(formData.get(`srcName${i}`) ?? "").trim();
    const url = String(formData.get(`srcUrl${i}`) ?? "").trim();
    if (!name || !url) continue;
    if (!/^https?:\/\//.test(url)) throw new Error(`출처 ${i} URL은 http(s)로 시작해야 합니다.`);
    sources.push({
      name,
      url,
      tier: Math.min(3, Math.max(1, parseInt(String(formData.get(`srcTier${i}`) ?? "3"), 10) || 3)),
      isOfficial: formData.get(`srcOfficial${i}`) != null,
    });
  }

  let nextCheck: Date | null = null;
  const nc = nextCheckStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (nc) nextCheck = new Date(Date.UTC(Number(nc[1]), Number(nc[2]) - 1, Number(nc[3])));

  return {
    date,
    isTba: tba,
    ticker,
    title,
    description,
    category: pickEnum(formData.get("category"), EVENT_CATEGORIES, "neutral"),
    groupMain: pickEnum(formData.get("groupMain"), EVENT_GROUPS, "크립토"),
    groupSub: groupSub.slice(0, 20),
    sourceUrl: sources[0]?.url ?? null,
    dateStatus,
    importance,
    sources,
    reviewStatus: pickEnum(formData.get("reviewStatus"), EVENT_REVIEW_STATUSES, "draft"),
    nextCheck,
  };
}

function revalidateCalendar() {
  revalidatePath("/admin/events");
  revalidatePath("/");
  revalidatePath("/calendar");
}

export async function createCalendarEvent(formData: FormData) {
  await requireAdmin();
  await prisma.calendarEvent.create({ data: parseEventInput(formData) });
  revalidateCalendar();
}

export async function updateCalendarEvent(id: number, formData: FormData) {
  await requireAdmin();
  const data = parseEventInput(formData);
  // 출처를 하나도 입력하지 않은 수정은 기존 대표 sourceUrl을 보존한다
  // (구 데이터는 sources 없이 sourceUrl만 있어, 무관한 필드 수정으로 출처가 지워지는 사고 방지)
  if (data.sources.length === 0) {
    const rest: Partial<typeof data> = { ...data };
    delete rest.sourceUrl;
    await prisma.calendarEvent.update({ where: { id }, data: rest });
  } else {
    await prisma.calendarEvent.update({ where: { id }, data });
  }
  revalidateCalendar();
}

export async function deleteCalendarEvent(id: number) {
  await requireAdmin();
  await prisma.calendarEvent.delete({ where: { id } });
  revalidateCalendar();
}

// 검수 큐 → 발행 승격. T3 이벤트는 공식 원문(출처) 확인 후 눌러야 한다.
export async function publishCalendarEvent(id: number) {
  await requireAdmin();
  await prisma.calendarEvent.update({
    where: { id },
    data: { reviewStatus: "published" },
  });
  revalidateCalendar();
}
