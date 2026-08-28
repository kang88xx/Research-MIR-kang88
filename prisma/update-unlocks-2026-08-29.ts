import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 2026-08-29 락업(언락) 스케줄 업데이트 — Coindar 1차 동기화 검수 + 9월 주요 언락 보강.
// 근거(웹 검증 2026-08-29, Tokenomist·DefiLlama·CryptoRank 교차):
//  - Coindar #243 PENGU 9/1 "Mystery Box Lock": 토큰 언락이 아닌 NFT 박스 이벤트 → archived.
//    PENGU 실제 월간 언락은 매월 17일(~7.23억 PENGU) → 9/17 추정 등록
//  - Coindar #244 ONDO 2027-01-18: 연례 클리프(매년 1/18, 2025~2029) 확인, 약 17.1억~19.4억 ONDO(총공급 17~19%) → 발행
//  - Coindar #245 XDC 2027-02-05: 교차 확인 소스 없음 → pending 유지
//  - SUI 9/1 월간 2,201만 SUI(커뮤니티 리저브·스테이킹 보조금·초기 기여자·미스텐 트레저리) 확정
//  - ENA 9/2 코어 기여자 4,063만 ENA(유통 0.64%) — 소스별 9/1~2·수량 상이 → 추정
//  - HYPE 9/6 코어 기여자 월간 ~992만 HYPE(총공급 ~1%, 유통 ~4%) — 1월부터 매월 6일 확정 패턴
//  - SEI 9/15 팀 5,556만 SEI(총공급 0.56%) — 일부 소스 1.1억 표기 → 추정
//  - ZRO 9/20 월간 ~2,571만 ZRO(사모·팀·커뮤니티, 2027-05까지 매월 20일) → 추정
//  - IMX: 2025-11 베스팅 종료(전량 언락) → 등록 대상 아님. OP: 소스 불일치로 보류
// 실행: npx tsx prisma/update-unlocks-2026-08-29.ts (멱등)

type Src = { name: string; url: string; tier: number; isOfficial: boolean };
const cell = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const dayRange = (s: string) => ({ gte: cell(s), lt: new Date(cell(s).getTime() + 86_400_000) });

const ARCHIVE = [{ externalId: "coindar:152368", reason: "NFT 미스터리 박스 이벤트 — 토큰 언락 아님" }];

const PUBLISH: { externalId: string; title: string; description: string; category: string; importance: number; dateStatus: string; sources: Src[] }[] = [
  {
    externalId: "coindar:140013",
    title: "온도(ONDO) 연례 대형 클리프 언락",
    description: "온도 파이낸스가 매년 1월 18일 집행하는 연례 클리프 언락. 약 17.1억~19.4억 ONDO(총공급의 17~19%)가 한 번에 풀리는 최대 규모 회차로, 2027~2029년까지 같은 날 반복된다. 시총 대비 30%대 물량이라 사전 매도 압력에 유의.",
    category: "bad",
    importance: 2,
    dateStatus: "confirmed",
    sources: [
      { name: "Tokenomist", url: "https://tokenomist.ai/ondo-finance/unlock-events", tier: 2, isOfficial: false },
      { name: "Coindar", url: "https://coindar.org/en/event/ondo-ondo-tokens-unlock-140013", tier: 3, isOfficial: false },
    ],
  },
];

