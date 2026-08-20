import { prisma } from "@/lib/prisma";
import { kstDay } from "@/lib/time";

// track 라우트 등 기존 import 경로 호환을 위해 재노출 (정의는 lib/time.ts로 통합)
export { kstDay };

// 오늘(KST) 접속자 +1 — day 행이 없으면 생성
export async function recordVisit(): Promise<void> {
  const day = kstDay();
  await prisma.visitStat.upsert({
    where: { day },
    create: { day, count: 1 },
    update: { count: { increment: 1 } },
  });
}

// 금일 총 접속자
export async function todayVisits(): Promise<number> {
  const row = await prisma.visitStat.findUnique({ where: { day: kstDay() } });
  return row?.count ?? 0;
}

// 금일 총 접속자 — 60초 인메모리 캐시 (사이드바/헤더가 페이지 렌더마다 부르므로 DB 부하 억제).
// 실패 시 0 반환 — 표시 컴포넌트가 조용히 숨긴다.
let todayCache: { n: number; day: string; at: number } | null = null;
export async function todayVisitsCached(): Promise<number> {
  const day = kstDay();
  if (todayCache && todayCache.day === day && Date.now() - todayCache.at < 60_000) {
    return todayCache.n;
  }
  try {
    const n = await todayVisits();
    todayCache = { n, day, at: Date.now() };
    return n;
  } catch {
    return todayCache?.day === day ? todayCache.n : 0;
  }
}

// 최근 N일 집계 (최신순)
export async function recentVisits(days = 7) {
  return prisma.visitStat.findMany({
    orderBy: { day: "desc" },
    take: days,
  });
}
