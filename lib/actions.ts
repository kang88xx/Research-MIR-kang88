"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BOX_COST, RARITIES, type Rarity } from "@/lib/box";
import { kstDay, kstDayStartUtc } from "@/lib/time";
import { NICK_MAX_CHANGES, type NicknameResult } from "@/lib/nickname";

const POINTS = { post: 5, comment: 2, attendance: 10 };

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

// 글/댓글 포인트 일일 적립 횟수 상한 (포인트 파밍 방지 — 작성 자체는 막지 않음)
const DAILY_POINT_CAP: Record<string, number> = { post: 10, comment: 20 };

async function underDailyPointCap(userId: string, action: "post" | "comment"): Promise<boolean> {
  const count = await prisma.pointLog.count({
    where: { userId, action, createdAt: { gte: kstDayStartUtc() } },
  });
  return count < DAILY_POINT_CAP[action];
}

// 포인트 적립 + 로그 + 레벨 자동 상승. day가 있으면 (userId, action, day) 유니크 — 출석 중복 방지
async function awardPoints(
  userId: string,
  action: string,
  delta: number,
  day?: string
): Promise<boolean> {
  try {
    await prisma.pointLog.create({ data: { userId, action, delta, day } });
  } catch {
    return false;
  }
  const user = await prisma.user.update({
    where: { id: userId },
    data: { points: { increment: delta } },
  });
  // 100포인트당 1레벨 (최대 Lv9, Lv10+는 운영진 전용이라 건드리지 않음)
  if (user.level < EDITOR_MIN_LEVEL) {
    const level = Math.min(9, Math.floor(user.points / 100) + 1);
    if (level !== user.level) {
      await prisma.user.update({ where: { id: userId }, data: { level } });
    }
  }
  return true;
}

const EDITOR_MIN_LEVEL = 10;

export async function createPost(formData: FormData) {
  const userId = await requireUserId();
  const boardSlug = String(formData.get("board") ?? "free");
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();

  if (!title || title.length > 100) throw new Error("제목은 1~100자로 입력해 주세요.");
  if (!content || content.length > 20000) throw new Error("내용을 입력해 주세요.");

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
  if (await underDailyPointCap(userId, "post")) await awardPoints(userId, "post", POINTS.post);

  const basePath = board.type === "forum" ? `/forum/${board.slug}` : `/${board.slug}`;
  revalidatePath(basePath);
  redirect(`${basePath}/${post.id}`);
}

// 게시글이 속한 보드의 기본 경로(/free · /analysis · /forum/<slug>). 없는 글이면 null.
// 댓글/투표 후 올바른 페이지를 재검증하기 위해 사용 (글은 free 외 보드에도 존재).
async function postBasePath(postId: number): Promise<string | null> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { board: { select: { slug: true, type: true } } },
  });
  if (!post) return null;
  return post.board.type === "forum" ? `/forum/${post.board.slug}` : `/${post.board.slug}`;
}

export async function createComment(postId: number, formData: FormData) {
  const userId = await requireUserId();
  const content = String(formData.get("content") ?? "").trim();
  if (!content || content.length > 2000) throw new Error("댓글 내용을 입력해 주세요.");

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
  if (await underDailyPointCap(userId, "comment")) await awardPoints(userId, "comment", POINTS.comment);

  revalidatePath(`${basePath}/${postId}`);
}

// 코인·주식·해외 종목 자유 입력 (티커에 있는 심볼은 현재가 자동 평가)
function parsePortfolioInput(formData: FormData) {
  const symbol = String(formData.get("symbol") ?? "").toUpperCase().trim();
  const quantity = parseFloat(String(formData.get("quantity") ?? ""));
  const buyPrice = parseFloat(String(formData.get("buyPrice") ?? ""));
  const currency = formData.get("currency") === "USD" ? "USD" : "KRW";

  if (!/^[A-Z0-9.\-]{1,12}$/.test(symbol)) {
    throw new Error("종목 심볼은 영문/숫자 1~12자로 입력해 주세요. (예: BTC, AAPL)");
  }
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("수량을 올바르게 입력해 주세요.");
  if (!Number.isFinite(buyPrice) || buyPrice <= 0) throw new Error("단가를 올바르게 입력해 주세요.");

  return { symbol, quantity, buyPrice, currency };
}

