import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getTickers,
  getExchangeComparison,
  getKrwMarketStats,
  getKimchiTable,
  getSignalRadar,
  getExchangeSpread,
  getTrendLabels,
} from "@/lib/ticker";
import { getMarketOverview, getFxHistory, getBubbles } from "@/lib/market";
import { getTodayListings } from "@/lib/listings";
import { getExchangeListingSets } from "@/lib/exchange-listings";
import { getMarketBar } from "@/lib/marketbar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KIMP_INTERVAL_MS = 5 * 60_000;
const MARKET_INTERVAL_MS = 15 * 60_000;

// Vercel Cron 호출(Pro 플랜, 시간당 1회). 만료된 캐시 키를 한 번에 데우고, 김프/도미넌스
// 스냅샷을 요청 경로와 분리해 적재한다. 실시간 시세 신선도는 캐시 TTL + 첫 방문자 inline
// 갱신(cache.ts)이 담당하므로, 이 크론이 자주 못 돌아도 데이터 자체는 갱신된다.
// 주기를 5분→1시간으로 완화한 이유: 5분 간격이면 Neon(무료) DB가 절전에 못 들어가
// 월 컴퓨트 한도(~190h)를 소진하고, 한도 초과 시 DB 정지 → 사이트 500으로 이어진다.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authed = secret ? req.headers.get("authorization") === `Bearer ${secret}` : false;
  // 프로덕션에서는 CRON_SECRET 인증 필수(미설정/불일치 시 차단). 개발에서는 허용.
  if (!authed && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // TTL 만료된 캐시만 갱신 (느린 데이터는 자기 주기대로만 외부 호출)
  const warm = await Promise.allSettled([
    getTickers(),
    getExchangeComparison(),
    getKrwMarketStats(),
    getKimchiTable(),
    getSignalRadar(),
    getExchangeSpread(),
    getTrendLabels(),
    getMarketOverview(),
    getFxHistory(),
    getBubbles(),
    getTodayListings(),
    getExchangeListingSets(),
    getMarketBar(),
  ]);
  const warmFailed = warm.filter((r) => r.status === "rejected").length;

  const result: Record<string, unknown> = { warmFailed };

  // 김프 스냅샷 — 마지막 기록이 5분 이상 지났을 때만
  try {
    const last = await prisma.kimpSnapshot.findFirst({ orderBy: { createdAt: "desc" } });
    if (!last || Date.now() - last.createdAt.getTime() >= KIMP_INTERVAL_MS) {
      const snap = await getTickers();
      const btc = snap.tickers.find((t) => t.symbol === "BTC");
      if (btc?.kimchiPremium != null && btc.priceKrw != null && btc.priceUsd != null) {
        await prisma.kimpSnapshot.create({
          data: { btcKrw: btc.priceKrw, btcUsd: btc.priceUsd, usdKrw: snap.usdKrw, kimp: btc.kimchiPremium },
        });
        result.kimpSnapshot = "written";
      }
    }
  } catch {
    result.kimpSnapshot = "error";
  }

  // 시장(도미넌스) 스냅샷 — 마지막 기록이 15분 이상 지났을 때만
  try {
    const last = await prisma.marketSnapshot.findFirst({ orderBy: { createdAt: "desc" } });
    if (!last || Date.now() - last.createdAt.getTime() >= MARKET_INTERVAL_MS) {
      const ov = await getMarketOverview();
      if (ov.btcDominance != null && ov.totalMarketCapUsd != null) {
        await prisma.marketSnapshot.create({
          data: { btcDominance: ov.btcDominance, totalMcapUsd: ov.totalMarketCapUsd },
        });
        result.marketSnapshot = "written";
      }
    }
  } catch {
    result.marketSnapshot = "error";
  }

  // 만료된 레이트리밋 행 정리 (1시간 지난 것)
  try {
    await prisma.rateLimit.deleteMany({ where: { resetAt: { lt: new Date(Date.now() - 3600_000) } } });
  } catch {
    // 정리 실패는 무시
  }

  // 워밍 중 '하드 실패'(Promise 거부)만 집계한다. 게터들은 실패 시 직전 캐시/폴백을 반환하므로
  // warmFailed=0이어도 일부 소스는 폴백일 수 있다(상세 신선도는 각 페이지 updatedAt로 확인).
  return NextResponse.json({ ok: warmFailed === 0, ...result }, { status: warmFailed === 0 ? 200 : 207 });
}
