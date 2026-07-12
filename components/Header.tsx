import Link from "next/link";
import { auth } from "@/lib/auth";
import { logout } from "@/lib/actions";
import { prisma } from "@/lib/prisma";
import RefreshButton from "@/components/RefreshButton";
import LiveViewers from "@/components/LiveViewers";
import LangToggle from "@/components/LangToggle";
import ThemeToggle from "@/components/ThemeToggle";
import NavLinks from "@/components/NavLinks";

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
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-y-0 px-4 md:h-[60px] md:flex-nowrap">
        <div className="flex shrink-0 items-center gap-3 py-2.5 md:py-0 md:flex-1">
          <Link href="/" className="flex items-center gap-2.5">
            {/* 오렌지 라운드 사각 로고 + C */}
            <span
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand font-mono text-[15px] font-extrabold text-white"
              aria-hidden
            >
              C
            </span>
            <span className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="text-lg font-extrabold tracking-tight text-navy-900">코인놈</span>
              <span className="font-mono text-[10.5px] font-semibold tracking-[1px] text-ink-400">
                COINOM
              </span>
            </span>
          </Link>
          <RefreshButton />
        </div>

        {/* 가운데 메뉴 — 모바일에서는 둘째 줄 가로 스크롤, 데스크톱에서는 페이지 정중앙 */}
        <NavLinks />

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
                <button className="rounded-[9px] border border-line px-3 py-1 text-ink-500 hover:border-navy-900 hover:text-navy-900">
                  로그아웃
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="px-2 py-1.5 text-[13.5px] font-semibold text-navy-600 hover:text-navy-900"
              >
                로그인
              </Link>
              <Link
                href="/register"
                className="rounded-[9px] bg-navy-900 px-4 py-1.5 text-[13.5px] font-bold text-white hover:bg-navy-700"
              >
                회원가입
              </Link>
            </>
          )}

          {/* 동시접속 · 다크모드 · 언어 — 회원가입(로그아웃) 오른쪽 */}
          <span className="flex items-center gap-3 border-l border-line pl-3">
            <LiveViewers />
            <ThemeToggle />
            <LangToggle />
          </span>
        </div>
      </div>
    </header>
  );
}
