import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 2026-08-26 정기 검증 업데이트 — 임박 추정 이벤트 확정 + 9월 실적일 확정 + 지수 일정 보강.
// 근거(웹 검증 2026-08-26):
//  - 빗썸: 부당이득반환 1심 선고 8/27 (PANews 보도)
//  - ZRO: 지원 종료 체인이 8개에서 15개로 확대(8/21 공지 확대), 8/28 확정 (LayerZero 공식 블로그)
//  - NFTfi: 8/31 프런트엔드 종료 확정 (공식 블로그 Sunsetting NFTfi)
//  - Revolut: EEA·스위스 USDT 상폐 8/31 확정 (다수 보도)
//  - AVGO: 공식 IR이 9/2(현지, 장 마감 후) 확정 — 기존 9/3에서 수정 (실적은 미국 현지일 관례)
//  - ADBE 9/10, ORCL 9/14, MU 9/29: 확정 전환 (TipRanks·Quartr 등 실적 캘린더 확정 표기)
//  - 지수: MSCI 11월 반기리뷰 발표 11/11·효력 12/1(기준일 11/30, MSCI 공식 일정),
//    코스피200 동시만기·정기변경 = 3·6·9·12월 둘째 목요일(9/10, 12/10),
//    미 쿼드러플 위칭 = 3·6·9·12월 셋째 금요일(9/18, 12/18)
// 실행: npx tsx prisma/update-events-2026-08-26.ts (멱등 — 재실행 안전)

type Src = { name: string; url: string; tier: number; isOfficial: boolean };

// ── 1) 기존 이벤트 수정: (기존 date, ticker, title 접두)로 찾아 갱신 ──
const UPDATES: {
  findDate: string; // 기존 셀 날짜
  ticker: string;
  titleStartsWith: string;
  set: {
    date?: string;
    title?: string;
    description?: string;
    dateStatus: string;
    sources?: Src[];
  };
}[] = [
  {
    findDate: "2026-08-27",
    ticker: "BITHUMB",
    titleStartsWith: "빗썸 BTC 과소지급",
    set: {
      dateStatus: "confirmed",
      description:
        "빗썸 비트코인 오지급 사태 관련 부당이득반환 청구 소송의 1심 선고가 예정되어 있다. 미회수 물량 회수 가능성과 거래소 착오송금 책임 범위의 기준이 될 판결로 주목된다.",
      sources: [
        { name: "PANews", url: "https://www.panewslab.com/ko/articles/019f8d6e-3780-74cc-b652-d4cd1cf09a60", tier: 2, isOfficial: false },
      ],
    },
  },
  {
    findDate: "2026-08-28",
    ticker: "ZRO",
    titleStartsWith: "레이어제로(ZRO) 8개 체인",
    set: {
      title: "레이어제로(ZRO) 15개 체인 지원 종료",
      description:
        "레이어제로가 아비트럼 노바, 크로노스 zkEVM 등 15개 체인의 DVN·Executor 서비스를 종료한다. 당초 발표에서 대상이 확대(8/21)됐다. 해당 체인의 스타게이트 자산은 기한 전 회수가 필요하다.",
      dateStatus: "confirmed",
      sources: [
        { name: "LayerZero 공식 블로그", url: "https://layerzero.network/blog/support-update-july-24-2026", tier: 1, isOfficial: true },
      ],
    },
  },
  {
    findDate: "2026-08-31",
    ticker: "NFTFI",
    titleStartsWith: "NFTfi 서비스 종료",
    set: {
      dateStatus: "confirmed",
      sources: [
        { name: "NFTfi 공식 블로그", url: "https://nftfi.com/blog/sunsetting-nftfi", tier: 1, isOfficial: true },
      ],
    },
  },
  {
    findDate: "2026-08-31",
    ticker: "REVOLUT",
    titleStartsWith: "레볼루트",
    set: {
      dateStatus: "confirmed",
      sources: [
        { name: "Yahoo Finance", url: "https://finance.yahoo.com/markets/crypto/articles/revolut-delist-usdt-europe-tether-100105588.html", tier: 2, isOfficial: false },
      ],
    },
  },
  {
    findDate: "2026-09-03",
    ticker: "AVGO",
    titleStartsWith: "브로드컴 실적",
    set: {
      date: "2026-09-02", // 공식 IR 확정일(현지) — 기존 추정 9/3에서 수정
      dateStatus: "confirmed",
      sources: [
        { name: "Broadcom IR", url: "https://investors.broadcom.com/news-releases/news-release-details/broadcom-inc-announce-third-quarter-fiscal-year-2026-financial", tier: 1, isOfficial: true },
      ],
    },
  },
  {
    findDate: "2026-09-10",
    ticker: "ADBE",
    titleStartsWith: "어도비 실적",
    set: {
      dateStatus: "confirmed",
      sources: [
        { name: "TipRanks 실적 캘린더", url: "https://www.tipranks.com/stocks/adbe/earnings", tier: 2, isOfficial: false },
      ],
    },
  },
  {
    findDate: "2026-09-14",
    ticker: "ORCL",
    titleStartsWith: "오라클 실적",
    set: {
      dateStatus: "confirmed",
      sources: [
        { name: "TipRanks 실적 캘린더", url: "https://www.tipranks.com/stocks/orcl/earnings", tier: 2, isOfficial: false },
      ],
    },
  },
  {
    findDate: "2026-09-29",
    ticker: "MU",
    titleStartsWith: "마이크론 실적",
    set: {
      dateStatus: "confirmed",
      sources: [
        { name: "TipRanks 실적 캘린더", url: "https://www.tipranks.com/stocks/mu/earnings", tier: 2, isOfficial: false },
      ],
    },
  },
];

