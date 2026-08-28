import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 2026-08-29 9월 캘린더 검증 업데이트.
// 근거(웹 검증 2026-08-29):
//  - MU: 마이크론 공식 발표(GlobeNewswire 8/26) — FQ4 실적 9/30(현지, 콜 14:30 MT). 기존 9/29 → 9/30 수정
//  - AAPL: 애플 공식 초청장 "Surprise and shine" 9/9 10:00 PT (MacRumors 8/26) — 추정 → 확정
//  - KBW: #144·#214 중복 → 나중 등록분(#214) archived
//  - FOMC 9/15~16(SEP 포함), BOJ 9/17~18, ECB 9/10, CPI 9/11, PPI 9/10, 고용 9/4, PCE·GDP 확정치 9/30: 기존 날짜 일치 확인
//  - 추가: 미 노동절 휴장 9/7, 추석 연휴 국내 증시 휴장 9/24~25 + 대체공휴일 9/28, ECB 통화정책회의 9/10,
//         XPL 9/25 1년 클리프(공식 토크노믹스) 확인, ASTER 9/17 팀 베스팅 개시(TGE+1년 클리프) 확인
// 실행: npx tsx prisma/update-events-2026-08-29.ts (멱등 — 재실행 안전)

type Src = { name: string; url: string; tier: number; isOfficial: boolean };

const UPDATES: {
  findDate: string;
  ticker: string;
  titleStartsWith: string;
  set: { date?: string; title?: string; description?: string; dateStatus: string; sources?: Src[] };
}[] = [
  {
    findDate: "2026-09-29",
    ticker: "MU",
    titleStartsWith: "마이크론 실적",
    set: {
      date: "2026-09-30",
      dateStatus: "confirmed",
      description:
        "마이크론이 회계연도 4분기 실적을 발표한다(현지 9/30 장 마감 후, 컨퍼런스콜 오후 2:30 MT). HBM 수요와 메모리 가격 전망이 AI 반도체 섹터 방향을 가른다.",
      sources: [
        { name: "Micron 공식 발표 (GlobeNewswire)", url: "https://www.globenewswire.com/news-release/2026/08/26/3351673/14450/en/micron-technology-to-report-fiscal-fourth-quarter-results-on-september-30-2026.html", tier: 1, isOfficial: true },
      ],
    },
  },
  {
    findDate: "2026-09-09",
    ticker: "AAPL",
    titleStartsWith: "애플 가을 이벤트",
    set: {
      title: "애플 이벤트 'Surprise and shine' (아이폰 18 프로·폴더블)",
      description:
        "애플이 9/9 오전 10시(PT, 한국시간 10일 새벽 2시) 애플파크에서 가을 이벤트를 연다. 아이폰 18 프로·프로 맥스와 첫 폴더블 아이폰(아이폰 울트라 예상), A20 프로(2nm) 공개가 유력하다.",
      dateStatus: "confirmed",
      sources: [
        { name: "Apple Events", url: "https://www.apple.com/apple-events/", tier: 1, isOfficial: true },
        { name: "MacRumors", url: "https://www.macrumors.com/2026/08/26/apple-iphone-event-2026/", tier: 2, isOfficial: false },
      ],
    },
  },
  {
    findDate: "2026-09-30",
    ticker: "US",
    titleStartsWith: "미국 개인소비지출(PCE)",
    set: {
      dateStatus: "confirmed",
      description:
        "미국 8월 개인소비지출(PCE) 물가가 발표된다(현지 8:30 ET). 같은 날 2분기 GDP 확정치(3차)와 기업이익도 함께 나온다. 연준이 가장 중시하는 물가 지표로 10월 FOMC 기대를 좌우한다.",
      sources: [{ name: "BEA 공식 일정", url: "https://www.bea.gov/news/schedule", tier: 1, isOfficial: true }],
    },
  },
];

// 중복 정리 — 같은 날짜·티커의 후행 등록분을 archived 처리
const ARCHIVE_DUPES: { date: string; ticker: string; titleStartsWith: string; keepOldest: true }[] = [
  { date: "2026-09-29", ticker: "KBW", titleStartsWith: "코리아 블록체인 위크", keepOldest: true },
];

