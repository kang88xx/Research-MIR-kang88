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
import Chip, { type ChipIconName } from "@/components/Chip";
import {
  parseDaily,
  stanceLabel,
  directionLabel,
  STANCE_COLOR,
  STANCE_ICON,
  DIRECTION_COLOR,
  DIRECTION_ICON,
  DIRECTION_BAND_PCT,
} from "@/lib/daily";
import { judgeDailyDirection } from "@/lib/daily-verdict";

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

  // 방향 예측 판정 — 다음날 09:00 KST 업비트 일봉 시가 기준(목록과 동일 규칙, lib/daily-verdict.ts).
  // 판정 시각 전·시가 미수신이면 "판정 전". 현재가·다음 글 기록가 폴백은 쓰지 않는다(판정 불변성).
  const directionVerdict = await judgeDailyDirection({
    id: post.id,
    createdAt: post.createdAt,
    priceAtPost: post.priceAtPost,
    direction: daily?.direction,
  });

  return (
    <div className="mx-auto max-w-4xl">
      <article className="border border-line bg-white">
        <header className="border-b border-line px-5 py-4">
          <p className="eyebrow">공식 시장 분석</p>
          <h1 className="text-xl font-bold text-navy-900">
            {daily && (
              // 소프트 필 — 목록과 동일한 Chip 프리미티브(의미 색 틴트 + 형태 글리프)
              <Chip
                size="md"
                className="mr-2 align-[3px]"
                tone={STANCE_COLOR[daily.stance] ?? "var(--color-neutral)"}
                icon={(STANCE_ICON[daily.stance] ?? "flat") as ChipIconName}
              >
                {stanceLabel(daily.stance)}
              </Chip>
            )}
            {daily?.direction && (
              <Chip
                size="md"
                className="mr-2 align-[3px]"
                tone={DIRECTION_COLOR[daily.direction] ?? "var(--color-neutral)"}
                icon={(DIRECTION_ICON[daily.direction] ?? "flat") as ChipIconName}
                title={`내일 BTC 방향 예측 (±${DIRECTION_BAND_PCT}% 기준, 다음날 09:00 KST 판정)`}
              >
                예측 {directionLabel(daily.direction)}
              </Chip>
            )}
            {directionVerdict && directionVerdict !== "pending" && (
              <Chip
                size="md"
                className="mr-2 align-[3px]"
                tone={directionVerdict.hit ? "var(--color-good)" : "var(--color-up)"}
                icon={directionVerdict.hit ? "check" : "cross"}
                title={`다음날 09:00 KST BTC ${formatKrw(directionVerdict.judgedAtKrw)}원 (${directionVerdict.changePct > 0 ? "+" : ""}${directionVerdict.changePct.toFixed(2)}%)`}
              >
                {directionVerdict.hit ? "적중" : "미적중"}
              </Chip>
            )}
            {directionVerdict === "pending" && (
              <Chip size="md" variant="surface" icon="clock" className="mr-2 align-[3px]">
                판정 전
              </Chip>
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
          <div className="grid gap-x-6 gap-y-2 px-5 py-4 sm:grid-cols-[116px_minmax(0,1fr)]">
            <span className="pt-0.5 text-xs font-bold tracking-wider text-ink-500">
              예측 검증
              <span className="mt-1 block text-[9.5px] font-medium tracking-widest text-ink-300">
                PREDICTION
              </span>
            </span>
            <div className="flex flex-wrap gap-x-10 gap-y-2 tabular-nums">
              <span>
                <span className="block text-[11px] text-ink-400">작성 시점 {post.priceSymbol}</span>
                <b className="text-[15px] text-ink-900">{formatKrw(post.priceAtPost)}원</b>
              </span>
              <span>
                <span className="block text-[11px] text-ink-400">현재</span>
                <b className="text-[15px] text-ink-900">{formatKrw(now)}원</b>
              </span>
              {change != null && (
                <span>
                  <span className="block text-[11px] text-ink-400">작성 이후</span>
                  <b
                    className={`text-[15px] ${
                      change > 0 ? "text-up" : change < 0 ? "text-down" : "text-ink-500"
                    }`}
                  >
                    {formatPercent(change)}
                  </b>
                </span>
              )}
            </div>
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
