"use client";

import { useTransition } from "react";
import { refreshMarketData } from "@/lib/actions";

// 시세 업데이트 — 캐시를 비우고 강제로 새 데이터 fetch 후 전체 재검증. 클라이언트 상태는 유지.
export default function RefreshButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => refreshMarketData())}
      disabled={pending}
      aria-label="시세 업데이트"
      title="시세 강제 업데이트 (캐시 비우고 새로 받아옴)"
      className={`shrink-0 rounded-[4px] px-1 text-[15px] leading-none hover:bg-surface-2 disabled:opacity-60 ${
        pending ? "animate-spin" : ""
      }`}
    >
      🔄
    </button>
  );
}
