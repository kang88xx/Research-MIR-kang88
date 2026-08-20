import { NextResponse } from "next/server";
import { refreshTelegramFeed, refreshTelegramPopular } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 인기 피드는 30채널 병렬 수집 — 여유 확보

// 텔레그램 수집 강제 갱신 — 인기 포스팅(34채널) + 강프로 찻방(상장·상폐 후보 검수 큐).
// vercel.json에 30분 크론으로 등록(2026-08-20) — 상장·상폐 후보 추출(DB 쓰기)은 이 경로
// 전용이다. 인기 포스팅 위젯은 홈 방문 시 15분 SWR(lib/telegram)로도 갱신된다.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authed = secret ? req.headers.get("authorization") === `Bearer ${secret}` : false;
  if (!authed && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [popular, feed] = await Promise.allSettled([refreshTelegramPopular(), refreshTelegramFeed()]);
  const ok = popular.status === "fulfilled" && feed.status === "fulfilled";
  return NextResponse.json(
    {
      ok,
      popular:
        popular.status === "fulfilled"
          ? { posts: popular.value.posts.length, channelsOk: popular.value.channelsOk, top: popular.value.posts[0]?.url ?? null }
          : { error: String(popular.reason) },
      feed:
        feed.status === "fulfilled"
          ? { posts: feed.value.posts.length, latest: feed.value.posts[0]?.url ?? null }
          : // 파싱 0건/네트워크 실패 — t.me 마크업 변경 가능성. 위젯은 stale 캐시로 폴백 중.
            { error: String(feed.reason) },
      updatedAt: new Date().toISOString(),
    },
    { status: ok ? 200 : 502 }
  );
}
