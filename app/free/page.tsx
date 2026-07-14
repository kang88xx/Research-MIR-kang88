import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPostDate } from "@/lib/format";
import PageTitle from "@/components/PageTitle";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function FreeBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const board = await prisma.board.findUnique({ where: { slug: "free" } });
  if (!board) {
    return <p className="py-10 text-center text-ink-500">게시판을 찾을 수 없습니다.</p>;
  }

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where: { boardId: board.id },
      orderBy: [{ isNotice: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { author: { select: { nickname: true, level: true } } },
    }),
    prisma.post.count({ where: { boardId: board.id } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const blockStart = Math.floor((page - 1) / 10) * 10 + 1;
  const blockEnd = Math.min(blockStart + 9, totalPages);
  const pages = Array.from({ length: blockEnd - blockStart + 1 }, (_, i) => blockStart + i);

  return (
    <div>
      <PageTitle
        eyebrow="Community · Free Board"
        title={board.name}
        actions={
          <Link
            href="/free/write"
            className="bg-brand px-4 py-1.5 text-sm font-semibold text-on-brand hover:bg-amber-400"
          >
            글쓰기
          </Link>
        }
      />

      <div className="overflow-hidden border border-line bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-navy-900 text-xs font-light text-white">
              <th className="w-16 px-2 py-2 font-normal">번호</th>
              <th className="px-2 py-2 text-left font-normal">제목</th>
              <th className="w-24 px-2 py-2 font-normal">닉네임</th>
              <th className="w-20 px-2 py-2 font-normal">등록일</th>
              <th className="w-14 px-2 py-2 font-normal">조회</th>
              <th className="w-16 px-2 py-2 font-normal">추천</th>
            </tr>
          </thead>
          <tbody>
            {posts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-ink-500">
                  아직 글이 없습니다. 첫 글을 작성해 보세요!
                </td>
              </tr>
            ) : (
              posts.map((post) => (
                <tr key={post.id} className="border-b border-line last:border-0 hover:bg-paper">
                  <td className="px-2 py-2 text-center text-xs text-ink-500">
                    {post.isNotice ? (
                      <span className="bg-amber-500 px-1.5 py-0.5 font-semibold text-navy-950">공지</span>
                    ) : (
                      post.id
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <Link
                      href={`/free/${post.id}`}
                      className="text-ink-900 hover:text-navy-700 hover:underline"
                    >
                      {post.title}
                    </Link>
                    {post.commentCount > 0 && (
                      <span className="ml-1 text-xs text-indigo-700">[{post.commentCount}]</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center text-xs text-ink-500">
                    <span className="mr-0.5 bg-paper2 px-1 font-mono text-[10px] text-navy-500">
                      Lv{post.author.level}
                    </span>
                    {post.author.nickname}
                  </td>
                  <td className="px-2 py-2 text-center text-xs text-ink-500">
                    {formatPostDate(post.createdAt)}
                  </td>
                  <td className="px-2 py-2 text-center text-xs text-ink-500">{post.viewCount}</td>
                  <td className="px-2 py-2 text-center text-xs">
                    <span className="text-red-600">{post.upvotes}</span>
                    <span className="text-navy-300"> - </span>
                    <span className="text-indigo-700">{post.downvotes}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <nav className="mt-4 flex items-center justify-center gap-1 text-sm">
        {blockStart > 1 && (
          <Link href={`/free?page=${blockStart - 1}`} className="px-2 py-1 text-ink-500 hover:bg-paper2">
            이전
          </Link>
        )}
        {pages.map((p) => (
          <Link
            key={p}
            href={`/free?page=${p}`}
            className={`px-2.5 py-1 ${
              p === page
                ? "bg-navy-900 font-semibold text-white"
                : "text-ink-500 hover:bg-paper2"
            }`}
          >
            {p}
          </Link>
        ))}
        {blockEnd < totalPages && (
          <Link href={`/free?page=${blockEnd + 1}`} className="px-2 py-1 text-ink-500 hover:bg-paper2">
            다음
          </Link>
        )}
      </nav>
    </div>
  );
}
