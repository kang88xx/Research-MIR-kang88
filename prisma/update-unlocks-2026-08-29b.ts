import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 2026-08-29(b) 언락 날짜 상태 정정 — '추정' → '확정'.
// 월간 리니어 베스팅은 계약(베스팅 컨트랙트)상 집행일이 고정돼 날짜 자체는 확정 가능하다.
// 앞서 '추정'으로 둔 이유는 트래커별 '수량' 표기가 달랐기 때문인데, 수량 불일치는 설명문에 남기고
// 날짜는 공식 베스팅 조건 기준으로 확정한다.
//  - ENA: 공식 문서(docs.ethena.fi) 1년 25% 클리프 + 3년 월간 리니어, 매월 2일 집행 → 9/2 확정
//  - SEI: 매월 15일(2033-08-15까지 121회 일정) → 9/15 확정
//  - PENGU: 2024-12-17 출시, 1년 클리프 후 36개월 월간 리니어 → 매월 17일 → 9/17 확정
//  - ZRO: 2024-06-20 TGE, 1년 클리프 후 24회 월간(2027-05-20까지) → 매월 20일 → 9/20 확정
//  - ARB 10~12월: 매월 16일(2027-03까지 정기) → 확정
//  - APT: 트래커별 11일/12일 표기 불일치(UTC 자정 기준 해석 차이) → 추정 유지, 재확인 예약
// 실행: npx tsx prisma/update-unlocks-2026-08-29b.ts (멱등)

type Src = { name: string; url: string; tier: number; isOfficial: boolean };
const cell = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const dayRange = (s: string) => ({ gte: cell(s), lt: new Date(cell(s).getTime() + 86_400_000) });

const CONFIRM: { date: string; ticker: string; description?: string; addSources?: Src[] }[] = [
  {
    date: "2026-09-02", ticker: "ENA",
    description: "에테나가 코어 기여자·투자자 물량 약 4,063만 ENA(유통량의 0.64%)를 언락한다. 공식 베스팅 조건은 1년 25% 클리프 후 3년 월간 리니어로, 매월 2일 집행되는 정기 회차. 트래커별 수량 표기(4,063만~2.75억)가 달라 규모는 집행 후 온체인 확인 권장.",
    addSources: [{ name: "Ethena 공식 토크노믹스", url: "https://docs.ethena.fi/overview/ena/tokenomics", tier: 1, isOfficial: true }],
  },
  {
    date: "2026-09-15", ticker: "SEI",
    description: "세이가 매월 15일 집행하는 월간 언락. 팀 물량 약 5,556만 SEI(총공급 0.56%)를 포함해 트래커에 따라 총 1.1억 SEI까지 잡힌다(에코시스템 리저브·투자자 합산). 2033년 8월까지 이어지는 정기 회차.",
  },
  {
    date: "2026-09-17", ticker: "PENGU",
    description: "퍼지펭귄이 매월 17일 집행하는 월간 언락(직전 회차 약 7.23억 PENGU). 2024-12-17 출시 후 1년 클리프, 이후 36개월 월간 리니어 베스팅으로 2028년까지 이어지는 정기 회차.",
  },
  {
    date: "2026-09-20", ticker: "ZRO",
    description: "레이어제로가 매월 20일 집행하는 월간 언락(직전 회차 약 2,571만~3,261만 ZRO — 사모 투자자·창업팀·커뮤니티). 2024-06-20 TGE 후 1년 클리프, 2027-05-20까지 총 24회 정기 회차.",
    addSources: [{ name: "LayerZero 공식 블로그 (ZRO 토큰)", url: "https://layerzero.network/blog/the-zro-token", tier: 1, isOfficial: true }],
  },
  { date: "2026-10-16", ticker: "ARB", description: "아비트럼 월간 정기 언락 9,265만 ARB(유통량의 약 1.8%) — 매월 16일 집행, 2027년 3월까지 지속." },
  { date: "2026-11-16", ticker: "ARB", description: "아비트럼 월간 정기 언락 9,265만 ARB(유통량의 약 1.8%) — 매월 16일 집행, 2027년 3월까지 지속." },
  { date: "2026-12-16", ticker: "ARB", description: "아비트럼 월간 정기 언락 9,265만 ARB(유통량의 약 1.8%) — 매월 16일 집행, 2027년 3월까지 지속." },
];

async function main() {
  for (const c of CONFIRM) {
    const row = await prisma.calendarEvent.findFirst({ where: { date: dayRange(c.date), ticker: c.ticker, groupSub: "언락" } });
    if (!row) { console.log(`[경고] ${c.date} ${c.ticker} 없음`); continue; }
    if (row.dateStatus === "confirmed" && (!c.description || row.description === c.description)) { console.log(`[스킵] ${c.date} ${c.ticker} 이미 확정`); continue; }
    const cur = ((row.sources as Src[] | null) ?? []);
    const merged = [...(c.addSources ?? []), ...cur].filter((s, i, a) => a.findIndex((t) => t.url === s.url) === i);
    await prisma.calendarEvent.update({
      where: { id: row.id },
      data: { dateStatus: "confirmed", nextCheck: null, ...(c.description ? { description: c.description } : {}), sources: merged, sourceUrl: merged[0]?.url ?? row.sourceUrl },
    });
    console.log(`[확정] ${c.date} ${c.ticker} ${row.title}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
