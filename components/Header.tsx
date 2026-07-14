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
    <header className="header-chrome relative">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-y-0 px-4 md:h-[60px] md:flex-nowrap">
        <div className="flex shrink-0 items-center gap-3 py-2.5 md:py-0 md:flex-1">
          <Link href="/" className="flex items-center gap-2.5">
            {/* 가자가자 더블 셰브런 — 뒤(딥 슬레이트)·앞(라이트 슬레이트)·선단 알라바스터 점 */}
            <svg width="22" height="22" viewBox="0 0 120 120" aria-hidden className="shrink-0">
              <path d="M26 26 L58 60 L26 94" fill="none" stroke="#3c4e5d" strokeWidth="17" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M60 26 L92 60 L60 94" fill="none" stroke="#8fa5b5" strokeWidth="17" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="92" cy="60" r="6" fill="#e5e4e2" />
            </svg>
            <span className="whitespace-nowrap text-lg font-extrabold tracking-tight text-[#f4f3f1]">
              가자가자
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
                  className="border-b-2 border-transparent py-1.5 font-semibold text-[#9db2c2] hover:border-[#9db2c2] hover:text-[#e5e4e2]"
                >
                  어드민
                </Link>
              )}
              <Link
                href="/attendance"
                className="border-b-2 border-transparent py-1.5 font-medium text-[#8b98a3] hover:border-[#7e95a6] hover:text-[#e5e4e2]"
              >
                출석체크
              </Link>
              <Link href="/box" className="font-mono text-xs font-semibold text-[#c2ccd4] hover:text-[#f4f3f1]">
                {(me?.points ?? 0).toLocaleString()}P
              </Link>
              {me && !me.nicknameConfirmed && (
                <Link
                  href="/settings"
                  className="rounded-md border border-[#7e95a6] bg-[#ffffff0d] px-2 py-1 text-xs font-semibold text-[#c9d6df] hover:bg-[#536878] hover:text-white"
                >
                  닉네임 설정
                </Link>
              )}
              <Link href="/settings" className="text-[#8b98a3] hover:text-[#e5e4e2]" title="내 설정">
                <b className="font-semibold text-[#e5e4e2]">{me?.nickname ?? session.user.name}</b> 님
              </Link>
              <form action={logout}>
                <button className="rounded-[9px] border border-[#3a4653] px-3 py-1 text-[#aeb9c2] hover:border-[#93a5b2] hover:text-[#e5e4e2]">
                  로그아웃
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="px-2 py-1.5 text-[13.5px] font-semibold text-[#aeb9c2] hover:text-[#e5e4e2]"
              >
                로그인
              </Link>
              {/* 알라바스터 블록 CTA — 컬러칩의 밝은 면을 그대로 버튼으로 */}
              <Link
                href="/register"
                className="rounded-[9px] bg-[#e5e4e2] px-4 py-1.5 text-[13.5px] font-bold text-[#16181b] hover:bg-white"
              >
                회원가입
              </Link>
            </>
          )}

          {/* 동시접속 · 다크모드 · 언어 — 회원가입(로그아웃) 오른쪽 */}
          <span className="flex items-center gap-3 border-l border-[#333d47] pl-3">
            <LiveViewers />
            <ThemeToggle />
            <LangToggle />
          </span>
        </div>
      </div>
      {/* 하단 크롬 헤어라인 — 슬레이트가 스치는 시그니처 라인 */}
      <div className="header-chrome-edge absolute inset-x-0 bottom-0 h-px" aria-hidden />
    </header>
  );
}
