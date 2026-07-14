import CryptoCalendar from "@/components/CryptoCalendar";

export const dynamic = "force-dynamic";

export default function CalendarPage() {
  const now = new Date();
  return (
    <div>
      {/* 타이틀은 캘린더 카드의 밴드 헤더가 담당 — 중복 배너 없음 */}
      <CryptoCalendar initialYear={now.getFullYear()} initialMonth={now.getMonth() + 1} />
    </div>
  );
}
