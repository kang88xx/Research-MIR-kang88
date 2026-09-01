import type { JSX, ReactNode } from "react";

// ───────────────────────────────────────────────────────────────
// Chip — 사이트 전역 필/칩 프리미티브.
// 그동안 목록·상세·데일리 본문에 같은 필 마크업(rounded-full + color-mix 11% 틴트)이
// 손으로 네 번 복제돼 있었다. 하나로 모아 톤·크기·아이콘만 프롭으로 받는다.
//
// variant
//   tint    — 의미 색 11% 틴트 + 같은 색 텍스트 (기본, 기존 스탠스·예측 필과 동일)
//   solid   — 의미 색 배경 + 반전 텍스트 (강조 1개짜리, 예: 중요 일정 D-day)
//   outline — 배경 없이 의미 색 보더 (경계·축소 같은 경고 톤)
//   surface — 무채색 표면 (판정 전 등 의미 없는 상태)
// ───────────────────────────────────────────────────────────────

export type ChipVariant = "tint" | "solid" | "outline" | "surface";
export type ChipSize = "xs" | "sm" | "md";

const SIZE: Record<ChipSize, { pad: string; text: string; gap: string; icon: number }> = {
  xs: { pad: "px-2 py-px", text: "text-[10px]", gap: "gap-[3px]", icon: 9 },
  sm: { pad: "px-2.5 py-[2px]", text: "text-[10.5px]", gap: "gap-[4px]", icon: 10 },
  md: { pad: "px-2.5 py-[3px]", text: "text-[11px]", gap: "gap-[5px]", icon: 11 },
};

export default function Chip({
  children,
  tone = "var(--color-neutral)",
  variant = "tint",
  size = "sm",
  icon,
  title,
  className = "",
}: {
  children: ReactNode;
  tone?: string; // CSS 색 (토큰 var(--color-*) 권장 — 다크 모드 자동 추종)
  variant?: ChipVariant;
  size?: ChipSize;
  icon?: ChipIconName;
  title?: string;
  className?: string;
}) {
  const s = SIZE[size];
  const style =
    variant === "tint"
      ? { color: tone, background: `color-mix(in srgb, ${tone} 11%, transparent)` }
      : variant === "solid"
        ? { color: "var(--color-on-brand)", background: tone }
        : variant === "outline"
          ? { color: tone, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tone} 45%, transparent)` }
          : undefined;

  return (
    <span
      title={title}
      style={style}
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full font-bold ${s.pad} ${s.text} ${s.gap} ${
        variant === "surface" ? "bg-paper2 text-ink-400" : ""
      } ${className}`}
    >
      {icon && <ChipIcon name={icon} size={s.icon} />}
      {children}
    </span>
  );
}

// ── 칩 전용 라인 글리프 ────────────────────────────────────────
// NavIcon(60vb 그리드)과 달리 칩은 10px 안팎이라 12vb 그리드 · 스트로크 1.6 ·
// 라운드 캡으로 따로 그린다. 색은 항상 currentColor — 칩 톤을 그대로 물려받는다.
export type ChipIconName =
  | "up"
  | "down"
  | "flat"
  | "check"
  | "cross"
  | "clock"
  | "spark"
  | "shield"
  | "target"
  | "trend";

const CHIP_GLYPHS: Record<ChipIconName, JSX.Element> = {
  up: (
    <>
      <path d="M6 9.6 V3.2" />
      <path d="M3.2 5.9 L6 3 L8.8 5.9" />
    </>
  ),
  down: (
    <>
      <path d="M6 2.4 V8.8" />
      <path d="M3.2 6.1 L6 9 L8.8 6.1" />
    </>
  ),
  flat: <path d="M2.6 6 H9.4" />,
  check: <path d="M2.6 6.3 L4.9 8.6 L9.4 3.6" />,
  cross: (
    <>
      <path d="M3.2 3.2 L8.8 8.8" />
      <path d="M8.8 3.2 L3.2 8.8" />
    </>
  ),
  clock: (
    <>
      <circle cx="6" cy="6" r="3.9" />
      <path d="M6 3.4 V6 L7.9 7.2" />
    </>
  ),
  spark: (
    <>
      <path d="M6 1.9 L7.1 4.9 L10.1 6 L7.1 7.1 L6 10.1 L4.9 7.1 L1.9 6 L4.9 4.9 Z" />
    </>
  ),
  shield: <path d="M6 1.9 L9.8 3.4 V6.2 C9.8 8.2 8.1 9.6 6 10.1 C3.9 9.6 2.2 8.2 2.2 6.2 V3.4 Z" />,
  target: (
    <>
      <circle cx="6" cy="6" r="4" />
      <circle cx="6" cy="6" r="1.4" />
    </>
  ),
  trend: (
    <>
      <path d="M2 8.8 L4.8 5.6 L7 7.2 L10 3.2" />
      <path d="M7.6 3.2 H10 V5.6" />
    </>
  ),
};

export function ChipIcon({ name, size = 10 }: { name: ChipIconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0"
    >
      {CHIP_GLYPHS[name]}
    </svg>
  );
}
