import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { kstDayStartUtc, KST_MS } from "@/lib/time";
import { DAILY_MARKER, buildDailyAuto, serializeDaily } from "@/lib/daily";
import { generateDailyJudgment } from "@/lib/daily-ai";
import { getTickers } from "@/lib/ticker";
import { EDITOR_MIN_LEVEL } from "@/lib/roles";

export const dynamic = "force-dynamic";
// Opus 5는 사고 시간이 길어 한 턴에 수 분까지 걸릴 수 있다 — 데이터 수집분까지 여유 확보
export const maxDuration = 300;

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

// Vercel Cron: 매일 00:00 UTC(= 09:00 KST) 호출 — vercel.json 참고.
// 데이터 수집(buildDailyAuto)은 수기 발행 경로와 동일하고, 판단 층만 AI가 쓴다.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authed = secret ? req.headers.get("authorization") === `Bearer ${secret}` : false;
  // 프로덕션에서는 CRON_SECRET 인증 필수(미설정/불일치 시 차단). 개발에서는 허용.
  if (process.env.NODE_ENV === "production" && !authed) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "ANTHROPIC_API_KEY not set" },
      { status: 500 }
    );
  }

  try {
    // 멱등성 — 오늘(KST) 데일리가 이미 있으면 재발행하지 않는다(크론 재시도·수동 호출 대비)
    const existing = await prisma.post.findFirst({
      where: {
        board: { slug: "analysis" },
        createdAt: { gte: kstDayStartUtc() },
        content: { startsWith: DAILY_MARKER },
      },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ ok: true, skipped: "already-published", postId: existing.id });
    }

    // 작성자 — 운영진 계정(레벨 최상위, 동률이면 최초 가입자)
    const author = await prisma.user.findFirst({
      where: { level: { gte: EDITOR_MIN_LEVEL } },
      orderBy: [{ level: "desc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    if (!author) {
      return NextResponse.json({ ok: false, error: "no editor account" }, { status: 500 });
    }

    const board = await prisma.board.findUnique({ where: { slug: "analysis" } });
    if (!board) {
      return NextResponse.json({ ok: false, error: "analysis board not found" }, { status: 500 });
    }

    const kstNow = new Date(Date.now() + KST_MS);
    const dateLabel = `${kstNow.getUTCMonth() + 1}/${kstNow.getUTCDate()}(${WEEKDAY_KO[kstNow.getUTCDay()]})`;

    const auto = await buildDailyAuto();
    const judgment = await generateDailyJudgment(auto, dateLabel);

    const content = serializeDaily({
      v: 1,
      stance: judgment.stance,
      verdict: judgment.verdict,
      opinion: judgment.opinion,
      advice: judgment.advice,
      auto,
    });

    // 가격 검증은 기존 규칙 그대로 — 데일리는 BTC 기준 고정
    const snapshot = await getTickers();
    const btc = snapshot.tickers.find((t) => t.symbol === "BTC");

    const title = `${kstNow.getUTCMonth() + 1}/${kstNow.getUTCDate()} ${judgment.headline}`.slice(0, 100);
    const post = await prisma.post.create({
      data: {
        boardId: board.id,
        userId: author.id,
        title,
        content,
        priceAtPost: btc?.priceKrw ?? null,
        priceSymbol: btc?.priceKrw != null ? "BTC" : null,
      },
    });

    revalidatePath("/analysis");
    revalidatePath("/");

    return NextResponse.json({ ok: true, postId: post.id, stance: judgment.stance, title });
  } catch (e) {
    // 상세 원인은 서버 로그에만 — 응답에는 일반 메시지만(내부 구성·예외 문자열 노출 방지)
    console.error("[cron/daily]", e);
    return NextResponse.json({ ok: false, error: "internal error" }, { status: 500 });
  }
}
