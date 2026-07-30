import { prisma } from "@/lib/prisma";
import { kstDay, kstDayStartUtc } from "@/lib/time";

// 어드민 대시보드/회원 관리용 집계 쿼리. 모두 Prisma 쿼리빌더(raw SQL 미사용).

export type AdminStats = {
  totalUsers: number;
  totalPosts: number;
  totalComments: number;
  todaySignups: number;
  todayVisitors: number;
  todayPosts: number;
  todayComments: number;
};

// 누적 + 금일(KST) 핵심 지표 한 번에.
export async function getAdminStats(): Promise<AdminStats> {
  const todayStart = kstDayStartUtc();
  const [
    totalUsers,
    totalPosts,
    totalComments,
    todaySignups,
    todayPosts,
    todayComments,
    todayVisitRow,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.post.count(),
    prisma.comment.count(),
    prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.post.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.comment.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.visitStat.findUnique({ where: { day: kstDay() } }),
  ]);

  return {
    totalUsers,
    totalPosts,
    totalComments,
    todaySignups,
    todayVisitors: todayVisitRow?.count ?? 0,
    todayPosts,
    todayComments,
  };
}

export type DailyRow = {
  day: string; // KST "YYYY-MM-DD"
  visitors: number;
  signups: number;
  posts: number;
  comments: number;
};

// 최근 days일(KST) 일자별 집계 — 최신일 먼저. createdAt은 JS에서 KST일로 버킷팅(raw SQL 회피).
export async function getDailySeries(days = 14): Promise<DailyRow[]> {
  const todayStart = kstDayStartUtc();
  const startUtc = new Date(todayStart.getTime() - (days - 1) * 86400_000);
  const startDay = kstDay(startUtc);

  const [visitStats, users, posts, comments] = await Promise.all([
    prisma.visitStat.findMany({ where: { day: { gte: startDay } }, select: { day: true, count: true } }),
    prisma.user.findMany({ where: { createdAt: { gte: startUtc } }, select: { createdAt: true } }),
    prisma.post.findMany({ where: { createdAt: { gte: startUtc } }, select: { createdAt: true } }),
    prisma.comment.findMany({ where: { createdAt: { gte: startUtc } }, select: { createdAt: true } }),
  ]);

  const bucket = (items: { createdAt: Date }[]): Map<string, number> => {
    const m = new Map<string, number>();
    for (const it of items) m.set(kstDay(it.createdAt), (m.get(kstDay(it.createdAt)) ?? 0) + 1);
    return m;
  };
  const visitMap = new Map(visitStats.map((v) => [v.day, v.count]));
  const su = bucket(users);
  const po = bucket(posts);
  const co = bucket(comments);

  // 최신일 → 과거 순
  const rows: DailyRow[] = [];
  for (let i = 0; i < days; i++) {
    const day = kstDay(new Date(todayStart.getTime() - i * 86400_000));
    rows.push({
      day,
      visitors: visitMap.get(day) ?? 0,
      signups: su.get(day) ?? 0,
      posts: po.get(day) ?? 0,
      comments: co.get(day) ?? 0,
    });
  }
  return rows;
}

export type MemberSort = "recent" | "level";
export const MEMBERS_PAGE_SIZE = 20;

export type MemberRow = {
  id: string;
  nickname: string;
  email: string;
  level: number;
  createdAt: Date;
  _count: { posts: number; comments: number };
};

// 회원 목록 — 닉/이메일 검색, 정렬, 페이지네이션.
export async function getMembers(opts: {
  q?: string;
  sort?: MemberSort;
  page?: number;
}): Promise<{ rows: MemberRow[]; total: number; page: number; totalPages: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const q = opts.q?.trim();
  const where = q
    ? {
        OR: [
          { nickname: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};
  const orderBy =
    opts.sort === "level"
      ? [{ level: "desc" as const }, { createdAt: "desc" as const }]
      : [{ createdAt: "desc" as const }];

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy,
      skip: (page - 1) * MEMBERS_PAGE_SIZE,
      take: MEMBERS_PAGE_SIZE,
      select: {
        id: true,
        nickname: true,
        email: true,
        level: true,
        createdAt: true,
        _count: { select: { posts: true, comments: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return { rows, total, page, totalPages: Math.max(1, Math.ceil(total / MEMBERS_PAGE_SIZE)) };
}
