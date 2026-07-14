import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPostDate } from "@/lib/format";

// 홈 하단 게시판 영역 — 자유게시판 최신글 + 시장 분석.
// 페이지에서 분리해 자체 Suspense 경계로 독립 스트리밍되게 한다(상단 시장 카드와 병렬).
export default async function HomeBoards() {
  const [recentPosts, analysisPosts] = await Promise.all([
    prisma.post.findMany({
      where: { board: { slug: "free" } },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { author: { select: { nickname: true } } },
    }),
    prisma.post.findMany({
      where: { board: { slug: "analysis" } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, priceSymbol: true, createdAt: true },
    }),
  ]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <section className="overflow-hidden rounded-[14px] border border-line bg-white">
        <header className="title-band flex items-baseline justify-between border-b px-5 py-3">
          <h2 className="text-[15.5px] font-extrabold tracking-[-0.3px] text-[#e5e4e2]">
            자유게시판 최신글
          </h2>
          <Link href="/free" className="text-xs font-bold text-[#93a5b2] hover:text-[#e5e4e2] hover:underline">
            더보기 →
          </Link>
        </header>
        {recentPosts.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-ink-500">
            아직 글이 없습니다. 첫 글을 작성해 보세요!
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {recentPosts.map((post) => (
              <li
                key={post.id}
                className="flex flex-col gap-0.5 px-4 py-2 text-sm sm:flex-row sm:items-center sm:gap-2"
              >
                <Link
                  href={`/free/${post.id}`}
                  className="min-w-0 truncate text-ink-900 hover:text-navy-700 hover:underline sm:flex-1"
                >
                  {post.title}
                  {post.commentCount > 0 && (
                    <span className="ml-1 text-xs text-indigo-700">[{post.commentCount}]</span>
                  )}
                </Link>
                <div className="flex shrink-0 items-center gap-2 text-xs text-ink-500">
                  <span className="max-w-[8rem] truncate">{post.author.nickname}</span>
                  <span className="w-12 shrink-0 text-right">{formatPostDate(post.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside className="flex flex-col gap-6">
        <section className="overflow-hidden rounded-[14px] border border-line bg-white">
          <header className="title-band flex items-baseline justify-between border-b px-5 py-3">
            <h2 className="text-[15.5px] font-extrabold tracking-[-0.3px] text-[#e5e4e2]">시장 분석</h2>
            <Link href="/analysis" className="text-xs font-bold text-[#93a5b2] hover:text-[#e5e4e2] hover:underline">
              더보기 →
            </Link>
          </header>
          {analysisPosts.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-ink-500">아직 분석 글이 없습니다.</p>
          ) : (
            <ul className="divide-y divide-line">
              {analysisPosts.map((post) => (
                <li key={post.id} className="flex items-center gap-2 px-4 py-2 text-sm">
                  {post.priceSymbol && (
                    <span className="shrink-0 bg-paper2 px-1 font-mono text-[10px] text-navy-500">
                      {post.priceSymbol}
                    </span>
                  )}
                  <Link
                    href={`/analysis/${post.id}`}
                    className="flex-1 truncate text-ink-900 hover:text-navy-700 hover:underline"
                  >
                    {post.title}
                  </Link>
                  <span className="shrink-0 text-xs text-ink-500">
                    {formatPostDate(post.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}
