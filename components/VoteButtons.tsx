"use client";

import { useState, useTransition } from "react";
import { votePost } from "@/lib/actions";

export default function VoteButtons({
  postId,
  upvotes,
  downvotes,
}: {
  postId: number;
  upvotes: number;
  downvotes: number;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const vote = (value: 1 | -1) => {
    startTransition(async () => {
      const result = await votePost(postId, value);
      if (!result.ok) setMessage(result.message);
    });
  };

  return (
    <div className="flex flex-col items-center gap-2 py-4">
      {/* 필 한 쌍 — 평시엔 무채색, 호버 시에만 상승=레드/하락=블루 관례색이 드러난다 */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => vote(1)}
          disabled={pending}
          className="group flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-[13px] font-semibold text-ink-900 transition-colors hover:border-[var(--color-up)] hover:bg-paper2 hover:text-[var(--color-up)] disabled:opacity-50"
        >
          <span className="text-[10px] text-[var(--color-up)]">▲</span>
          추천
          <span className="font-mono font-bold tabular-nums">{upvotes}</span>
        </button>
        <button
          onClick={() => vote(-1)}
          disabled={pending}
          className="group flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-[13px] font-semibold text-ink-900 transition-colors hover:border-[var(--color-down)] hover:bg-paper2 hover:text-[var(--color-down)] disabled:opacity-50"
        >
          <span className="text-[10px] text-[var(--color-down)]">▼</span>
          비추천
          <span className="font-mono font-bold tabular-nums">{downvotes}</span>
        </button>
      </div>
      {message && <p className="text-xs text-ink-500">{message}</p>}
    </div>
  );
}
