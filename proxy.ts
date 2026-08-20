import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ADMIN_MIN_LEVEL } from "@/lib/roles";

// 회원 전용 사이트 게이트 — 구글 로그인 + 어드민 승인(approved)까지 마친 계정만 열람 가능.
// 운영진(Lv10+)은 승인 여부와 무관하게 통과(운영자 본인이 잠기는 사고 방지).
// Next 16: middleware.ts가 proxy.ts로 개명, 기본 Node 런타임이라 Prisma 조회 가능.

// 게이트를 거치지 않는 공개 경로
// - /login: 로그인 화면 (비로그인 진입점)
// - /api/auth: NextAuth OAuth 콜백·세션
// - /api/cron: Vercel 크론 — 세션 없이 CRON_SECRET Bearer로 자체 인증
function isPublic(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/cron/")
  );
}

// 승인·레벨 조회 스로틀 — 매 요청 DB 조회는 Neon(무료)의 절전을 막아 월 컴퓨트 한도를
// 소진시키는 최대 상시 부하였다(버블맵 5분 폴링만으로도 DB가 계속 깨어 있음).
// 인스턴스 메모리에 60초 캐시해 요청당 조회를 인스턴스당 유저당 분당 1회로 줄인다.
// 트레이드오프: 승인/해제가 최대 60초 늦게 반영된다(콘텐츠 변경 액션은 lib/actions의
// requireApprovedUserId가 매번 DB로 재확인하므로 쓰기 권한은 즉시 차단된다).
const GATE_TTL_MS = 60_000;
// DB 장애 시 만료된 캐시를 유예 사용할 상한 — 이보다 오래되면 fail-closed(로그인으로).
// (장애가 무기한 stale 승인을 유지하지 못하게 한다 — Codex 교차검수 2026-08-20)
const GATE_STALE_MAX_MS = 10 * 60_000;
const GATE_CACHE_MAX = 5_000; // 세션 수 폭주 시 메모리 상한 — 넘치면 전체 비우고 다시 채움
const gateCache = new Map<string, { approved: boolean; level: number; at: number }>();

async function getGateInfo(userId: string): Promise<{ approved: boolean; level: number } | null> {
  const hit = gateCache.get(userId);
  if (hit && Date.now() - hit.at < GATE_TTL_MS) return hit;
  let me: { approved: boolean; level: number } | null;
  try {
    me = await prisma.user.findUnique({
      where: { id: userId },
      select: { approved: true, level: true },
    });
  } catch {
    // DB 조회 "실패"(장애)만 stale 유예 — 정상 null(탈퇴)과 반드시 구분한다.
    if (hit && Date.now() - hit.at < GATE_STALE_MAX_MS) return hit;
    return null;
  }
  // 정상 조회 결과가 "계정 없음"(탈퇴 등) — 캐시를 지워 접근을 즉시 회수
  if (!me) {
    gateCache.delete(userId);
    return null;
  }
  if (gateCache.size >= GATE_CACHE_MAX) gateCache.clear();
  gateCache.set(userId, { ...me, at: Date.now() });
  return me;
}

export const proxy = auth(async (req) => {
  const { pathname, search } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const userId = req.auth?.user?.id;

  // 비로그인 — API는 401, 페이지는 로그인으로 (원래 목적지 유지)
  if (!userId) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    const login = new URL("/login", req.nextUrl.origin);
    if (pathname !== "/") login.searchParams.set("callbackUrl", pathname + search);
    return NextResponse.redirect(login);
  }

  // 승인 대기 페이지는 로그인만 돼 있으면 접근 허용 (승인 완료자는 페이지 내부에서 홈으로 보냄)
  if (pathname === "/pending") return NextResponse.next();

  const me = await getGateInfo(userId);

  // 탈퇴 등으로 DB에 없는 세션 — 로그인으로 되돌림
  if (!me) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }

  if (!me.approved && me.level < ADMIN_MIN_LEVEL) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "관리자 승인 대기 중입니다." }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/pending", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  // 게이트에서 제외할 경로 — Next 내부 리소스와 알려진 공개 정적 파일만 명시적으로 뺀다.
  // 과거의 `.*\\..*`(점 포함 전부 제외)는 /analysis/1.css 같은 동적 경로까지 열어
  // 인증 우회가 됐다(Codex 지적). 지금은 공개 자산 디렉터리·파일만 명시 제외한다.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|icon\\.png|robots\\.txt|logos/|brand/|fonts/|coingecko\\.png).*)",
  ],
};
