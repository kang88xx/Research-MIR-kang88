import type { JSX } from "react";

// Pharos 디자인 시스템 v2 라인 글리프 — 이모지 대체 메뉴 아이콘.
// 규칙: stroke currentColor · square linecap · miter join, 작은 사각 "핸들"(선택점)을
// 브랜드 컬러로 1~2개 포인트. (60vb 기준 스트로크 3.2 ≈ 원본 1.6px 규칙의 소형 보정)
export type IconName =
  | "home"
  | "dashboard"
  | "indicators"
  | "calendar"
  | "kimchi"
  | "bubble"
  | "telegram"
  | "research"
  | "members";

function Handle({ x, y }: { x: number; y: number }) {
  return <rect x={x} y={y} width={5} height={5} fill="var(--color-brand)" stroke="none" />;
}

const GLYPHS: Record<IconName, JSX.Element> = {
  home: (
    <>
      <path d="M12 28 L30 12 L48 28 L48 50 L12 50 Z" />
      <path d="M24 50 L24 36 L36 36 L36 50" />
      <Handle x={27.5} y={9} />
    </>
  ),
  dashboard: (
    <>
      <rect x="10" y="10" width="40" height="40" />
      <line x1="30" y1="10" x2="30" y2="50" />
      <line x1="10" y1="30" x2="50" y2="30" />
      <Handle x={7} y={7} />
      <Handle x={48} y={48} />
    </>
  ),
  indicators: (
    <>
      <path d="M10 48 L22 32 L32 40 L50 16" />
      <polyline points="40,16 50,16 50,26" />
      <Handle x={7} y={45} />
      <Handle x={47.5} y={13} />
    </>
  ),
  calendar: (
    <>
      <rect x="10" y="14" width="40" height="36" />
      <line x1="10" y1="26" x2="50" y2="26" />
      <line x1="20" y1="8" x2="20" y2="18" />
      <line x1="40" y1="8" x2="40" y2="18" />
      <Handle x={7} y={47} />
      <Handle x={48} y={11} />
    </>
  ),
  kimchi: (
    <>
      <circle cx="22" cy="24" r="12" />
      <circle cx="38" cy="36" r="12" />
      <Handle x={45} y={9} />
    </>
  ),
  bubble: (
    <>
      <circle cx="23" cy="22" r="12" />
      <circle cx="42" cy="38" r="9" />
      <circle cx="20" cy="45" r="5" />
      <Handle x={45} y={10} />
    </>
  ),
  telegram: (
    <>
      <path d="M10 30 L50 14 L50 46 Z" />
      <line x1="22" y1="30" x2="44" y2="30" />
      <Handle x={7} y={27.5} />
    </>
  ),
  research: (
    <>
      <circle cx="26" cy="26" r="14" />
      <line x1="36" y1="36" x2="50" y2="50" />
      <Handle x={47.5} y={47.5} />
    </>
  ),
  members: (
    <>
      <circle cx="30" cy="20" r="9" />
      <path d="M12 50 C12 37, 48 37, 48 50" />
      <Handle x={45} y={9} />
    </>
  ),
};

export default function NavIcon({
  name,
  size = 16,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 60 60"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={3.2}
      strokeLinecap="square"
      strokeLinejoin="miter"
      className={className}
      aria-hidden
    >
      {GLYPHS[name]}
    </svg>
  );
}
