import { prisma } from "@/lib/prisma";

// 이벤트 출처 1건 — docs/data-collection/event-schema.json 의 sources 항목 매핑
// tier: 1=공식·구조화 / 2=집계·큐레이션 / 3=SNS·뉴스(검수필수)
export type EventSource = {
  name: string;
  url: string;
  tier?: 1 | 2 | 3;
  isOfficial?: boolean;
};

// 캘린더 이벤트 DTO — 서버에서 클라이언트로 넘길 때/JSON 응답 모두 date를 ISO 문자열로 통일.
// (CryptoCalendar 클라이언트 컴포넌트가 date:string 을 기대하므로 Date 직렬화를 한 곳에서 처리.)
export type CalendarEventDTO = {
  id: number;
  date: string; // ISO (UTC)
  isTba: boolean;
  ticker: string;
  title: string;
  description: string;
  category: string;
  groupMain: string;
  groupSub: string;
  sourceUrl: string | null;
  dateStatus: string; // confirmed | estimated | tba | revised | postponed | cancelled
  importance: number; // 1~3
  sources: EventSource[]; // 수집된 모든 출처 (없으면 sourceUrl 폴백 표시)
};

// Json 컬럼 → EventSource[] 정규화 (형식이 어긋난 항목은 버림)
function parseSources(raw: unknown): EventSource[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (s): s is EventSource =>
      !!s && typeof s === "object" && typeof (s as EventSource).name === "string" && typeof (s as EventSource).url === "string"
  );
}

function toDTO(e: {
  id: number;
  date: Date;
  isTba: boolean;
  ticker: string;
  title: string;
  description: string;
  category: string;
  groupMain: string;
  groupSub: string;
  sourceUrl: string | null;
  dateStatus: string;
  importance: number;
  sources: unknown;
}): CalendarEventDTO {
  return {
    id: e.id,
    date: e.date.toISOString(),
    isTba: e.isTba,
    ticker: e.ticker,
    title: e.title,
    description: e.description,
    category: e.category,
    groupMain: e.groupMain,
    groupSub: e.groupSub,
    sourceUrl: e.sourceUrl,
    dateStatus: e.dateStatus,
    importance: e.importance,
    sources: parseSources(e.sources),
  };
}

// 특정 월(UTC)의 이벤트 — 홈 SSR 초기 데이터와 /api/events 응답이 공유한다.
// 발행 게이트: draft·검수대기(pending_review)·보관(archived) 이벤트는 공개 캘린더에서 제외
// (docs/data-collection/README.md §1 — T3 소스는 교차확인 후 published로 승격해야 노출).
export async function getMonthEvents(year: number, month: number): Promise<CalendarEventDTO[]> {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const rows = await prisma.calendarEvent.findMany({
    where: {
      date: { gte: start, lt: end },
      reviewStatus: { in: ["published", "needs_recheck"] },
    },
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });
  return rows.map(toDTO);
}
