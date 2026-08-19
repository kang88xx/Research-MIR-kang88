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

// 갱신 태스크 시작 (인스턴스 내 중복 합치기) — 반환된 프로미스는 항상 존재
function startRefresh<T>(key: string, fetcher: () => Promise<T>): Promise<unknown> {
  if (!inflight.has(key)) {
    const p = (async () => {
      const data = await fetcher();
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
  try {
    row = await prisma.marketCache.findUnique({
      where: { key },
      select: { data: true, updatedAt: true },
    });
  } catch {
    // DB 조회 실패 → row=null 유지하고 아래 inflight 경유로 갱신(동시 요청 합쳐 호출 폭주 방지)
  }

  const fresh = row && Date.now() - row.updatedAt.getTime() < ttlMs;
  if (fresh) return row!.data as T;

  // 만료됐지만 직전 데이터 있음 → stale 즉시 반환 + 백그라운드 갱신 (SWR)
  if (row) {
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
