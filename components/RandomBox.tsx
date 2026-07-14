"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { openRandomBox } from "@/lib/actions";
import { rarityMeta as rarityOf } from "@/lib/box";

export type PrizeLite = {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  rarity: string;
};

const ITEM = 128; // 셀 1칸 폭(px): w-28(112) + gap-4(16)
const STRIP = 64; // 릴 길이
const WIN_INDEX = 56; // 당첨 셀이 놓이는 위치 (끝부분에서 감속하며 정지)
const SPIN_MS = 4800; // 약 5초 모션

type Phase = "idle" | "rolling" | "result";

// 셀 — 실사 이미지가 카드 상단을 꽉 채우는 풀블리드 레이아웃
function Cell({ prize, dim }: { prize: PrizeLite; dim?: boolean }) {
  const { color } = rarityOf(prize.rarity);
  return (
    <div
      className="flex h-40 w-28 shrink-0 flex-col overflow-hidden border bg-white text-center"
      style={{ borderColor: color, opacity: dim ? 0.55 : 1 }}
    >
      <div className="h-28 w-full shrink-0 overflow-hidden" style={{ background: `${color}22` }}>
        {prize.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={prize.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center text-3xl font-bold" style={{ color }}>
            {prize.name.slice(0, 1)}
          </span>
        )}
      </div>
      <div className="flex flex-1 items-center justify-center px-1">
        <span className="line-clamp-2 text-[11px] font-semibold leading-tight text-navy-900">
          {prize.name}
        </span>
      </div>
    </div>
  );
}

export default function RandomBox({
  prizes,
  cost,
  points,
  loggedIn,
}: {
  prizes: PrizeLite[];
  cost: number;
  points: number;
  loggedIn: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [phase, setPhase] = useState<Phase>("idle");
  const [strip, setStrip] = useState<PrizeLite[]>([]);
  const [offset, setOffset] = useState(0);
  const [result, setResult] = useState<PrizeLite | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const canOpen = loggedIn && prizes.length > 0 && points >= cost && phase !== "rolling";

  function buildStrip(winner: PrizeLite): PrizeLite[] {
    const arr: PrizeLite[] = [];
    for (let i = 0; i < STRIP; i++) {
      if (i === WIN_INDEX) arr.push(winner);
      else arr.push(prizes[Math.floor(Math.random() * prizes.length)] ?? winner);
    }
    return arr;
  }

  function open() {
    if (!canOpen) {
      if (!loggedIn) setMessage("로그인 후 이용할 수 있습니다.");
      else if (prizes.length === 0) setMessage("등록된 상품이 없습니다.");
      else if (points < cost) setMessage(`포인트가 부족합니다. (${cost}P 필요)`);
      return;
    }
    setMessage(null);
    setResult(null);

    startTransition(async () => {
      const res = await openRandomBox();
      if (!res.ok) {
        setMessage(res.message);
        return;
      }
      const winner = res.prize;
      const built = buildStrip(winner);
      setStrip(built);
      setOffset(0); // 시작점(transition 없이)
      setResult(winner);
      setPhase("rolling");

      // 다음 페인트 후에 목표 위치로 이동 → CSS transition이 감속 연출
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const vw = viewportRef.current?.clientWidth ?? 0;
          // 당첨 셀 안에서 살짝 비껴 정지(0.3~0.7칸) → 매번 딱 중앙 아닌 자연스러움
          const within = (0.3 + Math.random() * 0.4) * ITEM;
          const target = WIN_INDEX * ITEM + within;
          setOffset(vw / 2 - target);
        })
      );
    });
  }

  function onRollEnd() {
    if (phase !== "rolling") return;
    setPhase("result");
    router.refresh(); // 포인트/내역 갱신
  }

  function reset() {
    setPhase("idle");
    setResult(null);
  }

  const won = result ? rarityOf(result.rarity) : null;

  return (
    <div className="flex flex-col gap-3">
      {/* 릴 뷰포트 */}
      <div
        ref={viewportRef}
        className="relative h-44 overflow-hidden border border-line bg-paper2"
      >
        {/* 중앙 포인터 */}
        <div className="pointer-events-none absolute left-1/2 top-0 z-10 h-full w-px -translate-x-1/2 bg-amber-500" />
        <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 border-x-[6px] border-t-[8px] border-x-transparent border-t-amber-500" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 z-10 -translate-x-1/2 border-x-[6px] border-b-[8px] border-x-transparent border-b-amber-500" />

        {strip.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-ink-500">
            {prizes.length === 0 ? "등록된 상품이 없습니다." : "박스를 열면 상품이 돌아갑니다."}
          </div>
        ) : (
          <div
            ref={trackRef}
            className="flex h-full items-center gap-4 px-0 will-change-transform"
            style={{
              transform: `translateX(${offset}px)`,
              transition: phase === "rolling" ? `transform ${SPIN_MS}ms cubic-bezier(0.12,0.85,0.16,1)` : "none",
            }}
            onTransitionEnd={onRollEnd}
          >
            {strip.map((p, i) => (
              <Cell key={i} prize={p} dim={phase === "result" && i !== WIN_INDEX} />
            ))}
          </div>
        )}
      </div>

      {/* 버튼 + 상태 */}
      <div className="flex flex-col items-center gap-1.5">
        <button
          onClick={open}
          disabled={!canOpen || pending}
          className="bg-amber-500 px-10 py-3 text-base font-bold text-navy-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {phase === "rolling" ? "두구두구…" : `랜덤박스 열기 (${cost}P)`}
        </button>
        <p className="text-xs text-ink-500">
          보유 포인트 <b className="font-semibold text-navy-900">{points.toLocaleString()}P</b>
        </p>
        {message && <p className="text-xs font-medium text-red-600">{message}</p>}
      </div>

      {/* 당첨 결과 모달 */}
      {phase === "result" && result && won && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 p-4" onClick={reset}>
          <div
            className="w-full max-w-sm border-2 bg-white px-6 py-7 text-center"
            style={{ borderColor: won.color, boxShadow: `0 0 40px ${won.color}66` }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="eyebrow" style={{ color: won.color }}>
              {won.label} 당첨
            </p>
            {/* 당첨 실사 — 모달 폭을 거의 채우는 대형 스퀘어 */}
            <div
              className="mx-auto my-4 flex aspect-square w-full max-w-[264px] items-center justify-center overflow-hidden rounded-xl"
              style={{ background: `${won.color}22`, boxShadow: `0 0 24px ${won.color}55` }}
            >
              {result.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={result.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-6xl font-bold" style={{ color: won.color }}>
                  {result.name.slice(0, 1)}
                </span>
              )}
            </div>
            <h3 className="text-xl font-bold text-navy-900">{result.name}</h3>
            {result.description && (
              <p className="mt-1 text-xs text-ink-500">{result.description}</p>
            )}
            <div className="mt-5 flex gap-2">
              <button
                onClick={reset}
                className="flex-1 border border-navy-300 py-2 text-sm font-medium text-ink-500 hover:border-navy-900 hover:text-navy-900"
              >
                닫기
              </button>
              <button
                onClick={() => {
                  reset();
                  open();
                }}
                disabled={points < cost}
                className="flex-1 bg-navy-900 py-2 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
              >
                다시 열기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
