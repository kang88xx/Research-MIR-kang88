import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// 비트코인 채굴원가(손익분기 가격) 추정 — blockchain.info 해시레이트·난이도를 4회/일 받아
// 전기료·효율 가정으로 계산해 DB(marketCache)에 적재. 마켓바는 이 값을 읽는다.
// MacroMicro가 Cloudflare로 서버 크롤링이 막혀 있어, 공개·무료인 blockchain.info 기반 모델 추정으로 대체.
//
// 가정값 — 배포 없이 조정할 수 있게 환경변수로 오버라이드 가능:
//   MINING_EFFICIENCY_J_PER_TH (기본 25) · MINING_ELECTRICITY_USD_PER_KWH (기본 0.05)
function envNum(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}
const MINER_EFFICIENCY_J_PER_TH = envNum("MINING_EFFICIENCY_J_PER_TH", 25); // 네트워크 평균 채굴기 효율 (J/TH)
const ELECTRICITY_USD_PER_KWH = envNum("MINING_ELECTRICITY_USD_PER_KWH", 0.05); // 산업용 전기료 ($/kWh)

// 블록 보상 — 블록 높이에서 계산(반감기 자동 반영). 하드코딩 3.125는 다음 반감기에
// 채굴원가를 정확히 절반으로 잘못 만들었다(2026-08-20 리뷰). 높이 미수신 시 현행 3.125 폴백.
function blockReward(height: number | undefined): number {
  if (!Number.isFinite(height) || height == null || height <= 0) return 3.125;
  return 50 / Math.pow(2, Math.floor(height / 210_000));
}

type BlockchainStats = {
  hash_rate?: number;
  difficulty?: number;
  market_price_usd?: number;
  n_blocks_total?: number; // 현재 블록 높이 — 반감기 계산용
};

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authed = secret ? req.headers.get("authorization") === `Bearer ${secret}` : false;
  if (!authed && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const res = await fetch("https://api.blockchain.info/stats", {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`blockchain.info -> ${res.status}`);
    const d = (await res.json()) as BlockchainStats;

    const hashGhs = Number(d.hash_rate); // GH/s
    if (!Number.isFinite(hashGhs) || hashGhs <= 0) throw new Error("invalid hash_rate");

    const hashThs = hashGhs / 1000; // TH/s
    const powerW = hashThs * MINER_EFFICIENCY_J_PER_TH; // J/s = W
    const dailyKwh = (powerW * 24) / 1000;
    const dailyCostUsd = dailyKwh * ELECTRICITY_USD_PER_KWH;
    const dailyIssuance = 144 * blockReward(d.n_blocks_total); // 일일 채굴량(블록 144개 × 보상, 수수료 제외)
    const costUsd = dailyCostUsd / dailyIssuance; // 1 BTC 채굴 전기원가

    if (!Number.isFinite(costUsd) || costUsd <= 0) throw new Error("invalid cost");

    await prisma.marketCache.upsert({
      where: { key: "btcMiningCost" },
      update: { data: { costUsd, hashGhs, updatedAt: new Date().toISOString() } },
      create: { key: "btcMiningCost", data: { costUsd, hashGhs, updatedAt: new Date().toISOString() } },
    });

    return NextResponse.json({
      ok: true,
      costUsd: Math.round(costUsd),
      hashEhs: Math.round(hashThs / 1e6),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
