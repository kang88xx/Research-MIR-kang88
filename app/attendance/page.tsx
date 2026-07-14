import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import AttendanceButton from "@/components/AttendanceButton";
import PageTitle from "@/components/PageTitle";

export const dynamic = "force-dynamic";

function kstToday(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

export default async function AttendancePage() {
  const session = await auth();
  const today = kstToday();
  const month = today.slice(0, 7);

  const todayLogs = await prisma.pointLog.findMany({
    where: { action: "attendance", day: today },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { nickname: true, level: true } } },
  });

  const myId = session?.user?.id ?? null;
  const checkedToday = myId != null && todayLogs.some((log) => log.userId === myId);
  const myMonthCount = myId
    ? await prisma.pointLog.count({
        where: { userId: myId, action: "attendance", day: { startsWith: month } },
      })
    : 0;

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle
        eyebrow="Daily Check-in"
        title="출석체크"
        description={`매일 출석하면 10포인트가 적립됩니다. (KST 기준 ${today})`}
      />

      <section className="border border-line bg-white px-5 py-8 text-center">
        {!session?.user ? (
          <p className="text-sm text-ink-500">
            출석체크는{" "}
            <Link href="/login" className="text-navy-700 underline-offset-2 hover:underline">
              로그인
            </Link>{" "}
            후 이용할 수 있습니다.
          </p>
        ) : checkedToday ? (
          <div>
            <p className="text-lg font-bold text-emerald-600">오늘 출석 완료 ✓</p>
            <p className="mt-1 text-xs text-ink-500">이번 달 {myMonthCount}회 출석했습니다.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <AttendanceButton />
            <p className="text-xs text-ink-500">이번 달 {myMonthCount}회 출석했습니다.</p>
          </div>
        )}
      </section>

      <section className="mt-4 border border-line bg-white">
        <header className="border-b border-line px-4 py-2.5">
          <h2 className="text-sm font-semibold text-navy-900">오늘의 출석부 ({todayLogs.length}명)</h2>
        </header>
        {todayLogs.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-500">
            아직 아무도 출석하지 않았습니다. 1등을 노려보세요!
          </p>
        ) : (
          <ol className="divide-y divide-line">
            {todayLogs.map((log, i) => (
              <li key={log.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span
                  className={`w-8 shrink-0 text-center text-xs font-bold ${
                    i === 0 ? "text-navy-700 font-semibold" : "text-ink-500"
                  }`}
                >
                  {i + 1}등
                </span>
                <span className="text-ink-900">
                  <span className="mr-0.5 bg-paper2 px-1 font-mono text-[10px] text-navy-500">
                    Lv{log.user.level}
                  </span>{" "}
                  {log.user.nickname}
                </span>
                <span className="ml-auto text-xs text-ink-500">
                  {log.createdAt.toLocaleTimeString("ko-KR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
