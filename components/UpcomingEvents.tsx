import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { upcomingUtcRange, kstTimeLabel } from "@/lib/time";
import EventIcon from "@/components/EventIcon";

const WD = ["일", "월", "화", "수", "목", "금", "토"];

const CAT_DOT: Record<string, string> = {
  important: "bg-indigo-500",
  good: "bg-emerald-500",
  bad: "bg-red-500",
  neutral: "bg-navy-300",
};
const CAT_LABEL: Record<string, string> = {
  important: "중요",
  good: "호재",
  bad: "악재",
  neutral: "중립",
};

// 홈용 "다가오는 일정" — 오늘부터 7일. 통상(UTC) 날짜로 묶고, 한국시간은 보조 표기.
export default async function UpcomingEvents() {
  const { now, startUtc, endUtc } = upcomingUtcRange(7);

  const events = await prisma.calendarEvent.findMany({
    where: { date: { gte: startUtc, lt: endUtc }, isTba: false },
    orderBy: [{ date: "asc" }, { id: "asc" }],
    take: 24,
  });

  // UTC 일자별 그룹 (오늘/내일 라벨도 UTC 기준)
  const d = new Date(now);
  const todayKey = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
  const tmr = new Date(now + 86400_000);
  const tmrKey = `${tmr.getUTCFullYear()}-${tmr.getUTCMonth()}-${tmr.getUTCDate()}`;

  const groups = new Map<string, { label: string; sub: string; items: typeof events }>();
  for (const ev of events) {
    const k = ev.date;
    const key = `${k.getUTCFullYear()}-${k.getUTCMonth()}-${k.getUTCDate()}`;
    const sub = `${k.getUTCMonth() + 1}.${k.getUTCDate()} (${WD[k.getUTCDay()]})`;
    const label = key === todayKey ? "오늘" : key === tmrKey ? "내일" : sub;
    if (!groups.has(key)) groups.set(key, { label, sub: label === sub ? "" : sub, items: [] });
    groups.get(key)!.items.push(ev);
  }

  return (
    <section className="rounded-[6px] border border-line bg-white px-5 py-[18px]">
      <header className="flex items-baseline gap-2.5">
        <h2 className="text-[15.5px] font-extrabold tracking-[-0.3px] text-navy-900">
          다가오는 일정
        </h2>
        <Link
          href="/calendar"
          className="ml-auto text-xs font-bold text-brand-ink hover:underline"
        >
          전체 캘린더 →
        </Link>
      </header>

      {groups.size === 0 ? (
        <p className="py-8 text-center text-sm text-ink-500">
          다가오는 7일 내 등록된 일정이 없습니다.
        </p>
      ) : (
        <ul>
          {[...groups.values()].map((g, gi) => (
            <li
              key={gi}
              className="flex items-start gap-3 border-b border-hairline py-[9px] first:pt-[11px] last:border-b-0 last:pb-0.5"
            >
              <span
                className={`w-14 shrink-0 pt-0.5 font-mono text-[11px] font-semibold leading-[1.5] ${
                  gi === 0 && (g.label === "오늘" || g.label === "내일")
                    ? "text-up"
                    : "text-ink-500"
                }`}
              >
                {g.label === "오늘" || g.label === "내일" ? `${g.label} ${g.sub}` : g.label}
              </span>
              <ul className="min-w-0 flex-1 space-y-[5px]">
                {g.items.map((ev) => {
                  const { time, nextDay } = kstTimeLabel(ev.date);
                  return (
                    <li
                      key={ev.id}
                      className="flex items-center gap-1.5 text-[12.5px] leading-[1.5] text-navy-700"
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          CAT_DOT[ev.category] ?? CAT_DOT.neutral
                        }`}
                        title={CAT_LABEL[ev.category] ?? "중립"}
                      />
                      <EventIcon ticker={ev.ticker} size={14} />
                      {time && (
                        <span className="shrink-0 font-mono text-[11px] font-semibold text-navy-600">
                          {time}
                          {nextDay && <span className="ml-0.5 text-[9px] text-ink-300">익일</span>}
                        </span>
                      )}
                      {ev.sourceUrl ? (
                        <a
                          href={ev.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-w-0 flex-1 truncate hover:underline"
                          title="출처 보기"
                        >
                          <b className="font-bold text-navy-900">{ev.ticker}</b> {ev.title}
                        </a>
                      ) : (
                        <span className="min-w-0 flex-1 truncate">
                          <b className="font-bold text-navy-900">{ev.ticker}</b> {ev.title}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 border-t border-hairline pt-2.5 text-[10.5px] text-ink-400">
        날짜 통상(UTC) 기준 · 시각은 KST(익일=한국시간 다음날 새벽)
      </p>
    </section>
  );
}
