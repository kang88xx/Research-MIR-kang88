"use client";

import { useState } from "react";
import { COIN_LOGOS } from "@/lib/logos";

// 국가/거시/특수 이벤트용 이모지 아이콘
const EMOJI_ICON: Record<string, string> = {
  US: "🇺🇸",
  USA: "🇺🇸",
  KR: "🇰🇷",
  JP: "🇯🇵",
  EU: "🇪🇺",
  CN: "🇨🇳",
  FOMC: "🏛️",
  FED: "🏛️",
  OPEC: "🛢️",
  IRAN: "⚠️",
  WORLDCUP: "⚽",
  ASIAD: "🏅",
  CME: "📈",
  MSCI: "📊",
  코인: "🪙", // 미확정 상장 후보(텔레그램 포착 등) — 특정 로고 없음
};

const BADGE_COLORS = [
  "bg-indigo-500/20 text-indigo-700",
  "bg-emerald-500/20 text-emerald-700",
  "bg-navy-900/10 text-navy-700",
  "bg-rose-500/20 text-rose-700",
  "bg-amber-300 text-navy-900",
  "bg-orange-500/20 text-orange-700",
];

function badgeColor(ticker: string): string {
  let hash = 0;
  for (let i = 0; i < ticker.length; i++) hash = (hash * 31 + ticker.charCodeAt(i)) >>> 0;
  return BADGE_COLORS[hash % BADGE_COLORS.length];
}

// 코인/종목 아이콘: 이모지 → 수집한 로컬 로고(public/logos/coins) → (옵션) 업비트 로고 CDN
// → 이니셜 뱃지 순서로 폴백. upbitLogo는 업비트 KRW 마켓 심볼이 확실한 곳(시그널 레이더)에서만
// 켠다 — 캘린더처럼 주식 티커가 섞이는 곳에서 켜면 동명 코인 로고가 잘못 붙을 수 있다.
export default function EventIcon({
  ticker,
  size = 13,
  upbitLogo = false,
}: {
  ticker: string;
  size?: number;
  upbitLogo?: boolean;
}) {
  const [failCount, setFailCount] = useState(0);
  const T = ticker.toUpperCase();
  const emoji = EMOJI_ICON[T];

  if (emoji) {
    return (
      <span className="shrink-0 leading-none" style={{ fontSize: size }}>
        {emoji}
      </span>
    );
  }

  const sources: string[] = [];
  if (COIN_LOGOS.has(T)) sources.push(`/logos/coins/${T}.png`);
  if (upbitLogo) sources.push(`https://static.upbit.com/logos/${T}.png`);
  const src = sources[failCount];

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={src} // src가 바뀌면 엘리먼트를 새로 만들어 onError 상태를 리셋
        src={src}
        width={size}
        height={size}
        alt=""
        className="shrink-0 rounded-full object-contain"
        onError={() => setFailCount((n) => n + 1)}
      />
    );
  }
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ${badgeColor(ticker)}`}
      style={{ width: size, height: size, fontSize: Math.max(7, size * 0.55) }}
    >
      {ticker.slice(0, 1)}
    </span>
  );
}
