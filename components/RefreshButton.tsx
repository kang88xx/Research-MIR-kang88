"use client";

import { useTransition } from "react";
import { refreshMarketData } from "@/lib/actions";

// 시세 업데이트 — 캐시를 비우고 강제로 새 데이터 fetch 후 전체 재검증. 클라이언트 상태는 유지.
// Pharos 라인 글리프 규칙(스퀘어 캡 스트로크)의 소형 아이콘 버튼.
export default function RefreshButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => refreshMarketData())}
      disabled={pending}
      aria-label="시세 업데이트"
      title="시세 강제 업데이트 (캐시 비우고 새로 받아옴)"
      className="shrink-0 rounded-[4px] p-1 text-ink-500 hover:bg-surface-2 hover:text-brand-ink disabled:opacity-60"
    >
      <svg
        className={pending ? "animate-spin" : ""}
        viewBox="0 0 24 24"
        width={15}
        height={15}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="square"
        strokeLinejoin="miter"
        aria-hidden
      >
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
      </svg>
    </button>
  );
}
