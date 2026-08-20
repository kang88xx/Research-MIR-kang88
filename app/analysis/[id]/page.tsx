import Link from "next/link";
import { notFound } from "next/navigation";
import { waitUntil } from "@vercel/functions";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/ratelimit";
import { getTickers } from "@/lib/ticker";
import { formatDateTime, formatKrw, formatPercent, formatPostDate } from "@/lib/format";
import VoteButtons from "@/components/VoteButtons";
import CommentForm from "@/components/CommentForm";
import DailyPostBody from "@/components/DailyPostBody";
import {
  parseDaily,
  stanceLabel,
  directionLabel,
  judgeDirection,
  STANCE_COLOR,
  DIRECTION_COLOR,
  DIRECTION_BAND_PCT,
  DAILY_MARKER,
} from "@/lib/daily";

export const dynamic = "force-dynamic";

export default async function AnalysisDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idParam } = await params;
  // 순수 정수만 허용 — "1.css" 같은 값이 parseInt로 1이 되어 우회되지 않게 엄격 검증
  if (!/^\d+$/.test(idParam)) notFound();
  const id = parseInt(idParam, 10);

  const [session, snapshot] = await Promise.all([auth(), getTickers()]);

  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      board: { select: { slug: true } },
      author: { select: { nickname: true, level: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { nickname: true, level: true } } },
      },
    },
  });
  if (!post || post.board.slug !== "analysis") notFound();

  // 조회수 +1 — 유저당 글당 30분에 1회만 집계(새로고침 부풀리기 방지). waitUntil로 감싸
  // 응답 후에도 업데이트 완료를 보장한다(fire-and-forget은 서버리스에서 조용히 유실됐다).
  // failClosed=true: 조회수는 비핵심 지표 — rate limit 저장소 장애 시 부풀리기보다 미집계를 택한다.
  const counted = session?.user?.id
    ? await checkRateLimit(`view:${id}:${session.user.id}`, 1, 30 * 60_000, true).catch(() => false)
    : false;
  if (counted) {
    try {
      waitUntil(prisma.post.update({ where: { id }, data: { viewCount: { increment: 1 } } }).catch(() => {}));
    } catch {
      // waitUntil 미지원 환경(로컬 Node) — 프로미스는 이미 실행 중
    }
  }

  const daily = parseDaily(post.content);

  const now = post.priceSymbol
    ? snapshot.tickers.find((t) => t.symbol === post.priceSymbol)?.priceKrw ?? null
    : null;
  const change =
    post.priceAtPost != null && now != null
      ? ((now - post.priceAtPost) / post.priceAtPost) * 100
      : null;

  // 방향 예측 판정 — 경계는 "바로 다음(더 최신) 데일리"의 BTC 기록가로 고정(목록과 동일 규칙).
  // direction 유무와 무관하게 바로 다음 데일리를 경계로 쓰고, 없거나 기록가가 없으면 "판정 전".
  // 현재가 폴백은 쓰지 않는다 — 판정이 시세에 따라 뒤집히지 않게(불변성, Codex 교차검수).
  let directionVerdict: { changePct: number; hit: boolean } | "pending" | null = null;
  if (daily?.direction && post.priceAtPost != null) {
    // createdAt 동률까지 목록과 동일한 순서(createdAt, id)로 "바로 다음" 데일리를 고른다
    const nextDaily = await prisma.post.findFirst({
      where: {
        boardId: post.boardId,
        content: { startsWith: DAILY_MARKER },
        OR: [
          { createdAt: { gt: post.createdAt } },
          { createdAt: post.createdAt, id: { gt: post.id } },
        ],
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { priceAtPost: true },
    });
    const nextPrice = nextDaily?.priceAtPost ?? null;
    if (nextPrice == null) {
      directionVerdict = "pending";
    } else {
      const changePct = ((nextPrice - post.priceAtPost) / post.priceAtPost) * 100;
      directionVerdict = { changePct, hit: judgeDirection(daily.direction, changePct) };
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <article className="border border-line bg-white">
        <header className="border-b border-line px-5 py-4">
          <p className="eyebrow">공식 시장 분석</p>
          <h1 className="text-xl font-bold text-navy-900">
            {daily && (
              // 소프트 필 — 목록(STANCE_COLOR)과 동일한 의미 색 틴트
              <span
                className="mr-2 inline-block rounded-full px-2.5 py-[3px] align-[3px] text-[11px] font-bold"
                style={{
                  color: STANCE_COLOR[daily.stance] ?? "var(--color-neutral)",
                  background: `color-mix(in srgb, ${STANCE_COLOR[daily.stance] ?? "var(--color-neutral)"} 11%, transparent)`,
                }}
              >
                {stanceLabel(daily.stance)}
              </span>
            )}
            {daily?.direction && (
              <span
                className="mr-2 inline-block rounded-full px-2.5 py-[3px] align-[3px] text-[11px] font-bold"
                style={{
                  color: DIRECTION_COLOR[daily.direction] ?? "var(--color-neutral)",
                  background: `color-mix(in srgb, ${DIRECTION_COLOR[daily.direction] ?? "var(--color-neutral)"} 11%, transparent)`,
                }}
                title={`내일 BTC 방향 예측 (±${DIRECTION_BAND_PCT}% 기준, 다음날 09:00 KST 판정)`}
              >
                예측 {directionLabel(daily.direction)}
              </span>
            )}
            {directionVerdict && directionVerdict !== "pending" && (
              <span
                className="mr-2 inline-block rounded-full px-2.5 py-[3px] align-[3px] text-[11px] font-bold"
                style={{
                  color: directionVerdict.hit ? "var(--color-good)" : "var(--color-up)",
                  background: `color-mix(in srgb, ${directionVerdict.hit ? "var(--color-good)" : "var(--color-up)"} 11%, transparent)`,
                }}
                title={`다음날 BTC ${directionVerdict.changePct > 0 ? "+" : ""}${directionVerdict.changePct.toFixed(2)}%`}
              >
                {directionVerdict.hit ? "적중" : "미적중"}
              </span>
            )}
            {directionVerdict === "pending" && (
              <span className="mr-2 inline-block rounded-full bg-paper2 px-2.5 py-[3px] align-[3px] text-[11px] font-bold text-ink-400">
                판정 전
              </span>
            )}
            {post.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
            <span className="text-ink-900">
              <span className="mr-0.5 bg-paper2 px-1 font-mono text-[10px] text-navy-500">Lv{post.author.level}</span>{" "}
              {post.author.nickname}
            </span>
            <span>{formatDateTime(post.createdAt)}</span>
            <span>조회 {post.viewCount + (counted ? 1 : 0)}</span>
            <span>댓글 {post.commentCount}</span>
          </div>
        </header>

        {post.priceAtPost != null && post.priceSymbol && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line bg-paper px-5 py-3 text-sm">
            <span className="eyebrow">예측 검증</span>
            <span className="text-ink-900">
              작성 시점 <b>{post.priceSymbol}</b> {formatKrw(post.priceAtPost)}원
            </span>
            <span className="text-ink-900">현재 {formatKrw(now)}원</span>
            {change != null && (
              <span
                className={`font-bold ${
                  change > 0 ? "text-red-600" : change < 0 ? "text-indigo-700" : "text-ink-500"
                }`}
              >
                작성 이후 {formatPercent(change)}
              </span>
            )}
          </div>
        )}

        {daily ? (
          <DailyPostBody data={daily} />
        ) : (
          <div className="whitespace-pre-wrap px-5 py-6 text-[15px] leading-7 text-ink-900">
            {post.content}
          </div>
        )}

        <VoteButtons postId={post.id} upvotes={post.upvotes} downvotes={post.downvotes} />
      </article>

      <section className="mt-4 border border-line bg-white">
        <header className="border-b border-line px-5 py-2.5">
          <h2 className="text-sm font-semibold text-navy-900">댓글 {post.comments.length}</h2>
        </header>
        {post.comments.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-500">첫 댓글을 남겨보세요.</p>
        ) : (
          <ul className="divide-y divide-line">
            {post.comments.map((c) => (
              <li key={c.id} className="px-5 py-3">
                <div className="mb-1 flex items-center gap-2 text-xs text-ink-500">
                  <span className="text-ink-900">
                    <span className="mr-0.5 bg-paper2 px-1 font-mono text-[10px] text-navy-500">
                      Lv{c.author.level}
                    </span>{" "}
                    {c.author.nickname}
                  </span>
                  <span>{formatPostDate(c.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-ink-900">{c.content}</p>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-line px-5 py-4">
          {session?.user ? (
            <CommentForm postId={post.id} />
          ) : (
            <p className="text-center text-sm text-ink-500">
              댓글을 작성하려면{" "}
              <Link href="/login" className="text-navy-700 underline-offset-2 hover:underline">
                로그인
              </Link>
              이 필요합니다.
            </p>
          )}
        </div>
      </section>

      <div className="mt-4">
        <Link
          href="/analysis"
          className="inline-block border border-navy-300 px-4 py-1.5 text-sm text-ink-500 hover:border-navy-900 hover:text-navy-900"
        >
          목록으로
        </Link>
      </div>
    </div>
  );
}
