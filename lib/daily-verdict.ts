// ── 데일리 방향 예측 판정 — "다음날 09:00 KST 업비트 KRW-BTC 시가" 기준 ──
// 예측 정의(lib/daily-ai.ts 프롬프트·상세 페이지 칩)는 처음부터 "내일 오전 9시(KST)까지"였지만
// 구현은 판정가 소스가 없어 "바로 다음 데일리의 기록가"를 썼다. 그 결과 글 사이 공백이 3~4일이면
// 24시간짜리 예측이 96시간 변동으로 판정됐다(2026-09-26 감사: 16건 중 사이트 규칙 7적중,
// 다음날 09:00 규칙 9적중, 어긋난 4건이 전부 공백 탓). 업비트 일봉은 09:00 KST에 열리므로
// "다음날 일봉 시가"가 정의와 정확히 일치하는 판정가이고, 시가는 확정 뒤 바뀌지 않아 판정 불변성도 지킨다.
import { cachedJson } from "@/lib/cache";
import { fetchJson } from "@/lib/http";
import { kstDay } from "@/lib/time";
import { judgeDirection, type DirectionKey } from "@/lib/daily";

type UpbitDayCandle = { candle_date_time_kst: string; opening_price: number };

const UPBIT_DAYS = "https://api.upbit.com/v1/candles/days?market=KRW-BTC";
const BULK_DAYS = 200; // 업비트 1회 최대 — 최근 200일은 호출 한 번으로 덮는다

// 최근 200일 일봉 시가 — KST 날짜("YYYY-MM-DD") → 09:00 KST 시가(원). 10분 캐시(오늘 시가만 새로 생긴다).
async function getRecentOpens(): Promise<Record<string, number>> {
  return cachedJson("btcDailyOpens:v1", 10 * 60_000, async () => {
    const rows = await fetchJson<UpbitDayCandle[]>(`${UPBIT_DAYS}&count=${BULK_DAYS}`);
    const map: Record<string, number> = {};
    for (const r of rows) map[r.candle_date_time_kst.slice(0, 10)] = r.opening_price;
    return map;
  });
}

// 200일보다 오래된 날짜 — 그 날 하나만 받아 1년 캐시(과거 시가는 불변).
// to는 exclusive(그 시각 이전 캔들)이므로 판정일 다음날 00:00Z(=09:00 KST)를 넘긴다.
async function getOldOpen(dateKst: string): Promise<number | null> {
  return cachedJson(`btcDailyOpen:v1:${dateKst}`, 365 * 86400_000, async () => {
    const next = new Date(Date.parse(`${dateKst}T00:00:00Z`) + 86400_000).toISOString().slice(0, 19) + "Z";
    const rows = await fetchJson<UpbitDayCandle[]>(`${UPBIT_DAYS}&count=1&to=${next}`);
    const hit = rows.find((r) => r.candle_date_time_kst.slice(0, 10) === dateKst);
    return hit?.opening_price ?? null;
  });
}

// 판정일 = 발행일(KST)의 다음 날. 판정 시각은 그날 09:00 KST(업비트 일봉 시가 시각).
export function verdictDayKst(createdAt: Date): string {
  return kstDay(new Date(createdAt.getTime() + 86400_000));
}

export function verdictInstant(createdAt: Date): Date {
  // 09:00 KST = 00:00Z — 일봉 시가 시각
  return new Date(Date.parse(`${verdictDayKst(createdAt)}T00:00:00Z`));
}

export type DirectionVerdict = { changePct: number; judgedAtKrw: number; hit: boolean } | "pending";

// 여러 글을 한 번에 판정 — 목록 페이지용. 업비트 호출은 한 번(200일 범위 밖 글만 개별 조회).
export async function judgeDailyDirections(
  posts: { id: number; createdAt: Date; priceAtPost: number | null; direction: DirectionKey | null | undefined }[]
): Promise<Map<number, DirectionVerdict>> {
  const out = new Map<number, DirectionVerdict>();
  const targets = posts.filter((p) => p.direction && p.priceAtPost != null);
  if (targets.length === 0) return out;

  const now = Date.now();
  let recent: Record<string, number> = {};
  try {
    recent = await getRecentOpens();
  } catch {
    // 업비트 실패 — 아래에서 전부 "판정 전". 다음 데일리 기록가 같은 대체 소스는 쓰지 않는다(판정 불변성).
  }

  await Promise.all(
    targets.map(async (p) => {
      if (verdictInstant(p.createdAt).getTime() > now) {
        out.set(p.id, "pending");
        return;
      }
      const day = verdictDayKst(p.createdAt);
      let open: number | null = recent[day] ?? null;
      if (open == null && Object.keys(recent).length > 0 && day < Object.keys(recent).sort()[0]) {
        open = await getOldOpen(day).catch(() => null);
      }
      if (open == null || p.priceAtPost == null || p.priceAtPost <= 0) {
        out.set(p.id, "pending");
        return;
      }
      const changePct = ((open - p.priceAtPost) / p.priceAtPost) * 100;
      out.set(p.id, { changePct, judgedAtKrw: open, hit: judgeDirection(p.direction as DirectionKey, changePct) });
    })
  );
  return out;
}

export async function judgeDailyDirection(post: {
  id: number;
  createdAt: Date;
  priceAtPost: number | null;
  direction: DirectionKey | null | undefined;
}): Promise<DirectionVerdict | null> {
  if (!post.direction || post.priceAtPost == null) return null;
  const m = await judgeDailyDirections([post]);
  return m.get(post.id) ?? "pending";
}
