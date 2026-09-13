import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

// .env → .env.local 순으로 로드 (Prisma 클라이언트는 .env.local을 읽지 않는다)
for (const file of [".env", ".env.local"]) {
  try {
    for (const line of readFileSync(resolve(process.cwd(), file), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const val = m[2].replace(/^(['"])(.*)\1$/, "$2");
      if (file === ".env.local" || !(m[1] in process.env)) process.env[m[1]] = val;
    }
  } catch {}
}

const prisma = new PrismaClient();

// 2026-09-13 캘린더 검증 업데이트 — 9/14~9/30 항목 재검증 + 지연·연기 반영 + 신규 2건.
// 근거(웹 검증 2026-09-13):
//  - ORCL(#130): FY2027 1분기 실적은 9/14가 아니라 9/10 장 마감 후 발표 완료 (Oracle IR·CNBC). 조정 EPS 1.92달러, 매출 193.5억달러
//  - ASTER(#141): 9/1 팀 물량 4억 ASTER 베스팅 개시를 2027-09-17로 1년 연기 발표 (KuCoin·CoinMarketCal) → postponed, 날짜 이동
//  - ETH 글램스터담(#293): 9/3 ACDC #186에서 세폴리아 포크 10/6 13:53 UTC로 재설정, 9/14 Devnet-11 (crypto.news·24/7 Wall St) → revised
//  - 트럼프·시진핑(#267): 7/23 트럼프가 9/24 방미 확인, 9/4 로이터 대규모 경제사절단 동행 보도 → confirmed
//  - 임시예산 CR(#258): 9/2 트럼프 서명(H.R. 6500, 12/11까지) (NAGGL·American Banker) → pending_review 해제·발행
//  - XPL(#142): 9/25 05:30 UTC 팀·투자자 18.1억 XPL 1년 클리프 해제, 유통량 27.8억→46.7억 (CoinMarketCal·CryptoTicker)
//  - MU(#131): 8/26 공식 발표 9/30 14:30 MT 컨퍼런스콜 확정 (Micron IR) → nextCheck 해제
//  - 업비트 SNX(#287): 공식 공지 9/28 15:00 거래지원 종료, 빗썸도 동일 (업비트 공지·블루밍비트) → confirmed
//  - SK하이닉스(#280): 8/21 거래소 조회공시 답변 "1개월 내 재공시" → 9/21 시한, Layergg 9/18 추정 유지 (TipRanks)
//  - FOMC(#150): 결과 발표 9/16 14:00 ET = 9/17 03:00 KST로 시각 지정
//  - VET(#266)·SEC/CFTC(#278)·GHST(#277): 신규 확인 없음, 추정 유지
//  - 텔레그램 자동 포착 #157·#205·#233·#253은 상장 공지가 아닌 일반 뉴스 요약 → archived
//  - 추가: 미 8월 소매판매 9/16 08:30 ET (Census 공식 일정, FOMC 결정일과 겹침), 이란·GCC·이라크 호르무즈 회담 9/14 오만 살랄라 (Al Jazeera·Bloomberg)
// 실행: node --import file:///<loader>/register.mjs prisma/update-events-2026-09-13.ts (멱등 — 재실행 안전)

type Src = { name: string; url: string; tier: number; isOfficial: boolean };
const LGG = { name: "Layergg (X) 9월 캘린더", url: "https://x.com/layerggofficial/status/2094725653669294182", tier: 3, isOfficial: false };

const UPDATES: {
  id: number;
  expectTicker: string;
  set: {
    date?: string;
    isTba?: boolean;
    title?: string;
    description?: string;
    dateStatus?: string;
    reviewStatus?: string;
    sourceUrl?: string;
    sources?: Src[];
    nextCheck?: string | null;
  };
}[] = [
  {
    id: 130,
    expectTicker: "ORCL",
    set: {
      date: "2026-09-10T20:05:00Z", // 9/10 장 마감 후 = 9/11 05:05 KST
      title: "오라클 실적 발표 (FY2027 1분기, 9/10 장 마감 후)",
      description:
        "오라클이 9/10 장 마감 후 FY2027 1분기(6~8월) 실적을 발표했다. 조정 EPS 1.92달러(예상 1.74달러), 매출 193억 5,000만달러(예상 191억 4,000만달러)로 전년 대비 약 30% 증가. 캘린더의 9/14 추정일은 실제 발표일로 정정. (출처: 오라클 IR·CNBC)",
      dateStatus: "confirmed",
      sourceUrl: "https://investor.oracle.com/investor-news/news-details/2026/Oracle-Sets-the-Date-for-its-First-Quarter-Fiscal-Year-2027-Earnings-Announcement/default.aspx",
      sources: [
        { name: "Oracle IR", url: "https://investor.oracle.com/investor-news/news-details/2026/Oracle-Sets-the-Date-for-its-First-Quarter-Fiscal-Year-2027-Earnings-Announcement/default.aspx", tier: 1, isOfficial: true },
        { name: "CNBC", url: "https://www.cnbc.com/2026/09/10/oracle-orcl-q1-earnings-report-2027.html", tier: 2, isOfficial: false },
      ],
      nextCheck: null,
    },
  },
  {
    id: 141,
    expectTicker: "ASTER",
    set: {
      date: "2027-09-17T00:00:00Z",
      title: "애스터(ASTER) 팀 물량 베스팅 개시 (2026/9/17 → 2027/9/17 1년 연기)",
      description:
        "애스터가 9/1 팀 배정 물량 4억 ASTER(총공급 5%)의 베스팅 개시를 2026년 9월 17일에서 2027년 9월 17일로 1년 연기한다고 발표했다. 원래 TGE 1주년에 12개월 클리프가 끝나고 월 1,000만 개씩 풀릴 예정이었으나 전량 잠금이 유지된다. 바이백·소각 정책은 그대로이며 팀 물량이 소각 우선 대상이다. (출처: KuCoin News·CoinMarketCal)",
      dateStatus: "postponed",
      sourceUrl: "https://www.kucoin.com/news/flash/aster-extends-team-token-unlock-period-for-400m-aster-until-september-2027",
      sources: [
        { name: "KuCoin News", url: "https://www.kucoin.com/news/flash/aster-extends-team-token-unlock-period-for-400m-aster-until-september-2027", tier: 3, isOfficial: false },
        { name: "CoinMarketCal (TradingView)", url: "https://www.tradingview.com/news/coinmarketcal:445b08962094b:0-aster-team-allocation-cliff-extended-by-12-months-17-sep-2027/", tier: 3, isOfficial: false },
      ],
      nextCheck: null,
    },
  },
  {
    id: 293,
    expectTicker: "ETH",
    set: {
      date: "2026-10-06T13:53:00Z", // 10/6 22:53 KST
      title: "이더리움 글램스터담, 세폴리아 테스트넷 포크 (9/28 → 10/6 연기)",
      description:
        "이더리움 차기 하드포크 글램스터담의 세폴리아 테스트넷 활성화 목표가 9/3 개발자 콜(ACDC #186)에서 9/28에서 10/6 13:53 UTC(한국시간 22시 53분)로 미뤄졌다. 3월 말부터 데브넷 0~9를 거쳤지만 아직 안정된 데브넷 통과가 없어 9/14 Devnet-11을 먼저 돌린다. 후디 테스트넷과 메인넷 일정은 미정이며 12월 메인넷 활성화가 거론되는 수준이다. (출처: crypto.news·24/7 Wall St)",
      dateStatus: "revised",
      sourceUrl: "https://crypto.news/ethereum-targets-oct-6-for-glamsterdam-on-sepolia/",
      sources: [
        { name: "crypto.news", url: "https://crypto.news/ethereum-targets-oct-6-for-glamsterdam-on-sepolia/", tier: 3, isOfficial: false },
        { name: "24/7 Wall St", url: "https://247wallst.com/investing/cryptocurrency/2026/09/11/ethereums-glamsterdam-upgrade-slipped-again-sepolia-now-targets-october-6/", tier: 3, isOfficial: false },
      ],
      nextCheck: "2026-09-29T00:00:00Z",
    },
  },
  {
    id: 267,
    expectTicker: "US",
    set: {
      title: "시진핑 미국 국빈 방문·트럼프 백악관 정상회담",
      description:
        "5월 트럼프 방중에 이은 시진핑의 미국 국빈 방문. 트럼프가 7/23 시진핑이 9/24 백악관을 방문한다고 밝혔고, 9/4 로이터는 대규모 경제사절단 동행을 보도했다. 유엔총회 기간과 겹친다. 의제는 무역·대만·AI·이란 전쟁. (출처: US News/로이터·The Hill·Bloomberg)",
      dateStatus: "confirmed",
      sourceUrl: "https://www.usnews.com/news/world/articles/2026-05-14/trump-invites-xi-to-white-house-on-september-24",
      sources: [
        { name: "US News (Reuters)", url: "https://www.usnews.com/news/world/articles/2026-05-14/trump-invites-xi-to-white-house-on-september-24", tier: 2, isOfficial: false },
        { name: "The Hill", url: "https://thehill.com/homenews/administration/5877569-donald-trump-invites-xi-jinping-visit/", tier: 2, isOfficial: false },
        { name: "Bloomberg", url: "https://www.bloomberg.com/news/articles/2026-09-11/gulf-states-may-meet-iran-next-week-to-discuss-future-of-hormuz", tier: 2, isOfficial: false },
        LGG,
      ],
      nextCheck: "2026-09-21T00:00:00Z",
    },
  },
  {
    id: 258,
    expectTicker: "US",
    set: {
      description:
        "의회가 12월 11일까지 정부 자금을 연장하는 임시예산안(H.R. 6500, Continuing Appropriations and Extensions Act, 2027)을 상원 90-6, 하원 370-48로 통과시켰고 트럼프 대통령이 9/2 서명해 9월 30일 셧다운 변수는 해소됐다. 다음 시한은 12월 11일로 11월 중간선거 직후다. (출처: NAGGL·American Banker·The Hill)",
      dateStatus: "confirmed",
      reviewStatus: "published",
      sourceUrl: "https://www.naggl.org/president-signs-continuing-resolution-through-december-11/",
      sources: [
        { name: "NAGGL", url: "https://www.naggl.org/president-signs-continuing-resolution-through-december-11/", tier: 3, isOfficial: false },
        { name: "American Banker", url: "https://www.americanbanker.com/news/trump-signs-bill-funding-the-government-through-december", tier: 2, isOfficial: false },
        { name: "The Hill", url: "https://thehill.com/homenews/administration/6067996-trump-stopgap-funding-law-government-shutdown/", tier: 2, isOfficial: false },
      ],
      nextCheck: "2026-12-04T00:00:00Z",
    },
  },
  {
    id: 142,
    expectTicker: "XPL",
    set: {
      date: "2026-09-25T05:30:00Z", // 9/25 14:30 KST
      description:
        "플라즈마 메인넷 베타 출시(2025-09-25) 1년 클리프가 끝나 팀·투자자 물량 약 18억 1,000만 XPL이 9/25 05:30 UTC(한국시간 14시 30분)에 풀린다. 유통량이 약 27억 8,000만에서 46억 7,000만 XPL로 늘어나는 8~9월 최대 규모 언락. 나머지 팀·투자자 물량은 이후 2년간 월별 선형 해제로 2028년 9월 완료. (출처: Plasma 공식 토크노믹스·CoinMarketCal·CryptoTicker)",
      dateStatus: "confirmed",
      sources: [
        { name: "Plasma 공식 토크노믹스", url: "https://www.plasma.org/docs/get-started/xpl/tokenomics", tier: 1, isOfficial: true },
        { name: "CoinMarketCal (TradingView)", url: "https://www.tradingview.com/news/coinmarketcal:da3ef85c8094b:0-plasma-xpl-token-unlock-25-september-2026/", tier: 3, isOfficial: false },
        { name: "CryptoTicker", url: "https://cryptoticker.io/en/plasma-xpl-unlock-september-25-vesting-schedule/", tier: 3, isOfficial: false },
      ],
      nextCheck: null,
    },
  },
  {
    id: 131,
    expectTicker: "MU",
    set: {
      date: "2026-09-30T20:30:00Z", // 9/30 14:30 MT = 10/1 05:30 KST
      description:
        "마이크론이 회계연도 4분기 실적을 발표한다(현지 9/30 장 마감 후, 컨퍼런스콜 오후 2:30 MT, 한국시간 10/1 새벽 5시 30분). 8/26 공식 확정. HBM 수요와 메모리 가격 전망이 AI 반도체 섹터 방향을 가른다.",
      dateStatus: "confirmed",
      sources: [
        { name: "Micron IR", url: "https://investors.micron.com/news/press-release/2026/Micron-Technology-to-Report-Fiscal-Fourth-Quarter-Results-on-September-30-2026/default.aspx", tier: 1, isOfficial: true },
        { name: "Micron 공식 발표 (GlobeNewswire)", url: "https://www.globenewswire.com/news-release/2026/08/26/3351673/14450/en/micron-technology-to-report-fiscal-fourth-quarter-results-on-september-30-2026.html", tier: 1, isOfficial: true },
      ],
      nextCheck: null,
    },
  },
  {
    id: 287,
    expectTicker: "UPBIT",
    set: {
      date: "2026-09-28T06:00:00Z", // 9/28 15:00 KST
      title: "업비트·빗썸, 신세틱스(SNX) 거래지원 종료 (9/28 15:00)",
      description:
        "업비트가 9/28 15:00 신세틱스(SNX) 거래지원을 종료한다(업비트는 BTC 마켓 상장 종목). 빗썸도 같은 날 SNX 거래지원을 종료한다고 공지했다. 보유자는 공지된 출금 지원 기간 내 자산을 이전해야 한다. (출처: 업비트 공식 공지·블루밍비트)",
      dateStatus: "confirmed",
      sourceUrl: "https://www.upbit.com/service_center/notice?id=1506400376",
      sources: [
        { name: "업비트 공식 공지", url: "https://www.upbit.com/service_center/notice?id=1506400376", tier: 1, isOfficial: true },
        { name: "블루밍비트", url: "https://en.bloomingbit.io/feed/news/119289", tier: 3, isOfficial: false },
        LGG,
      ],
      nextCheck: null,
    },
  },
  {
    id: 280,
    expectTicker: "SKHYNIX",
    set: {
      description:
        "SK하이닉스가 8/21 한국거래소의 일본(미야기현) 반도체 공장 투자 보도 조회공시에 '검토 중이나 확정된 바 없다'고 답하며 확정 시 또는 1개월 내(9/21까지) 재공시하겠다고 밝혔다. Layergg 캘린더는 9/18을 시한으로 기재. 수십조원 규모 메모리 공장 투자 여부가 관건. (출처: TipRanks·경향신문·Layergg)",
      dateStatus: "estimated",
      sources: [
        { name: "TipRanks (공시 요약)", url: "https://www.tipranks.com/news/company-announcements/sk-hynix-clarifies-japan-plant-reports-after-korea-exchange-inquiry", tier: 2, isOfficial: false },
        { name: "경향신문", url: "https://www.khan.co.kr/en/article/202608212030017/", tier: 2, isOfficial: false },
        LGG,
      ],
      nextCheck: "2026-09-17T00:00:00Z",
    },
  },
  {
    id: 150,
    expectTicker: "US",
    set: {
      date: "2026-09-16T18:00:00Z", // 9/16 14:00 ET = 9/17 03:00 KST
      description:
        "미국 연준 FOMC가 9월 정례회의(15~16일)를 열고 기준금리를 결정한다. 경제전망요약(SEP)·점도표가 함께 공개돼 변동성이 크다. 결과 발표는 한국시간 17일 새벽 3시, 워시 의장 기자회견 3시 30분. 8월 PPI·CPI 이후 CME 페드워치 25bp 인상 확률 87%(9/11 기준). 같은 날 밤 9시 30분 8월 소매판매 발표. (출처: 연준 FOMC 공식 일정)",
    },
  },
];

// 텔레그램 자동 포착 오탐 — 상장 공지가 아닌 일반 뉴스 요약이 후보로 잡힌 건. 아카이브(삭제 대신 보존).
const ARCHIVE_IDS: { id: number; expectTitle: string }[] = [
  { id: 157, expectTitle: "코인 상장 후보 (텔레그램 포착)" },
  { id: 205, expectTitle: "ST 상장 후보 (텔레그램 포착)" },
  { id: 233, expectTitle: "코인 상장 후보 (텔레그램 포착)" },
  { id: 253, expectTitle: "코인 상장 후보 (텔레그램 포착)" },
];

const ADDS: {
  date: string;
  ticker: string;
  dupKeyword: string;
  title: string;
  description: string;
  category: string;
  groupMain: string;
  groupSub: string;
  importance: number;
  dateStatus: string;
  nextCheck?: string;
  sources: Src[];
}[] = [
  {
    date: "2026-09-16T12:30:00Z", // 9/16 08:30 ET = 21:30 KST
    ticker: "US",
    dupKeyword: "소매판매",
    title: "미국 소매판매 (8월분)",
    description:
      "미 상무부 센서스국이 8월 소매판매 속보치를 발표한다(현지 08:30 ET, 한국시간 21시 30분). FOMC 결과 발표(한국시간 17일 새벽 3시)와 같은 날이라 인상 결정 직전 마지막 수요 지표다. 휘발유 가격 상승분이 명목 소매판매를 부풀리는지가 관전 포인트. (출처: 센서스국 공식 일정)",
    category: "important",
    groupMain: "매크로",
    groupSub: "경제지표",
    importance: 2,
    dateStatus: "confirmed",
    sources: [
      { name: "센서스국 MARTS 공식 일정", url: "https://www.census.gov/retail/marts/www/marts_current.pdf", tier: 1, isOfficial: true },
      { name: "Investing.com 경제 캘린더", url: "https://www.investing.com/economic-calendar/retail-sales-256", tier: 2, isOfficial: false },
    ],
  },
  {
    date: "2026-09-14T00:00:00Z", // 9/14 09:00 KST (오만 현지 일정 시각 미공개)
    ticker: "IRAN",
    dupKeyword: "호르무즈",
    title: "이란·GCC·이라크 호르무즈 해협 회담 (오만 살랄라)",
    description:
      "이란이 9/14 오만 살랄라에서 걸프협력회의(GCC) 회원국과 이라크 외무장관들을 만나 호르무즈 해협 통항 안전과 상선 통과 방안을 논의한다. 이란·오만은 8월 항로·기뢰 제거·단기 관리 방안에 합의했으나 이란이 요구하는 통항료를 오만이 거부하고 있고, 바레인은 불참을 밝혔다. 이란 관리는 이번 회의에서 서명된 합의는 나오지 않는다고 했다. 브렌트유 104달러 안팎에서 유가 헤드라인 변수. (출처: Al Jazeera·Bloomberg·Jerusalem Post)",
    category: "important",
    groupMain: "매크로",
    groupSub: "지정학",
    importance: 2,
    dateStatus: "confirmed",
    nextCheck: "2026-09-14T00:00:00Z",
    sources: [
      { name: "Al Jazeera", url: "https://www.aljazeera.com/news/2026/9/11/iran-says-will-discuss-strait-of-hormuz-with-gulf-states-on-monday", tier: 2, isOfficial: false },
      { name: "Bloomberg", url: "https://www.bloomberg.com/news/articles/2026-09-11/gulf-states-may-meet-iran-next-week-to-discuss-future-of-hormuz", tier: 2, isOfficial: false },
      { name: "Jerusalem Post", url: "https://www.jpost.com/middle-east/iran-news/article-908421", tier: 3, isOfficial: false },
    ],
  },
];

async function main() {
  for (const u of UPDATES) {
    const cur = await prisma.calendarEvent.findUnique({ where: { id: u.id } });
    if (!cur) {
      console.log(`SKIP #${u.id}: 없음`);
      continue;
    }
    if (cur.ticker !== u.expectTicker) {
      console.log(`SKIP #${u.id}: 티커 불일치 (${cur.ticker} != ${u.expectTicker})`);
      continue;
    }
    const { date, nextCheck, ...rest } = u.set;
    await prisma.calendarEvent.update({
      where: { id: u.id },
      data: {
        ...rest,
        ...(date ? { date: new Date(date) } : {}),
        ...(nextCheck !== undefined ? { nextCheck: nextCheck ? new Date(nextCheck) : null } : {}),
      },
    });
    console.log(`UPDATE #${u.id} ${cur.ticker}: ${u.set.title ?? cur.title} → ${u.set.dateStatus ?? cur.dateStatus}/${u.set.reviewStatus ?? cur.reviewStatus}${date ? ` @${date}` : ""}`);
  }

  for (const a of ARCHIVE_IDS) {
    const cur = await prisma.calendarEvent.findUnique({ where: { id: a.id } });
    if (!cur || cur.title !== a.expectTitle) {
      console.log(`SKIP archive #${a.id}: 없음/제목 불일치`);
      continue;
    }
    if (cur.reviewStatus === "archived") {
      console.log(`SKIP archive #${a.id}: 이미 archived`);
      continue;
    }
    await prisma.calendarEvent.update({ where: { id: a.id }, data: { reviewStatus: "archived" } });
    console.log(`ARCHIVE #${a.id}: ${cur.title} (${cur.description.slice(0, 40)}…)`);
  }

  for (const e of ADDS) {
    const d = new Date(e.date);
    const lo = new Date(d.getTime() - 3 * 86400_000);
    const hi = new Date(d.getTime() + 3 * 86400_000);
    const dup = await prisma.calendarEvent.findFirst({
      where: { date: { gte: lo, lte: hi }, title: { contains: e.dupKeyword } },
    });
    if (dup) {
      console.log(`SKIP add ${e.ticker} ${e.date}: 이미 존재 #${dup.id}`);
      continue;
    }
    const created = await prisma.calendarEvent.create({
      data: {
        date: d,
        ticker: e.ticker,
        title: e.title,
        description: e.description,
        category: e.category,
        groupMain: e.groupMain,
        groupSub: e.groupSub,
        importance: e.importance,
        dateStatus: e.dateStatus,
        reviewStatus: "published",
        sourceUrl: e.sources[0].url,
        sources: e.sources,
        nextCheck: e.nextCheck ? new Date(e.nextCheck) : null,
      },
    });
    console.log(`ADD #${created.id} ${e.ticker} ${e.date}: ${e.title}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