export async function addPortfolioItem(formData: FormData) {
  const userId = await requireUserId();
  const data = parsePortfolioInput(formData);
  await prisma.portfolioItem.create({ data: { userId, ...data } });
  revalidatePath("/dashboard");
}

export async function updatePortfolioItem(id: number, formData: FormData) {
  const userId = await requireUserId();
  const data = parsePortfolioInput(formData);
  await prisma.portfolioItem.updateMany({ where: { id, userId }, data });
  revalidatePath("/dashboard");
}

export async function deletePortfolioItem(id: number) {
  const userId = await requireUserId();
  await prisma.portfolioItem.deleteMany({ where: { id, userId } });
  revalidatePath("/dashboard");
}

export async function checkAttendance() {
  const userId = await requireUserId();
  const day = kstDay();
  const ok = await awardPoints(userId, "attendance", POINTS.attendance, day);
  revalidatePath("/attendance");
  return ok
    ? { ok: true as const, message: "출석 완료! +10P 적립되었습니다." }
    : { ok: false as const, message: "오늘은 이미 출석했습니다." };
}

export async function votePost(postId: number, value: 1 | -1) {
  const userId = await requireUserId();

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
  const userId = await requireUserId();
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

/* ───────────────────────── 랜덤박스 / 어드민 상품 ───────────────────────── */

// 운영진(Lv10+)만 어드민 — 별도 role 컬럼 없이 기존 레벨 관례 재사용
async function requireAdmin(): Promise<string> {
  const userId = await requireUserId();
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { level: true } });
  if (!me || me.level < EDITOR_MIN_LEVEL) {
    throw new Error("운영진만 접근할 수 있습니다.");
  }
  return userId;
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
  "radar",
  "spread",
  "krwStats",
  "trend",
];

export async function refreshMarketData(): Promise<void> {
  try {
    await prisma.marketCache.deleteMany({ where: { key: { in: MARKET_CACHE_KEYS } } });
  } catch {
    // 캐시 비우기 실패는 무시 — 재검증은 그대로 진행
  }
  revalidatePath("/", "layout");
}

type PrizeLite = {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  rarity: string;
};

type BoxResult =
  | { ok: true; prize: PrizeLite; points: number }
  | { ok: false; message: string };

