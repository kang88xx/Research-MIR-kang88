import { NextResponse } from "next/server";
import { refreshTelegramFeed } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// 텔레그램 채널 수집 강제 갱신 — 홈 위젯 피드 + 상장·상폐 후보 검수 큐 기입.
// 평상시에는 홈 방문 시 15분 SWR(lib/telegram)로 갱신되므로 크론 없이도 동작한다.
// (크론 등록 시 vercel.json에 추가 — 현재는 수동 트리거/헬스체크 용도)
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authed = secret ? req.headers.get("authorization") === `Bearer ${secret}` : false;
  if (!authed && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const feed = await refreshTelegramFeed();
    return NextResponse.json({
      ok: true,
      posts: feed.posts.length,
      latest: feed.posts[0]?.url ?? null,
      updatedAt: feed.updatedAt,
    });
  } catch (e) {
    // 파싱 0건/네트워크 실패 — t.me 마크업 변경 가능성. 위젯은 stale 캐시로 폴백 중.
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
  }
}
