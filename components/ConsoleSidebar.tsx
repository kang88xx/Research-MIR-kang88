import Link from "next/link";
import { logout } from "@/lib/actions";
import SideNav from "@/components/SideNav";
import RefreshButton from "@/components/RefreshButton";
import TodayVisits from "@/components/TodayVisits";
import LangToggle from "@/components/LangToggle";
import ThemeToggle from "@/components/ThemeToggle";
import { ADMIN_MIN_LEVEL } from "@/lib/roles";
import { getCurrentUser } from "@/lib/current-user";

// 데스크톱 좌측 사이드바 — 콘솔 시안: 로고 블록 · 번호형 네비 · 하단 ACCOUNT 패널
export default async function ConsoleSidebar() {
  // 요청 단위 메모이제이션 — 사이드바·모바일 헤더가 함께 렌더되어도 유저 조회는 1회(lib/current-user)
  const me = await getCurrentUser();

  return (
    <aside className="console-side sticky top-0 hidden h-screen w-[228px] shrink-0 flex-col overflow-y-auto lg:flex">
      {/* 로고 블록 — 풀네임 워드마크 */}
      <div className="flex items-center gap-2.5 border-b border-hairline px-4 py-4">
        <Link href="/" className="min-w-0">
          <span className="block text-[13.5px] leading-snug font-extrabold tracking-tight text-navy-900 uppercase">
            Kang Market Intelligence &amp; Research
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
        {me ? (
          <div className="mt-2 flex flex-col gap-2 text-[12.5px]">
            <div className="flex items-baseline justify-between">
              <Link href="/settings" className="font-bold text-ink-900 hover:text-brand-ink" title="Settings">
                {me.nickname}
              </Link>
            </div>
            {!me.nicknameConfirmed && (
              <Link
                href="/settings"
                className="rounded-[4px] border border-brand bg-brand-weak px-2 py-1 text-center text-[11.5px] font-semibold text-brand-ink hover:bg-brand hover:text-on-brand"
              >
                Set nickname
              </Link>
            )}
            <div className="flex items-center gap-3 text-[12px]">
              {me.level >= ADMIN_MIN_LEVEL && (
                <Link href="/admin" className="font-semibold text-ink-500 hover:text-brand-ink">
                  Admin
                </Link>
              )}
              <form action={logout} className="ml-auto">
                <button className="rounded-[4px] border border-hairline px-2.5 py-1 text-[11.5px] text-ink-500 hover:border-border-strong hover:text-ink-900">
                  Logout
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
              Login
            </Link>
            <Link
              href="/register"
              className="rounded-[4px] bg-brand px-3 py-1.5 text-center text-[12.5px] font-bold text-on-brand hover:bg-amber-400"
            >
              Sign up
            </Link>
          </div>
        )}
        {/* 시스템 행 — 동시접속 · 다크모드 · 언어 */}
        <div className="mt-3 flex items-center gap-3 border-t border-hairline pt-3">
          <TodayVisits />
          <span className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <LangToggle />
          </span>
        </div>
      </div>
    </aside>
  );
}
