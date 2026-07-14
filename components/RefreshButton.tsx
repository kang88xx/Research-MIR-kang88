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
      className="flex shrink-0 items-center gap-1.5 border border-[#3a4653] px-2.5 py-1 text-[11px] font-medium text-[#aeb9c2] hover:border-[#93a5b2] hover:text-[#e5e4e2] disabled:opacity-60"
    >
      <svg
        className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
      </svg>
      {pending ? "업데이트 중" : "업데이트"}
    </button>
  );
}
