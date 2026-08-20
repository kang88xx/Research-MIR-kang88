import CryptoCalendar from "@/components/CryptoCalendar";
import { getMonthEvents } from "@/lib/calendar";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  // 캘린더는 UTC 통상일 기준으로 이벤트를 배치하므로 초기 달도 UTC 기준(홈과 동일).
  // 서버 로컬 시간(Vercel=UTC지만 로컬 개발은 KST)을 쓰면 월 경계에서 어긋난다.
  const now = new Date();
  const calYear = now.getUTCFullYear();
  const calMonth = now.getUTCMonth() + 1;
  // 현재 달 이벤트를 SSR로 미리 넘겨 초기 스피너·재요청을 없앤다(홈과 동일 패턴).
  // DB 실패 시 undefined — 클라이언트가 /api/events 로드를 시도하고 에러 UI로 폴백.
  const initialEvents = await getMonthEvents(calYear, calMonth).catch(() => undefined);
  return (
    <div>
      {/* 타이틀은 캘린더 카드의 밴드 헤더가 담당 — 중복 배너 없음 */}
      <CryptoCalendar initialYear={calYear} initialMonth={calMonth} initialEvents={initialEvents} />
    </div>
  );
}
