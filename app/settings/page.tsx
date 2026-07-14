import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NICK_MAX_CHANGES } from "@/lib/nickname";
import NicknameForm from "@/components/NicknameForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "내 설정 · 가자가자" };

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { nickname: true, nicknameChanges: true, nicknameConfirmed: true, level: true, points: true },
  });
  if (!me) redirect("/login");

  const remaining = Math.max(0, NICK_MAX_CHANGES - me.nicknameChanges);

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <h1 className="mb-1 text-xl font-semibold text-navy-900">내 설정</h1>
      <p className="mb-6 text-sm text-ink-500">
        Lv{me.level} · {me.points.toLocaleString()}P
      </p>

      <section className="border border-line bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-navy-900">
          {me.nicknameConfirmed ? "닉네임 변경" : "닉네임 설정"}
        </h2>
        <NicknameForm
          currentNickname={me.nickname}
          remaining={remaining}
          confirmed={me.nicknameConfirmed}
        />
      </section>
    </div>
  );
}