const ADDS: {
  date: string;
  ticker: string;
  title: string;
  description: string;
  category: string;
  groupMain: string;
  groupSub: string;
  importance: number;
  sources: Src[];
}[] = [
  {
    date: "2026-09-07",
    ticker: "US",
    title: "미 노동절 — 미국 증시 휴장",
    description: "노동절(Labor Day)로 뉴욕증시(NYSE·나스닥)가 휴장한다. 미 주식·ETF 거래가 없어 크립토 시장의 미국발 유동성이 얇아지는 날.",
    category: "neutral",
    groupMain: "이벤트",
    groupSub: "행사",
    importance: 1,
    sources: [{ name: "장전 2026 증시 휴장일", url: "https://jangjeon.kr/events/holidays/", tier: 2, isOfficial: false }],
  },
  {
    date: "2026-09-10",
    ticker: "EU",
    title: "유럽중앙은행(ECB) 통화정책회의",
    description: "ECB가 통화정책회의를 열고 기준금리를 결정한다(발표 14:15 CET, 한국시간 21:15 · 기자회견 14:45 CET). 같은 날 미 PPI와 겹쳐 유로·달러 변동성이 커질 수 있다.",
    category: "neutral",
    groupMain: "매크로",
    groupSub: "금리결정",
    importance: 2,
    sources: [{ name: "ECB 공식 회의 일정", url: "https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html", tier: 1, isOfficial: true }],
  },
  {
    date: "2026-09-24",
    ticker: "KR",
    title: "추석 연휴 — 국내 증시 휴장 (9/24~25, 28 대체공휴일)",
    description: "추석 연휴로 24일(목)·25일(금) 국내 증권·파생상품시장이 휴장하고, 연휴 마지막 날(26일)이 토요일이라 28일(월)이 대체공휴일로 지정돼 휴장이 이어진다. 원화 유동성 공백으로 김치프리미엄 변동에 유의.",
    category: "neutral",
    groupMain: "이벤트",
    groupSub: "행사",
    importance: 2,
    sources: [
      { name: "유리지갑 2026 증시 휴장일 가이드", url: "https://glasswallet.com/blog/stock-market-holiday-2026-guide/", tier: 2, isOfficial: false },
      { name: "장전 2026 증시 휴장일", url: "https://jangjeon.kr/events/holidays/", tier: 2, isOfficial: false },
    ],
  },
];

const cell = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

async function main() {
  for (const u of UPDATES) {
    // 일부 행은 date에 시각(예: 12:30Z)이 들어 있어 셀 등가 대신 당일 범위로 찾는다
    const row = await prisma.calendarEvent.findFirst({
      where: { date: { gte: cell(u.findDate), lt: new Date(cell(u.findDate).getTime() + 86_400_000) }, ticker: u.ticker, title: { startsWith: u.titleStartsWith } },
    });
    if (!row) {
      const done = await prisma.calendarEvent.findFirst({
        where: {
          date: cell(u.set.date ?? u.findDate),
          ticker: u.ticker,
          title: { startsWith: (u.set.title ?? u.titleStartsWith).slice(0, 10) },
          dateStatus: u.set.dateStatus,
        },
      });
      console.log(done ? `[스킵] ${u.ticker} ${u.findDate} — 이미 반영됨` : `[경고] ${u.ticker} ${u.findDate} — 대상 없음, 확인 필요`);
      continue;
    }
    await prisma.calendarEvent.update({
      where: { id: row.id },
      data: {
        ...(u.set.date ? { date: cell(u.set.date) } : {}),
        ...(u.set.title ? { title: u.set.title } : {}),
        ...(u.set.description ? { description: u.set.description } : {}),
        dateStatus: u.set.dateStatus,
        ...(u.set.sources ? { sources: u.set.sources, sourceUrl: u.set.sources[0].url } : {}),
      },
    });
    console.log(`[수정] ${u.ticker} ${u.findDate}${u.set.date ? ` → ${u.set.date}` : ""} ${u.set.title ?? row.title} [${u.set.dateStatus}]`);
  }

  for (const d of ARCHIVE_DUPES) {
    const rows = await prisma.calendarEvent.findMany({
      where: { date: cell(d.date), ticker: d.ticker, title: { startsWith: d.titleStartsWith }, reviewStatus: { not: "archived" } },
      orderBy: { id: "asc" },
    });
    if (rows.length <= 1) {
      console.log(`[스킵] ${d.date} ${d.ticker} 중복 없음`);
      continue;
    }
    const keep = rows[0];
    const merged = [
      ...(((keep.sources as Src[] | null) ?? [])),
      ...rows.slice(1).flatMap((r) => ((r.sources as Src[] | null) ?? [])),
    ].filter((s, i, arr) => arr.findIndex((t) => t.url === s.url) === i);
    await prisma.calendarEvent.update({ where: { id: keep.id }, data: { sources: merged } });
    for (const r of rows.slice(1)) {
      await prisma.calendarEvent.update({ where: { id: r.id }, data: { reviewStatus: "archived" } });
      console.log(`[아카이브] #${r.id} ${r.title} — #${keep.id}에 출처 병합`);
    }
  }

  for (const a of ADDS) {
    const dup = await prisma.calendarEvent.findFirst({ where: { date: cell(a.date), ticker: a.ticker, title: a.title } });
    if (dup) {
      console.log(`[스킵] ${a.date} ${a.ticker} ${a.title} — 이미 존재`);
      continue;
    }
    await prisma.calendarEvent.create({
      data: {
        date: cell(a.date),
        ticker: a.ticker,
        title: a.title,
        description: a.description,
        category: a.category,
        groupMain: a.groupMain,
        groupSub: a.groupSub,
        dateStatus: "confirmed",
        importance: a.importance,
        sources: a.sources,
        sourceUrl: a.sources[0].url,
        reviewStatus: "published",
        nextCheck: null,
      },
    });
    console.log(`[추가] ${a.date} ${a.ticker} ${a.title}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