// 랜덤박스 오픈: 가중치 추첨 → (포인트 차감 · 재고 차감 · 당첨내역 · 로그)를 트랜잭션으로 원자 처리.
// 추첨 결과는 전적으로 서버에서 결정 — 클라이언트는 연출만 담당.
export async function openRandomBox(): Promise<BoxResult> {
  const userId = await requireUserId();

  const me = await prisma.user.findUnique({ where: { id: userId }, select: { points: true } });
  if (!me) return { ok: false, message: "사용자를 찾을 수 없습니다." };
  if (me.points < BOX_COST) {
    return { ok: false, message: `포인트가 부족합니다. (${BOX_COST}P 필요)` };
  }

  // 활성 + 재고 남은 상품만 후보
  const pool = await prisma.prize.findMany({
    where: { active: true, OR: [{ stock: null }, { stock: { gt: 0 } }] },
    select: { id: true, name: true, description: true, imageUrl: true, rarity: true, weight: true, stock: true },
  });
  if (pool.length === 0) return { ok: false, message: "등록된 상품이 없습니다." };

  // 가중치 룰렛
  const total = pool.reduce((s, p) => s + Math.max(1, p.weight), 0);
  let roll = Math.random() * total;
  let picked = pool[pool.length - 1];
  for (const p of pool) {
    roll -= Math.max(1, p.weight);
    if (roll <= 0) {
      picked = p;
      break;
    }
  }

  let newPoints = me.points - BOX_COST; // 트랜잭션에서 실제 잔액으로 덮어씀
  try {
    await prisma.$transaction(async (tx) => {
      // 포인트 차감 — 잔액 가드(동시 오픈 시 음수 방지)
      const dec = await tx.user.updateMany({
        where: { id: userId, points: { gte: BOX_COST } },
        data: { points: { decrement: BOX_COST } },
      });
      if (dec.count === 0) throw new Error("INSUFFICIENT");

      // 재고 차감 — 한정 상품이면 0 이하로 못 내려가게 가드
      if (picked.stock != null) {
        const s = await tx.prize.updateMany({
          where: { id: picked.id, stock: { gt: 0 } },
          data: { stock: { decrement: 1 } },
        });
        if (s.count === 0) throw new Error("SOLD_OUT");
      }

      await tx.prizeWin.create({ data: { userId, prizeId: picked.id, cost: BOX_COST } });
      await tx.pointLog.create({ data: { userId, action: "box", delta: -BOX_COST } });
      const fresh = await tx.user.findUnique({ where: { id: userId }, select: { points: true } });
      if (fresh) newPoints = fresh.points;
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "INSUFFICIENT") return { ok: false, message: "포인트가 부족합니다." };
    if (msg === "SOLD_OUT") return { ok: false, message: "방금 상품이 소진됐어요. 다시 시도해 주세요." };
    throw e;
  }

  revalidatePath("/box");
  return {
    ok: true,
    points: newPoints,
    prize: {
      id: picked.id,
      name: picked.name,
      description: picked.description,
      imageUrl: picked.imageUrl,
      rarity: picked.rarity,
    },
  };
}

// ── 어드민: 상품 등록/수정/삭제 ──

function parsePrizeInput(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const imageUrl = String(formData.get("imageUrl") ?? "").trim() || null;
  const rarityRaw = String(formData.get("rarity") ?? "common");
  const rarity: Rarity = (RARITIES as readonly string[]).includes(rarityRaw)
    ? (rarityRaw as Rarity)
    : "common";
  const weight = Math.max(1, Math.min(1_000_000, parseInt(String(formData.get("weight") ?? "100"), 10) || 100));
  const stockRaw = String(formData.get("stock") ?? "").trim();
  const stock = stockRaw === "" ? null : Math.max(0, parseInt(stockRaw, 10) || 0);
  const sortOrder = parseInt(String(formData.get("sortOrder") ?? "0"), 10) || 0;
  const active = formData.get("active") != null;

  if (!name || name.length > 80) throw new Error("상품명은 1~80자로 입력해 주세요.");
  if (imageUrl && !/^https?:\/\//.test(imageUrl)) throw new Error("이미지 URL은 http(s)로 시작해야 합니다.");

  return { name, description, imageUrl, rarity, weight, stock, sortOrder, active };
}

export async function createPrize(formData: FormData) {
  await requireAdmin();
  const data = parsePrizeInput(formData);
  await prisma.prize.create({ data });
  revalidatePath("/admin/prizes");
  revalidatePath("/box");
}

export async function updatePrize(id: number, formData: FormData) {
  await requireAdmin();
  const data = parsePrizeInput(formData);
  await prisma.prize.update({ where: { id }, data });
  revalidatePath("/admin/prizes");
  revalidatePath("/box");
}

export async function deletePrize(id: number) {
  await requireAdmin();
  // 당첨 이력이 있으면 비활성화로 보존(외래키·통계 보호), 없으면 완전 삭제
  const wins = await prisma.prizeWin.count({ where: { prizeId: id } });
  if (wins > 0) {
    await prisma.prize.update({ where: { id }, data: { active: false } });
  } else {
    await prisma.prize.delete({ where: { id } });
  }
  revalidatePath("/admin/prizes");
  revalidatePath("/box");
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
