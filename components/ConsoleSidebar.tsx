import Link from "next/link";
import { auth } from "@/lib/auth";
import { logout } from "@/lib/actions";
import { prisma } from "@/lib/prisma";
import SideNav from "@/components/SideNav";
import RefreshButton from "@/components/RefreshButton";
import LiveViewers from "@/components/LiveViewers";
import LangToggle from "@/components/LangToggle";
import ThemeToggle from "@/components/ThemeToggle";

const ADMIN_MIN_LEVEL = 10;

// 데스크톱 좌측 사이드바 — 콘솔 시안: 로고 블록 · 번호형 네비 · 하단 ACCOUNT 패널
export default async function ConsoleSidebar() {
  const session = await auth();
  const me = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { points: true, level: true, nickname: true, nicknameConfirmed: true },
      })
    : null;

  return (
    <aside className="console-side sticky top-0 hidden h-screen w-[228px] shrink-0 flex-col overflow-y-auto lg:flex">
      {/* 로고 블록 — 가자가자 더블 셰브런 (네이비·골드 콘솔 톤) */}
      <div className="flex items-center gap-2.5 border-b border-hairline px-4 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] bg-gold">
            <svg width="18" height="18" viewBox="0 0 120 120" aria-hidden>
              <path d="M26 26 L58 60 L26 94" fill="none" stroke="#091955" strokeWidth="17" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M60 26 L92 60 L60 94" fill="none" stroke="#0f1320" strokeWidth="17" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
            </svg>
          </span>
          <span className="flex flex-col">
            <span className="text-[15px] leading-tight font-extrabold tracking-tight text-navy-900">
              가자가자
            </span>
            <span className="font-mono text-[8.5px] tracking-[0.18em] text-ink-400 uppercase">
              Data &amp; Community
            </span>
          </span>
        </Link>
        <span className="ml-auto">
          <RefreshButton />
        </span>
      </div>

      <div className="flex-1 py-4">
        <SideNav />
      </div>

      {/* 하단 ACCOUNT 패널 */}
      <div className="border-t border-hairline px-4 py-4">
        <p className="font-mono text-[9.5px] font-medium tracking-[0.16em] text-ink-400 uppercase">
          Account
        </p>
        {session?.user ? (
          <div className="mt-2 flex flex-col gap-2 text-[12.5px]">
            <div className="flex items-baseline justify-between">
              <Link href="/settings" className="font-bold text-ink-900 hover:text-brand-ink" title="내 설정">
                {me?.nickname ?? session.user.name} 님
              </Link>
              <Link href="/box" className="font-mono text-[11px] font-semibold text-brand-ink">
                {(me?.points ?? 0).toLocaleString()}P
              </Link>
            </div>
            {me && !me.nicknameConfirmed && (
              <Link
                href="/settings"
                className="rounded-[4px] border border-brand bg-brand-weak px-2 py-1 text-center text-[11.5px] font-semibold text-brand-ink hover:bg-brand hover:text-on-brand"
              >
                닉네임 설정
              </Link>
            )}
            <div className="flex items-center gap-3 text-[12px]">
              <Link href="/attendance" className="font-medium text-ink-500 hover:text-brand-ink">
                출석체크
              </Link>
              {me && me.level >= ADMIN_MIN_LEVEL && (
                <Link href="/admin/prizes" className="font-semibold text-ink-500 hover:text-brand-ink">
                  어드민
                </Link>
              )}
              <form action={logout} className="ml-auto">
                <button className="rounded-[4px] border border-hairline px-2.5 py-1 text-[11.5px] text-ink-500 hover:border-border-strong hover:text-ink-900">
                  로그아웃
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex flex-col gap-1.5">
            <Link
              href="/login"
              className="rounded-[4px] border border-border-strong px-3 py-1.5 text-center text-[12.5px] font-semibold text-ink-700 hover:border-brand hover:text-brand-ink"
            >
              로그인
            </Link>
            <Link
              href="/register"
              className="rounded-[4px] bg-brand px-3 py-1.5 text-center text-[12.5px] font-bold text-on-brand hover:bg-amber-400"
            >
              회원가입
            </Link>
          </div>
        )}
        {/* 시스템 행 — 동시접속 · 다크모드 · 언어 */}
        <div className="mt-3 flex items-center gap-3 border-t border-hairline pt-3">
          <LiveViewers />
          <span className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <LangToggle />
          </span>
        </div>
      </div>
    </aside>
  );
}