const ADDS: { date: string; ticker: string; title: string; description: string; category: string; importance: number; dateStatus: string; sources: Src[] }[] = [
  {
    date: "2026-09-01", ticker: "SUI", title: "수이(SUI) 월간 언락", category: "neutral", importance: 2, dateStatus: "confirmed",
    description: "수이가 월간 정기 언락으로 2,201만 SUI(약 1,800만 달러)를 해제한다. 커뮤니티 리저브 약 400만·스테이킹 보조금 약 847만·초기 기여자·미스텐 트레저리 물량으로 구성.",
    sources: [
      { name: "Tokenomist", url: "https://tokenomist.ai/sui/unlock-events", tier: 2, isOfficial: false },
      { name: "Coingabbar", url: "https://www.coingabbar.com/en/crypto-currency-news/sui-token-unlock-september-2026", tier: 3, isOfficial: false },
    ],
  },
  {
    date: "2026-09-02", ticker: "ENA", title: "에테나(ENA) 코어 기여자 언락", category: "neutral", importance: 2, dateStatus: "estimated",
    description: "에테나가 코어 기여자 물량 약 4,063만 ENA(유통량의 0.64%)를 언락한다. 트래커별로 9/1~2, 수량(4,063만~2.75억) 표기가 엇갈려 추정으로 등록 — 집행 직전 재확인 필요.",
    sources: [
      { name: "Tokenomist", url: "https://tokenomist.ai/ethena/unlock-events", tier: 2, isOfficial: false },
      { name: "CryptoRank", url: "https://cryptorank.io/price/ethena/vesting", tier: 2, isOfficial: false },
    ],
  },
  {
    date: "2026-09-06", ticker: "HYPE", title: "하이퍼리퀴드 코어 기여자 월간 언락", category: "neutral", importance: 2, dateStatus: "confirmed",
    description: "하이퍼리퀴드 코어 기여자 물량 약 992만 HYPE(총공급의 약 1%, 유통량의 약 4%)가 월간 언락된다. 2026년 1월부터 매월 6일 집행되는 정기 회차.",
    sources: [
      { name: "Tokenomist", url: "https://tokenomist.ai/hyperliquid/unlock-events", tier: 2, isOfficial: false },
      { name: "CryptoTicker", url: "https://cryptoticker.io/en/hyperliquid-hype-unlock-dilution/", tier: 3, isOfficial: false },
    ],
  },
  {
    date: "2026-09-15", ticker: "SEI", title: "세이(SEI) 팀 물량 언락", category: "neutral", importance: 1, dateStatus: "estimated",
    description: "세이 팀 물량 약 5,556만 SEI(총공급의 0.56%, 약 270만 달러)가 언락된다. 일부 트래커는 1.1억 SEI로 표기해 추정으로 등록.",
    sources: [
      { name: "Tokenomist", url: "https://tokenomist.ai/sei-network/unlock-events", tier: 2, isOfficial: false },
      { name: "DropsTab", url: "https://dropstab.com/coins/sei-network/vesting", tier: 3, isOfficial: false },
    ],
  },
  {
    date: "2026-09-17", ticker: "PENGU", title: "퍼지펭귄(PENGU) 월간 언락", category: "neutral", importance: 1, dateStatus: "estimated",
    description: "퍼지펭귄이 매월 17일 집행하는 월간 언락(직전 회차 약 7.23억 PENGU). 2028년까지 이어지는 정기 물량으로 통상 일정 기반 추정.",
    sources: [
      { name: "Tokenomist", url: "https://tokenomist.ai/pudgy-penguins", tier: 2, isOfficial: false },
      { name: "CryptoRank", url: "https://cryptorank.io/price/pudgy-penguins/vesting", tier: 2, isOfficial: false },
    ],
  },
  {
    date: "2026-09-20", ticker: "ZRO", title: "레이어제로(ZRO) 월간 언락", category: "neutral", importance: 2, dateStatus: "estimated",
    description: "레이어제로가 매월 20일 집행하는 월간 언락(직전 회차 약 2,571만 ZRO — 사모 투자자·창업팀·커뮤니티). 2027년 5월까지 총 24회 일정의 정기 회차로 통상 일정 기반 추정.",
    sources: [
      { name: "Tokenomist", url: "https://tokenomist.ai/layerzero", tier: 2, isOfficial: false },
      { name: "DefiLlama", url: "https://defillama.com/unlocks/layerzero", tier: 2, isOfficial: false },
    ],
  },
];

async function main() {
  for (const a of ARCHIVE) {
    const r = await prisma.calendarEvent.updateMany({ where: { externalId: a.externalId, reviewStatus: { not: "archived" } }, data: { reviewStatus: "archived" } });
    console.log(r.count ? `[아카이브] ${a.externalId} — ${a.reason}` : `[스킵] ${a.externalId} 이미 아카이브`);
  }
  for (const p of PUBLISH) {
    const row = await prisma.calendarEvent.findUnique({ where: { externalId: p.externalId } });
    if (!row) { console.log(`[경고] ${p.externalId} 없음`); continue; }
    if (row.reviewStatus === "published" && row.title === p.title) { console.log(`[스킵] ${p.externalId} 이미 발행`); continue; }
    await prisma.calendarEvent.update({ where: { id: row.id }, data: { title: p.title, description: p.description, category: p.category, importance: p.importance, dateStatus: p.dateStatus, sources: p.sources, sourceUrl: p.sources[0].url, reviewStatus: "published", nextCheck: null } });
    console.log(`[발행] ${row.date.toISOString().slice(0, 10)} ${row.ticker} ${p.title}`);
  }
  for (const a of ADDS) {
    const dup = await prisma.calendarEvent.findFirst({ where: { date: dayRange(a.date), ticker: a.ticker, groupSub: "언락" } });
    if (dup) { console.log(`[스킵] ${a.date} ${a.ticker} — 이미 존재 (#${dup.id})`); continue; }
    await prisma.calendarEvent.create({ data: { date: cell(a.date), ticker: a.ticker, title: a.title, description: a.description, category: a.category, groupMain: "크립토", groupSub: "언락", dateStatus: a.dateStatus, importance: a.importance, sources: a.sources, sourceUrl: a.sources[0].url, reviewStatus: "published", nextCheck: a.dateStatus === "estimated" ? cell(a.date.slice(0, 8) + String(Number(a.date.slice(8)) - 1).padStart(2, "0")) : null } });
    console.log(`[추가] ${a.date} ${a.ticker} ${a.title} [${a.dateStatus}]`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
