import Link from "next/link";
import { auth } from "@/lib/auth";
import { logout } from "@/lib/actions";
import { prisma } from "@/lib/prisma";
import RefreshButton from "@/components/RefreshButton";
import LiveViewers from "@/components/LiveViewers";
import LangToggle from "@/components/LangToggle";

const NAV = [
  ["/", "홈"],
  ["/dashboard", "대시보드"],
  ["/free", "자유게시판"],
  ["/analysis", "시장분석"],
  ["/calendar", "캘린더"],
  ["/box", "랜덤박스"],
];

const ADMIN_MIN_LEVEL = 10;

export default async function Header() {
  const session = await auth();
  const me = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { points: true, level: true, nickname: true, nicknameConfirmed: true },
      })
    : null;

  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-y-2 px-4 py-3">
        <div className="flex shrink-0 items-center gap-3 md:flex-1">
          <Link href="/" className="flex items-center gap-2.5">
            <span
              className="inline-block h-3 w-3 rounded-full bg-brand"
              style={{ boxShadow: "0 0 12px var(--color-brand)" }}
              aria-hidden
            />
            <span className="text-xl font-extrabold tracking-tight text-navy-900">
              Coinom
            </span>
          </Link>
          <RefreshButton />
        </div>

        {/* 가운데 메뉴 — 모바일에서는 둘째 줄 가로 스크롤, 데스크톱에서는 페이지 정중앙 */}
        <nav className="order-3 -mx-4 flex w-full min-w-0 items-center gap-1 overflow-x-auto px-4 text-sm whitespace-nowrap md:order-none md:mx-0 md:w-auto md:shrink-0 md:justify-center md:px-0">
          {NAV.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="shrink-0 border-b-2 border-transparent px-3 py-1.5 font-medium text-ink-500 hover:border-amber-500 hover:text-navy-900"
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* 우측 — 회원 · 출석체크(로그인 시) */}
        <div className="ml-auto flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-1.5 text-sm md:ml-0 md:flex-1">
          {session?.user ? (
            <>
              {me && me.level >= ADMIN_MIN_LEVEL && (
                <Link
                  href="/admin/prizes"
                  className="border-b-2 border-transparent py-1.5 font-semibold text-brand-ink hover:border-brand-ink hover:text-brand-ink"
                >
                  어드민
                </Link>
              )}
              <Link
                href="/attendance"
                className="border-b-2 border-transparent py-1.5 font-medium text-ink-500 hover:border-amber-500 hover:text-navy-900"
              >
                출석체크
              </Link>
              <Link href="/box" className="font-mono text-xs font-semibold text-navy-700 hover:text-navy-900">
                {(me?.points ?? 0).toLocaleString()}P
              </Link>
              {me && !me.nicknameConfirmed && (
                <Link
                  href="/settings"
                  className="rounded-md border border-brand-ink bg-brand-weak px-2 py-1 text-xs font-semibold text-brand-ink hover:bg-brand"
                >
                  닉네임 설정
                </Link>
              )}
              <Link href="/settings" className="text-ink-500 hover:text-navy-900" title="내 설정">
                <b className="font-semibold text-navy-900">{me?.nickname ?? session.user.name}</b> 님
              </Link>
              <form action={logout}>
                <button className="border border-navy-300 px-3 py-1 text-ink-500 hover:border-navy-900 hover:text-navy-900">
                  로그아웃
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="text-ink-500 hover:text-navy-900">
                로그인
              </Link>
              <Link
                href="/register"
                className="bg-navy-900 px-4 py-1.5 font-medium text-white hover:bg-navy-700"
              >
                회원가입
              </Link>
            </>
          )}

          {/* 동시접속 · 언어 — 회원가입(로그아웃) 오른쪽 */}
          <span className="flex items-center gap-3 border-l border-line pl-3">
            <LiveViewers />
            <LangToggle />
          </span>
        </div>
      </div>
    </header>
  );
}
