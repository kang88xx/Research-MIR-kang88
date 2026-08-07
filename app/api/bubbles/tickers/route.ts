import { NextResponse, type NextRequest } from "next/server";
import { getCoinExchanges, isBubbleCoinId } from "@/lib/market";

export const dynamic = "force-dynamic";

// 버블맵 클릭 카드용 — 코인별 상장 거래소 상위 3곳.
// id는 현재 버블 스냅샷에 있는 코인만 허용한다 — 임의 id로 외부 API 프록시·캐시 채우기 방지.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!/^[a-z0-9-]{1,64}$/.test(id)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  if (!(await isBubbleCoinId(id))) {
    return NextResponse.json({ error: "unknown coin" }, { status: 404 });
  }
  const result = await getCoinExchanges(id);
  // 조회 실패(updatedAt=epoch)는 CDN에 캐시하면 한동안 재시도가 막힌다 — no-store
  const failed = result.updatedAt === new Date(0).toISOString();
  return NextResponse.json(result, {
    headers: {
      // 상장·거래대금 순위는 천천히 변한다 — 성공 시 CDN 1시간, stale 하루
      "Cache-Control": failed
        ? "no-store"
        : "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
