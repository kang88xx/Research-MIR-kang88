// KST 기준 "오늘부터 days일" UTC 범위.
// Date.now()를 lib 함수로 격리 — 서버 컴포넌트 렌더 본문에서 직접 호출 시
// react-hooks/purity 린트에 걸리는 것을 피하는 목적도 겸한다.
const KST = 9 * 3600_000;
// KST 오프셋(ms) — "+ 9 * 3600_000"을 각 파일이 재구현하지 않도록 단일 소스로 공개.
// 서버/클라이언트 공용(하이드레이션 안전: UTC 게터만 사용).
export const KST_MS = KST;

// KST "HH:MM"
export function kstHHMM(iso: string): string {
  const d = new Date(new Date(iso).getTime() + KST);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

// KST "M/D HH:MM"
export function kstMonthDayTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + KST);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${kstHHMM(iso)}`;
}

// KST(UTC+9) 기준 날짜 문자열 "YYYY-MM-DD". (listings·visits·actions가 공유)
export function kstDay(d: Date = new Date()): string {
  return new Date(d.getTime() + KST).toISOString().slice(0, 10);
}

// KST 자정의 UTC 시각 — 그날 00:00(KST)을 UTC Date로. (일일 적립 상한 집계 등)
export function kstDayStartUtc(d: Date = new Date()): Date {
  const kn = new Date(d.getTime() + KST);
  return new Date(Date.UTC(kn.getUTCFullYear(), kn.getUTCMonth(), kn.getUTCDate()) - KST);
}

export function upcomingKstRange(days: number): { now: number; startUtc: Date; endUtc: Date } {
  const now = Date.now();
  const kn = new Date(now + KST);
  const startUtc = new Date(Date.UTC(kn.getUTCFullYear(), kn.getUTCMonth(), kn.getUTCDate()) - KST);
  const endUtc = new Date(startUtc.getTime() + days * 86400_000);
  return { now, startUtc, endUtc };
}
