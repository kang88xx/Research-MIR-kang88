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

// LKG(last-known-good) 인메모리 2차 캐시 — DB 장애 시에도 직전 정상 데이터를 즉시 반환해,
// 모든 요청이 "첫 수집" 분기로 빠져 외부 API를 인라인 호출하는 thundering herd
// (CoinGecko·업비트 429/차단 위험)를 막는다. 인스턴스 수명 동안만 유지.
// 갱신 여부는 항상 "가장 최신 데이터의 나이"로 판단한다(TTL 게이트) — DB 장애 중에도
// 외부 수집이 TTL 주기를 넘지 않고, upsert만 실패하는 장애에서 구 DB 행이 더 최신
// 수집분을 덮어쓰지 않는다(if-newer 규칙). (Codex 교차검수 2026-08-20)
const lkg = new Map<string, { data: unknown; at: number }>();

function lkgSetIfNewer(key: string, data: unknown, at: number): void {
  const cur = lkg.get(key);
  if (!cur || at > cur.at) lkg.set(key, { data, at });
}

// 수동 새로고침 등 강제 무효화용 — 이 인스턴스의 LKG를 버려 다음 요청이 재수집하게 한다.
// (DB 캐시 행만 지우면 인메모리 LKG가 fresh로 남아 같은 인스턴스에선 새로고침이 무력화된다.
//  다른 인스턴스의 LKG는 각자 TTL 만료로 자연 해소 — 최선 노력 무효화.)
export function invalidateLocalCache(keys: string[]): void {
  for (const k of keys) lkg.delete(k);
}

// 갱신 태스크 시작 (인스턴스 내 중복 합치기) — 반환된 프로미스는 항상 존재
// prev: 이 키의 직전 데이터(없으면 null) — 증분 갱신(직전 상태 위에 병합)이 필요한 fetcher용
function startRefresh<T>(key: string, fetcher: (prev: T | null) => Promise<T>, prev: T | null): Promise<unknown> {
  if (!inflight.has(key)) {
    const p = (async () => {
      const data = await fetcher(prev);
      lkgSetIfNewer(key, data, Date.now()); // DB 기록 실패해도 인메모리 LKG는 남긴다
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

// fetcher는 직전 데이터(prev)를 인자로 받는다 — 무시해도 되고, 상태를 누적하는 수집기는 병합에 쓴다.
export async function cachedJson<T>(
  key: string,
  ttlMs: number,
  fetcher: (prev: T | null) => Promise<T>
): Promise<T> {
  let row: { data: unknown; updatedAt: Date } | null = null;
  try {
    row = await prisma.marketCache.findUnique({
      where: { key },
      select: { data: true, updatedAt: true },
    });
  } catch {
    // DB 조회 실패 — row 없이 진행. 아래에서 LKG가 있으면 그걸로 응답한다("첫 수집" 오인 방지).
  }

  // DB 행을 LKG에 반영하되 더 최신인 인메모리 값은 보존 → best = 이 키의 가장 최신 데이터
  if (row) lkgSetIfNewer(key, row.data, row.updatedAt.getTime());
  const best = lkg.get(key) ?? null;

  // fresh — DB든 인메모리든 TTL 이내면 그대로 반환 (DB 장애 중에도 TTL 단위로만 외부 수집)
  if (best && Date.now() - best.at < ttlMs) return best.data as T;

  // 만료 + 직전 데이터 있음 → stale 즉시 반환 + 백그라운드 갱신 (SWR)
  if (best) {
    const refresh = startRefresh(key, fetcher, best.data as T).catch((err) => {
      // 백그라운드 실패는 사용자에겐 안 보이므로 경고로 남겨 만료 누적을 감지한다
      const ageMin = Math.round((Date.now() - best.at) / 60000);
      console.warn(`[cache] ${key} 백그라운드 갱신 실패 → stale 유지 (${ageMin}분 경과)`, err);
    });
    try {
      waitUntil(refresh); // Vercel: 응답 후에도 갱신 완료 보장. 로컬(Node)에서는 no-op처럼 동작.
    } catch {
      // waitUntil 미지원 환경 — refresh는 이미 실행 중이므로 그대로 둔다
    }
    return best.data as T;
  }

  // 직전 데이터 전무(진짜 첫 수집, 또는 DB 장애 + 인스턴스 콜드) → 인라인으로 기다린다
  try {
    return (await startRefresh(key, fetcher, null)) as T;
  } catch (err) {
    console.error(`[cache] ${key} 갱신 실패 + 직전 데이터 없음`, err);
    throw new Error(`marketCache:${key} 사용 불가`);
  }
}
