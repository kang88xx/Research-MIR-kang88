import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getTickers } from "@/lib/ticker";
import { auth } from "@/lib/auth";
import { formatKrw, formatPercent, formatPostDate } from "@/lib/format";
import {
  parseDaily,
  DAILY_MARKER,
  stanceLabel,
  directionLabel,
  judgeDirection,
  STANCE_COLOR,
  STANCE_ICON,
  DIRECTION_COLOR,
  DIRECTION_ICON,
  DIRECTION_BAND_PCT,
} from "@/lib/daily";
import PageTitle from "@/components/PageTitle";
import Chip, { type ChipIconName } from "@/components/Chip";
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

  // ── 데일리 방향 예측 판정 ──
  // 경계는 "바로 다음(더 최신) 데일리"로 고정한다 — direction 유무와 무관하게 모든 데일리가
  // 경계가 되므로, 구버전 데일리를 건너뛰어 다른 날 가격으로 판정하는 일이 없다(Codex 교차검수).
  // 다음 데일리가 없거나 그 기록가가 없으면 "판정 전" — 현재가 폴백을 쓰지 않아 한번 내려진
  // 판정이 시세에 따라 뒤집히지 않는다(판정 불변성). 상세 페이지와 동일 규칙.
  // 경계 판별은 마커 prefix 기준 — 상세 페이지의 DB 조회(startsWith)와 동일 기준을 써서
  // JSON이 깨진 데일리도 양쪽에서 똑같이 경계로 취급된다(파싱 성공 여부로 갈리지 않게).
  const allDailies = posts
    .filter((p) => p.content.startsWith(DAILY_MARKER))
    .map((p) => ({ id: p.id, createdAt: p.createdAt, priceAtPost: p.priceAtPost, daily: parseDaily(p.content) }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id);
  type Verdict = { changePct: number; hit: boolean } | "pending";
  const verdicts = new Map<number, Verdict>();
  for (let i = 0; i < allDailies.length; i++) {
    const cur = allDailies[i];
    if (!cur.daily?.direction || cur.priceAtPost == null) continue; // 구버전·가격 누락은 판정 대상 아님
    // 최신순 정렬 — 바로 앞 원소가 "그 다음 날(더 최신)" 데일리 (direction 없어도 경계로 사용)
    const nextPrice = allDailies[i - 1]?.priceAtPost ?? null;
    if (nextPrice == null) {
      verdicts.set(cur.id, "pending");
      continue;
    }
    const changePct = ((nextPrice - cur.priceAtPost) / cur.priceAtPost) * 100;
    verdicts.set(cur.id, { changePct, hit: judgeDirection(cur.daily.direction, changePct) });
  }
  const decided = [...verdicts.values()].filter((v): v is Exclude<Verdict, "pending"> => v !== "pending");
  const hitCount = decided.filter((v) => v.hit).length;

  return (
    <div>
      <PageTitle
        eyebrow="Official Market Analysis"
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

      {decided.length > 0 && (
        <div className="mb-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border border-line bg-white px-4 py-2.5 text-[12.5px]">
          <span className="font-bold text-navy-900">BTC 방향 예측 적중률</span>
          <b className="font-mono text-[15px] font-bold tabular-nums text-navy-900">
            {Math.round((hitCount / decided.length) * 100)}%
          </b>
          <span className="text-ink-500">
            {hitCount}/{decided.length} 적중 · ±{DIRECTION_BAND_PCT}% 기준 · 다음 데일리의 BTC
            기록가로 판정 · 최근 글 30개 범위
          </span>
        </div>
      )}

      {posts.length === 0 ? (
        <p className="border border-line bg-white py-12 text-center text-sm text-ink-500">
          아직 분석 글이 없습니다.
        </p>
      ) : (
        // E7B 레지스터형 — 카드 대신 컬럼 정렬 시트. 행 전체가 링크(테이블 태그는 Link로 못 감싸 grid 사용)
        <div className="border border-line bg-white">
          <div className="divide-y divide-hairline">
            {posts.map((post) => {
              const now = post.priceSymbol ? priceNow.get(post.priceSymbol) ?? null : null;
              const change =
                post.priceAtPost != null && now != null
                  ? ((now - post.priceAtPost) / post.priceAtPost) * 100
                  : null;
              const daily = parseDaily(post.content);
              const verdict = verdicts.get(post.id) ?? null;
              return (
                <Link
                  key={post.id}
                  href={`/analysis/${post.id}`}
                  className="grid gap-x-4 gap-y-1.5 px-4 py-3.5 transition-colors hover:bg-paper2 sm:grid-cols-[64px_108px_minmax(0,1fr)_140px_88px]"
                >
                  {/* 게시일 */}
                  <span className="tabular-nums max-sm:text-xs max-sm:text-ink-500">
                    <b className="text-[13.5px] font-bold text-ink-900 max-sm:text-xs max-sm:font-semibold">
                      {post.createdAt.getMonth() + 1}/{post.createdAt.getDate()}
                    </b>
                    <span className="mt-0.5 block text-[10.5px] text-ink-300 max-sm:hidden">
                      {post.createdAt.getFullYear()}
                    </span>
                  </span>

                  {/* 판정 — 스탠스·예측·판정 배지 스택(데일리만) */}
                  <span className="flex flex-wrap items-start gap-1 sm:flex-col">
                    {daily && (
                      <>
                        <Chip
                          tone={STANCE_COLOR[daily.stance] ?? "var(--color-neutral)"}
                          icon={(STANCE_ICON[daily.stance] ?? "flat") as ChipIconName}
                        >
                          {stanceLabel(daily.stance)}
                        </Chip>
                        {daily.direction && (
                          <Chip
                            size="xs"
                            tone={DIRECTION_COLOR[daily.direction] ?? "var(--color-neutral)"}
                            icon={(DIRECTION_ICON[daily.direction] ?? "flat") as ChipIconName}
                            title={`내일 BTC 방향 예측 (±${DIRECTION_BAND_PCT}% 기준)`}
                          >
                            예측 {directionLabel(daily.direction)}
                          </Chip>
                        )}
                        {verdict && verdict !== "pending" && (
                          <Chip
                            size="xs"
                            tone={verdict.hit ? "var(--color-good)" : "var(--color-up)"}
                            icon={verdict.hit ? "check" : "cross"}
                            title={`다음날 BTC ${verdict.changePct > 0 ? "+" : ""}${verdict.changePct.toFixed(2)}%`}
                          >
                            {verdict.hit ? "적중" : "미적중"}
                          </Chip>
                        )}
                        {verdict === "pending" && (
                          <Chip size="xs" variant="surface" icon="clock">
                            판정 전
                          </Chip>
                        )}
                      </>
                    )}
                  </span>

                  {/* 제목 + 요약 + 메타 */}
                  <span className="min-w-0">
                    <h2 className="text-[14.5px] font-bold text-navy-900">
                      {post.title}
                      {post.commentCount > 0 && (
                        <span className="ml-1 text-xs font-normal text-indigo-700">
                          [{post.commentCount}]
                        </span>
                      )}
                    </h2>
                    <span className="mt-1 line-clamp-1 block text-[12.5px] text-ink-500">
                      {daily ? daily.verdict : post.content}
                    </span>
                    <span className="mt-1 block text-[11px] text-ink-400">
                      {post.author.nickname} · {formatPostDate(post.createdAt)} · 조회 {post.viewCount}{" "}
                      · 추천 {post.upvotes}
                    </span>
                  </span>

                  {/* 작성시 가격 */}
                  <span className="tabular-nums sm:text-right">
                    {post.priceAtPost != null && post.priceSymbol ? (
                      <>
                        <b className="text-[13px] font-semibold text-ink-900">
                          {formatKrw(post.priceAtPost)}원
                        </b>
                        <span className="mt-0.5 flex items-center gap-1 text-[10.5px] text-ink-400 sm:justify-end">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/logos/coins/${post.priceSymbol}.png`}
                            alt=""
                            className="h-3 w-3 rounded-full object-cover"
                          />
                          {post.priceSymbol}
                        </span>
                      </>
                    ) : (
                      <span className="text-ink-300 max-sm:hidden">—</span>
                    )}
                  </span>

                  {/* 이후 변동률 */}
                  <span className="tabular-nums text-[13px] font-bold sm:text-right">
                    {change != null ? (
                      <span
                        className={
                          change > 0 ? "text-up" : change < 0 ? "text-down" : "text-ink-500"
                        }
                      >
                        {formatPercent(change)}
                      </span>
                    ) : (
                      <span className="text-ink-300 max-sm:hidden">—</span>
                    )}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
