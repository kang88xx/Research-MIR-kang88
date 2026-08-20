import { prisma } from "@/lib/prisma";
import { waitUntil } from "@vercel/functions";

// 서버리스 인스턴스 간 공유 캐시 (DB 백엔드) — stale-while-revalidate.
// 요청 시점에는 캐시만 읽고:
//  - fresh → 즉시 반환
//  - 만료 + 직전 데이터 있음 → 직전 데이터(stale)를 즉시 반환하고 갱신은 백그라운드로
//    (waitUntil로 응답 후에도 갱신 완료를 보장 — 어떤 방문자도 외부 수집을 기다리지 않는다)
//  - 데이터 자체가 없음(첫 수집) → 이때만 인라인으로 기다린다
// 같은 인스턴스 내 동시 요청·DB 조회 실패 시에도 inflight로 합쳐 호출 폭주를 막는다.

const inflight = new Map<string, Promise<unknown>>();

// LKG(last-known-good) 인메모리 2차 캐시 — DB(Neon) 장애 시에도 직전 정상 데이터를
// 즉시 반환해, 모든 요청이 "첫 수집" 분기로 빠져 외부 API를 인라인 호출하는
// thundering herd(CoinGecko·업비트 429/차단 위험)를 막는다. 인스턴스 수명 동안만 유지.
const lkg = new Map<string, { data: unknown; at: number }>();

// 갱신 태스크 시작 (인스턴스 내 중복 합치기) — 반환된 프로미스는 항상 존재
function startRefresh<T>(key: string, fetcher: () => Promise<T>): Promise<unknown> {
  if (!inflight.has(key)) {
    const p = (async () => {
      const data = await fetcher();
      lkg.set(key, { data, at: Date.now() }); // DB 기록 실패해도 인메모리 LKG는 남긴다
      await prisma.marketCache
        .upsert({
          where: { key },
          update: { data: data as object },
          create: { key, data: data as object },
        })
        .catch(() => {});
      return data;
    })().finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return inflight.get(key)!;
}

export async function cachedJson<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  let row: { data: unknown; updatedAt: Date } | null = null;
  let dbFailed = false;
  try {
    row = await prisma.marketCache.findUnique({
      where: { key },
      select: { data: true, updatedAt: true },
    });
  } catch {
    dbFailed = true; // "캐시 없음(첫 수집)"과 구분 — 아래에서 LKG 폴백을 먼저 시도
  }

  const fresh = row && Date.now() - row.updatedAt.getTime() < ttlMs;
  if (fresh) {
    lkg.set(key, { data: row!.data, at: row!.updatedAt.getTime() });
    return row!.data as T;
  }

  // DB 조회 실패 + 인메모리 LKG 보유 → LKG를 즉시 반환하고 갱신은 백그라운드로.
  // (DB 다운을 "첫 수집"으로 오인해 전 요청이 외부 API를 인라인 대기하던 경로 차단)
  if (dbFailed) {
    const hit = lkg.get(key);
    if (hit) {
      const refresh = startRefresh(key, fetcher).catch(() => {});
      try {
        waitUntil(refresh);
      } catch {
        // waitUntil 미지원 환경 — refresh는 이미 실행 중
      }
      return hit.data as T;
    }
  }

  // 만료됐지만 직전 데이터 있음 → stale 즉시 반환 + 백그라운드 갱신 (SWR)
  if (row) {
    lkg.set(key, { data: row.data, at: row.updatedAt.getTime() });
    const refresh = startRefresh(key, fetcher).catch((err) => {
      // 백그라운드 실패는 사용자에겐 안 보이므로 경고로 남겨 만료 누적을 감지한다
      const ageMin = Math.round((Date.now() - row!.updatedAt.getTime()) / 60000);
      console.warn(`[cache] ${key} 백그라운드 갱신 실패 → stale 유지 (${ageMin}분 경과)`, err);
    });
    try {
      waitUntil(refresh); // Vercel: 응답 후에도 갱신 완료 보장. 로컬(Node)에서는 no-op처럼 동작.
    } catch {
      // waitUntil 미지원 환경 — refresh는 이미 실행 중이므로 그대로 둔다
    }
    return row.data as T;
  }

  // 직전 데이터 없음(첫 수집/DB 실패) → 인라인으로 기다린다
  try {
    return (await startRefresh(key, fetcher)) as T;
  } catch (err) {
    console.error(`[cache] ${key} 갱신 실패 + 직전 데이터 없음`, err);
    throw new Error(`marketCache:${key} 사용 불가`);
  }
}
