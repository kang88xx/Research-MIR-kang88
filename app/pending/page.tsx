import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logout } from "@/lib/actions";
import { ADMIN_MIN_LEVEL } from "@/lib/roles";

export const dynamic = "force-dynamic";

// 관리자 승인 대기 화면 — 구글 로그인은 됐지만 아직 어드민이 승인하지 않은 계정의 유일한 도착지.
// (사이트 전역 게이트는 proxy.ts — 미승인 계정의 다른 모든 경로를 이곳으로 보낸다)
export default async function PendingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { approved: true, level: true, email: true },
  });
  // 승인 완료(또는 운영진) — 더 머물 이유 없음
  if (me && (me.approved || me.level >= ADMIN_MIN_LEVEL)) redirect("/");

  return (
    <div className="mx-auto mt-16 w-full max-w-sm border border-line bg-white p-8 text-center">
      <p className="font-mono text-[11px] font-medium tracking-[0.7px] text-ink-400">
        PENDING APPROVAL
      </p>
      <h1 className="mt-2 text-lg font-semibold text-navy-900">관리자 승인 대기 중</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-500">
        가입이 접수되었습니다.
        <br />
        관리자가 계정을 승인하면 사이트를 이용할 수 있습니다.
      </p>
      {me?.email && (
        <p className="mt-3 border-t border-hairline pt-3 font-mono text-xs text-ink-400">
          {me.email}
        </p>
      )}
      <form action={logout} className="mt-6">
        <button className="w-full border border-navy-300 bg-white py-2 text-sm font-medium text-ink-900 hover:border-navy-900">
          로그아웃
        </button>
      </form>
    </div>
  );
}
