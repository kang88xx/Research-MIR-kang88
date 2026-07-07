import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 2026 하반기 금리결정 일정 — 연 1회 정적 수집 (docs/data-collection/README.md §4 연간 루틴).
// 공식 원문에서 직접 확인 (검증일 2026-07-07):
// - FOMC: federalreserve.gov/monetarypolicy/fomccalendars.htm (7/28-29, 9/15-16*, 10/27-28, 12/8-9* — *는 SEP 포함)
//   달력 셀은 KST 발표일(회의 2일차 다음날 새벽) 기준 — 기존 7/30 FOMC 표기 관례와 동일.
// - 한은 금통위 통방: bok.or.kr listYear (7/16 기존재, 8/27, 10/22, 11/26)
// 7월분(7/16 금통위, 7/30 FOMC)은 seed-events-july.ts 로 이미 등록되어 있어 제외.
// 실행: npx tsx prisma/seed-macro-2026h2.ts (동일 날짜+티커+소분류 존재 시 건너뜀 — 멱등)

const FED_URL = "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm";
const BOK_URL = "https://www.bok.or.kr/portal/singl/crncyPolicyDrcMtg/listYear.do?mtgSe=A&menuNo=200755";

type Seed = {
  date: string; // UTC 자정 셀 날짜 (KST 발표일)
  ticker: string;
  title: string;
  description: string;
  sourceName: string;
  sourceUrl: string;
};

const EVENTS: Seed[] = [
  {
    date: "2026-08-27",
    ticker: "KR",
    title: "한은 기준금리 결정",
    description:
      "한국은행 금융통화위원회가 8월 통화정책방향 회의를 열고 기준금리를 결정한다. (출처: 한국은행 2026년 금통위 일정)",
    sourceName: "한국은행 금통위 일정",
    sourceUrl: BOK_URL,
  },
  {
    date: "2026-10-22",
    ticker: "KR",
    title: "한은 기준금리 결정",
    description:
      "한국은행 금융통화위원회가 10월 통화정책방향 회의를 열고 기준금리를 결정한다. (출처: 한국은행 2026년 금통위 일정)",
    sourceName: "한국은행 금통위 일정",
    sourceUrl: BOK_URL,
  },
  {
    date: "2026-11-26",
    ticker: "KR",
    title: "한은 기준금리 결정",
    description:
      "한국은행 금융통화위원회가 2026년 마지막 통화정책방향 회의를 열고 기준금리를 결정한다. (출처: 한국은행 2026년 금통위 일정)",
    sourceName: "한국은행 금통위 일정",
    sourceUrl: BOK_URL,
  },
  {
    date: "2026-09-17",
    ticker: "US",
    title: "미 FOMC 기준금리 결정 (점도표)",
    description:
      "미국 연준 FOMC가 9월 정례회의(15~16일)를 열고 기준금리를 결정한다. 경제전망요약(SEP)·점도표가 함께 공개돼 변동성이 크다. 결과 발표는 한국시간 17일 새벽 3시. (출처: 연준 FOMC 공식 일정)",
    sourceName: "연준 FOMC 공식 일정",
    sourceUrl: FED_URL,
  },
  {
    date: "2026-10-29",
    ticker: "US",
    title: "미 FOMC 기준금리 결정",
    description:
      "미국 연준 FOMC가 10월 정례회의(27~28일)를 열고 기준금리를 결정한다. 결과 발표는 한국시간 29일 새벽 3시. (출처: 연준 FOMC 공식 일정)",
    sourceName: "연준 FOMC 공식 일정",
    sourceUrl: FED_URL,
  },
  {
    date: "2026-12-10",
    ticker: "US",
    title: "미 FOMC 기준금리 결정 (점도표)",
    description:
      "미국 연준 FOMC가 12월 정례회의(8~9일)를 열고 기준금리를 결정한다. 경제전망요약(SEP)·점도표가 함께 공개된다. 결과 발표는 한국시간 10일 새벽 4시(서머타임 해제). (출처: 연준 FOMC 공식 일정)",
    sourceName: "연준 FOMC 공식 일정",
    sourceUrl: FED_URL,
  },
];

async function main() {
  let created = 0;
  for (const e of EVENTS) {
    const date = new Date(`${e.date}T00:00:00Z`);
    const exists = await prisma.calendarEvent.findFirst({
      where: { date, ticker: e.ticker, groupSub: "금리결정" },
      select: { id: true },
    });
    if (exists) {
      console.log(`skip (이미 존재): ${e.date} ${e.ticker} ${e.title}`);
      continue;
    }
    await prisma.calendarEvent.create({
      data: {
        date,
        isTba: false,
        ticker: e.ticker,
        title: e.title,
        description: e.description,
        category: "important",
        groupMain: "매크로",
        groupSub: "금리결정",
        sourceUrl: e.sourceUrl,
        dateStatus: "confirmed",
        importance: 3,
        sources: [{ name: e.sourceName, url: e.sourceUrl, tier: 1, isOfficial: true }],
        reviewStatus: "published",
      },
    });
    created++;
    console.log(`created: ${e.date} ${e.ticker} ${e.title}`);
  }
  console.log(`완료 — 신규 ${created}건 / 전체 ${EVENTS.length}건`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
