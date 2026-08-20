import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getTickers } from "@/lib/ticker";
import { auth } from "@/lib/auth";
import { formatKrw, formatPercent, formatPostDate } from "@/lib/format";
import { parseDaily, stanceLabel, STANCE_COLOR } from "@/lib/daily";
import PageTitle from "@/components/PageTitle";
import { EDITOR_MIN_LEVEL } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function AnalysisPage() {
  const [board, snapshot, session] = await Promise.all([
    prisma.board.findUnique({ where: { slug: "analysis" } }),
    getTickers(),
    auth(),
  ]);
  if (!board) {
    return <p className="py-10 text-center text-ink-500">게시판을 찾을 수 없습니다.</p>;
  }

  const posts = await prisma.post.findMany({
    where: { boardId: board.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { author: { select: { nickname: true, level: true } } },
  });

  const me = session?.user?.id
    ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { level: true } })
    : null;
  const canWrite = (me?.level ?? 0) >= EDITOR_MIN_LEVEL;

  const priceNow = new Map(snapshot.tickers.map((t) => [t.symbol, t.priceKrw]));

  return (
    <div>
      <PageTitle
        eyebrow="Official Market Analysis"
        title="시장 분석"
        description="운영진이 작성하는 공식 분석입니다. 작성 시점 가격이 자동 기록되어 현재가와 비교됩니다."
        actions={
          canWrite && (
            <span className="flex gap-2">
              <Link
                href="/analysis/write/daily"
                className="border border-brand px-4 py-1.5 text-sm font-semibold text-brand-ink hover:bg-brand-weak"
              >
                데일리 작성
              </Link>
              <Link
                href="/analysis/write"
                className="bg-brand px-4 py-1.5 text-sm font-semibold text-on-brand hover:bg-amber-400"
              >
                분석 작성
              </Link>
            </span>
          )
        }
      />

      {posts.length === 0 ? (
        <p className="border border-line bg-white py-12 text-center text-sm text-ink-500">
          아직 분석 글이 없습니다.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map((post) => {
            const now = post.priceSymbol ? priceNow.get(post.priceSymbol) ?? null : null;
            const change =
              post.priceAtPost != null && now != null
                ? ((now - post.priceAtPost) / post.priceAtPost) * 100
                : null;
            const daily = parseDaily(post.content);
            return (
              <Link
                key={post.id}
                href={`/analysis/${post.id}`}
                className="border border-line bg-white p-4 hover:border-navy-300"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold text-navy-900">
                    {daily && (
                      <>
                        {/* 스탠스 소프트 필만 표기 — "데일리" 뱃지는 정보량 없이 자리만 차지해 제거(운영 결정 2026-08-20) */}
                        <span
                          className="mr-1.5 inline-block rounded-full px-2.5 py-[3px] align-[1.5px] text-[10.5px] font-bold"
                          style={{
                            color: STANCE_COLOR[daily.stance] ?? "var(--color-neutral)",
                            background: `color-mix(in srgb, ${STANCE_COLOR[daily.stance] ?? "var(--color-neutral)"} 11%, transparent)`,
                          }}
                        >
                          {stanceLabel(daily.stance)}
                        </span>
                      </>
                    )}
                    {post.title}
                    {post.commentCount > 0 && (
                      <span className="ml-1 text-xs text-indigo-700">[{post.commentCount}]</span>
                    )}
                  </h2>
                  {post.priceAtPost != null && post.priceSymbol && (
                    <span className="flex shrink-0 items-center gap-1.5 text-[11px]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/logos/coins/${post.priceSymbol}.png`}
                        alt=""
                        className="h-3.5 w-3.5 rounded-full object-cover"
                      />
                      <b className="text-ink-900">{post.priceSymbol}</b>
                      <span className="text-ink-500">작성시 {formatKrw(post.priceAtPost)}</span>
                      {change != null && (
                        <span
                          className={`font-semibold ${
                            change > 0 ? "text-up" : change < 0 ? "text-down" : "text-ink-500"
                          }`}
                        >
                          이후 {formatPercent(change)}
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-ink-500">
                  {daily ? daily.verdict : post.content}
                </p>
                <p className="mt-2 text-xs text-ink-500">
                  {post.author.nickname} · {formatPostDate(post.createdAt)} · 조회 {post.viewCount} · 추천{" "}
                  {post.upvotes}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
