"use client";

import { useActionState } from "react";
import { syncUnlockCalendar, type UnlockSyncState } from "@/lib/actions";

// 어드민 캘린더 — 언락 일정 수동 동기화 버튼.
// 버블맵 100종목 기준 Coindar 언락 이벤트를 검수 큐(pending_review)로 수집한다.
export default function UnlockSyncButton() {
  const [state, action, pending] = useActionState<UnlockSyncState, FormData>(
    syncUnlockCalendar,
    null
  );
  return (
    <form action={action} className="flex flex-wrap items-center justify-end gap-2">
      <button
        disabled={pending}
        className="border border-navy-300 px-3 py-1 text-xs font-semibold text-navy-700 hover:border-navy-900 hover:text-navy-900 disabled:opacity-50"
      >
        {pending ? "동기화 중..." : "언락 동기화"}
      </button>
      {state && (
        <span className={`text-[11px] ${state.ok ? "text-emerald-700" : "text-red-600"}`}>
          {state.message}
        </span>
      )}
    </form>
  );
}
