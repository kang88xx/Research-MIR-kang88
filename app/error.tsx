"use client";

import { useEffect } from "react";

// 라우트 세그먼트 에러 경계 — 서버 렌더 중 예외(주로 DB 콜드스타트 연결 실패) 시
// Next 기본 영문 500 대신 브랜드 톤의 안내 화면을 보여준다.
// DB(Neon)는 절전에서 깨어나는 데 수 초가 걸리므로 4초 후 1회 자동 재시도한다.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[error-boundary]", error.digest ?? error.message);
    // 자동 재시도는 2회까지만 — DB 한도 초과 같은 지속 장애에서 무한 재시도로
    // 서버리스 호출을 낭비하지 않는다. 60초 지나면 카운터를 새 장애로 보고 리셋.
    let rec = { n: 0, t: 0 };
    try {
      rec = JSON.parse(sessionStorage.getItem("err-auto-retry") ?? "") as typeof rec;
    } catch {
      /* 첫 발생 또는 파싱 불가 → 초기값 유지 */
    }
    const n = Date.now() - rec.t > 60_000 ? 0 : rec.n;
    if (n >= 2) return;
    try {
      sessionStorage.setItem("err-auto-retry", JSON.stringify({ n: n + 1, t: Date.now() }));
    } catch {
      /* 저장 불가 시에도 이번 재시도는 진행 */
    }
    const id = setTimeout(() => reset(), 4000 * (n + 1));
    return () => clearTimeout(id);
  }, [error, reset]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-[420px] rounded-[6px] border border-line bg-white p-8 text-center">
        <div className="font-mono text-[11px] font-medium tracking-[0.7px] text-amber-300">
          SERVER WAKING UP
        </div>
        <h1 className="mt-2 text-[19px] font-extrabold tracking-[-0.3px] text-ink-900">
          잠시만요, 서버를 깨우는 중이에요
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-500">
          일시적으로 데이터 서버 연결이 지연되고 있습니다.
          <br />
          몇 초 뒤 자동으로 다시 시도합니다.
        </p>
        <button
          onClick={() => reset()}
          className="mt-5 rounded-[5px] bg-navy-900 px-5 py-2.5 text-[13px] font-bold text-white transition-opacity hover:opacity-85"
        >
          지금 다시 시도
        </button>
      </div>
    </div>
  );
}
