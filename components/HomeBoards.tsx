import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPostDate } from "@/lib/format";

// 홈 하단 게시판 영역 — 시장 분석 최신글.
// 페이지에서 분리해 자체 Suspense 경계로 독립 스트리밍되게 한다(상단 시장 카드와 병렬).
export default async function HomeBoards() {
  // DB 정지(무료 한도 초과 등) 시 홈 전체가 에러 화면으로 대체되지 않도록 빈 목록으로 폴백.
  const analysisPosts = await prisma.post
    .findMany({
      where: { board: { slug: "analysis" } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, title: true, priceSymbol: true, createdAt: true, commentCount: true },
    })
    .catch(() => []);

  return (
    <section className="overflow-hidden rounded-[6px] border border-line bg-white">
      <header className="title-band flex items-baseline justify-between border-b px-5 py-3">
        <h2 className="text-[15.5px] font-extrabold tracking-[-0.3px] text-[#e5e4e2]">시장 분석</h2>
        <Link href="/analysis" className="text-xs font-bold text-[#93a5b2] hover:text-[#e5e4e2] hover:underline">
          더보기 →
        </Link>
      </header>
      {analysisPosts.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-ink-500">아직 분석 글이 없습니다.</p>
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
                {post.commentCount > 0 && (
                  <span className="ml-1 text-xs text-indigo-700">[{post.commentCount}]</span>
                )}
              </Link>
              <span className="shrink-0 text-xs text-ink-500">{formatPostDate(post.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
