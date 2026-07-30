"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV: [string, string][] = [
  ["/", "🏠 홈"],
  ["/dashboard", "📊 대시보드"],
  ["/dashboard#indicators", "📈 각종 지표"],
  ["/calendar", "📅 캘린더"],
  ["/dashboard#kimchi", "🌶️ 김치 프리미엄"],
  ["/#bubblemap", "🫧 버블맵"],
  ["/#telegram", "✈️ 텔레그램"],
  ["/analysis", "🔍 시장분석"],
];

// 모바일 헤더 네비 — 콘솔 라이트: 활성 탭은 딥네이비 볼드 + 네이비 인셋 언더라인
export default function NavLinks() {
  const pathname = usePathname();
  // 앵커 링크는 활성 표시하지 않는다 (본 메뉴와 이중 하이라이트 방지)
  const isActive = (href: string) =>
    href.includes("#")
      ? false
      : href === "/"
        ? pathname === "/"
        : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="order-3 -mx-4 flex w-full min-w-0 items-center overflow-x-auto px-4 text-sm whitespace-nowrap">
      {NAV.map(([href, label]) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            className={`shrink-0 px-3 py-2.5 transition-colors ${
              active
                ? "font-bold text-brand-ink shadow-[inset_0_-2px_0_var(--color-brand)]"
                : "font-medium text-ink-500 hover:text-ink-900"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