// ── 2) 지수 일정 추가 (동일 날짜+티커+제목 존재 시 건너뜀 — 멱등) ──
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
    date: "2026-09-10",
    ticker: "KR200",
    title: "코스피200 선물·옵션 동시만기",
    description: "코스피200 선물·옵션 동시만기일(9월물). 만기 물량 청산·롤오버로 장중 변동성이 커질 수 있다.",
    category: "neutral",
    groupMain: "주식",
    groupSub: "지수",
    importance: 2,
    sources: [
      { name: "KRX 파생상품 만기 규칙(3·6·9·12월 둘째 목요일)", url: "https://kr.investing.com/futures-expiration-calendar/", tier: 2, isOfficial: false },
    ],
  },
  {
    date: "2026-09-18",
    ticker: "US",
    title: "미 쿼드러플 위칭 (선물·옵션 동시만기)",
    description: "미국 주가지수 선물·옵션, 개별주 선물·옵션 4종이 동시 만기되는 날. S&P 지수 분기 리밸런싱과 겹쳐 거래량과 변동성이 확대되는 경향이 있다.",
    category: "neutral",
    groupMain: "주식",
    groupSub: "지수",
    importance: 2,
    sources: [
      { name: "TradeStation 2026 쿼드러플 위칭 일정", url: "https://www.tradestation.com/insights/2026/01/23/quadruple-witching-dates-2026-stock-futures-trading/", tier: 2, isOfficial: false },
    ],
  },
  {
    date: "2026-11-11",
    ticker: "MSCI",
    title: "MSCI 11월 반기 지수 리뷰 결과 발표",
    description: "MSCI 반기 지수 리뷰(SAIR) 편출입 결과가 발표된다. 한국 종목의 편출입 여부에 따라 외국인 패시브 자금 유출입이 발생한다. 변경 효력은 12/1(11/30 종가 기준 반영).",
    category: "neutral",
    groupMain: "매크로",
    groupSub: "지수",
    importance: 2,
    sources: [
      { name: "MSCI 공식 리뷰 일정", url: "https://app2.msci.com/eqb/pressreleases/archive/ir_dates.csv", tier: 1, isOfficial: true },
    ],
  },
  {
    date: "2026-11-30",
    ticker: "MSCI",
    title: "MSCI 반기 리밸런싱 기준일 (종가 반영)",
    description: "11/11 발표된 MSCI 반기 리뷰 편출입이 이날 종가 기준으로 반영된다(효력일 12/1). 편출입 종목에 패시브 매매가 집중되는 날.",
    category: "neutral",
    groupMain: "매크로",
    groupSub: "지수",
    importance: 2,
    sources: [
      { name: "MSCI 공식 리뷰 일정", url: "https://app2.msci.com/eqb/pressreleases/archive/ir_dates.csv", tier: 1, isOfficial: true },
    ],
  },
  {
    date: "2026-12-10",
    ticker: "KR200",
    title: "코스피200 정기변경·선물옵션 동시만기",
    description: "연말 선물·옵션 동시만기일이자 코스피200 등 주요 지수 정기변경(리밸런싱)이 이날 종가 기준으로 진행된다. 편출입 종목 중심으로 수급 변동성이 커진다.",
    category: "neutral",
    groupMain: "주식",
    groupSub: "지수",
    importance: 2,
    sources: [
      { name: "KRX 파생상품 만기 규칙(3·6·9·12월 둘째 목요일)", url: "https://kr.investing.com/futures-expiration-calendar/", tier: 2, isOfficial: false },
    ],
  },
  {
    date: "2026-12-18",
    ticker: "US",
    title: "미 쿼드러플 위칭·S&P 분기 리밸런싱",
    description: "연말 쿼드러플 위칭(선물·옵션 4종 동시만기)과 S&P 지수 분기 리밸런싱이 겹치는 날. 기관 포지션 정리와 맞물려 거래량이 급증하는 경향이 있다.",
    category: "neutral",
    groupMain: "주식",
    groupSub: "지수",
    importance: 2,
    sources: [
      { name: "TradeStation 2026 쿼드러플 위칭 일정", url: "https://www.tradestation.com/insights/2026/01/23/quadruple-witching-dates-2026-stock-futures-trading/", tier: 2, isOfficial: false },
    ],
  },
];

const cell = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

async function main() {
  for (const u of UPDATES) {
    const row = await prisma.calendarEvent.findFirst({
      where: { date: cell(u.findDate), ticker: u.ticker, title: { startsWith: u.titleStartsWith } },
    });
    if (!row) {
      // 이미 갱신됐거나(재실행) 수기로 바뀐 경우 — 갱신 후 상태로 재검색해 멱등 확인만
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

  for (const a of ADDS) {
    const dup = await prisma.calendarEvent.findFirst({
      where: { date: cell(a.date), ticker: a.ticker, title: a.title },
    });
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
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
