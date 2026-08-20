import { todayVisitsCached } from "@/lib/visits";

// 오늘 방문자 수 — VisitStat 실측 집계(고유 IP/일).
// 이전의 LiveViewers(난수 "LIVE" 표시)를 대체한다 — 투자 정보 사이트에서 조작된
// 실시간 지표는 신뢰도 리스크(2026-08-20 리뷰). 값은 60초 인메모리 캐시로 읽어
// 페이지 렌더마다 DB를 두드리지 않는다.
export default async function TodayVisits() {
  const n = await todayVisitsCached();
  if (n <= 0) return null;
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-[#8b98a3]" title="오늘 방문자 (KST, 고유 IP 기준)">
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
      TODAY <span className="font-mono font-semibold text-[#e5e4e2]">{n.toLocaleString()}</span>
    </span>
  );
}
