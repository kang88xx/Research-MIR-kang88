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

// 모바일 헤더 — 콘솔 라이트(흰 표면 + 헤어라인). 데스크톱(lg+)은 좌측 사이드바가 대신한다.
export default async function Header() {
  const session = await auth();
  const me = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { level: true, nickname: true, nicknameConfirmed: true },
      })
    : null;

  return (
    <header className="border-b border-hairline bg-surface lg:hidden">
      <div className="flex flex-wrap items-center gap-y-0 px-4">
        <div className="flex shrink-0 items-center gap-3 py-2.5">
          <Link href="/" className="min-w-0">
            <span className="block text-[13px] leading-snug font-extrabold tracking-tight text-navy-900 uppercase">
              Kang Market Intelligence &amp; Research
            </span>
          </Link>
          <RefreshButton />
        </div>

        {/* 우측 — 회원 · 출석체크(로그인 시) */}
        <div className="ml-auto flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-1.5 text-sm">
          {session?.user ? (
            <>
              {me && me.level >= ADMIN_MIN_LEVEL && (
                <Link
                  href="/admin"
                  className="py-1.5 font-semibold text-ink-500 hover:text-brand-ink"
                >
                  어드민
                </Link>
              )}
              {me && !me.nicknameConfirmed && (
                <Link
                  href="/settings"
                  className="rounded-[4px] border border-brand bg-brand-weak px-2 py-1 text-xs font-semibold text-brand-ink hover:bg-brand hover:text-on-brand"
                >
                  닉네임 설정
                </Link>
              )}
              <Link href="/settings" className="text-ink-500 hover:text-ink-900" title="내 설정">
                <b className="font-semibold text-ink-900">{me?.nickname ?? session.user.name}</b> 님
              </Link>
              <form action={logout}>
                <button className="rounded-[4px] border border-hairline px-3 py-1 text-ink-500 hover:border-border-strong hover:text-ink-900">
                  로그아웃
                </button>
              </form>
            </>
          ) : (
            /* 가입·로그인은 구글 단일 경로 — 회원가입 버튼 없이 로그인 CTA 하나만 */
            <Link
              href="/login"
              className="rounded-[4px] bg-brand px-4 py-1.5 text-[13.5px] font-bold text-on-brand hover:bg-amber-400"
            >
              로그인
            </Link>
          )}

          {/* 동시접속 · 다크모드 · 언어 */}
          <span className="flex items-center gap-3 border-l border-hairline pl-3">
            <LiveViewers />
            <ThemeToggle />
            <LangToggle />
          </span>
        </div>

        {/* 하단 줄 — 가로 스크롤 네비 */}
        <NavLinks />
      </div>
    </header>
  );
}
