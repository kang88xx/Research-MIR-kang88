import { NextResponse } from "next/server";
import { getKimchiHistory } from "@/lib/kimchi";

export const dynamic = "force-dynamic";

// 김프 추이 팝업(일간·주간·월간)용 장기 히스토리 — 서버 캐시 30분 + CDN 공유 캐시
export async function GET() {
  const data = await getKimchiHistory();
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800",
    },
  });
}
