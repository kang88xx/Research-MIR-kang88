"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV: [string, string][] = [
  ["/", "홈"],
  ["/dashboard", "대시보드"],
  ["/free", "자유게시판"],
  ["/analysis", "시장분석"],
  ["/calendar", "캘린더"],
  ["/box", "랜덤박스"],
];

// 헤더 네비 — 활성 탭은 잉크 700 + 브랜드 오렌지 인셋 언더라인 (2a 파이낸스 그레이드)
export default function NavLinks() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="order-3 -mx-4 flex w-full min-w-0 items-center overflow-x-auto px-4 text-sm whitespace-nowrap md:order-none md:mx-0 md:w-auto md:shrink-0 md:justify-center md:px-0">
      {NAV.map(([href, label]) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            className={`shrink-0 px-3 py-2.5 transition-colors md:py-[18px] ${
              active
                ? "font-bold text-navy-900 shadow-[inset_0_-2px_0_var(--color-brand)]"
                : "font-medium text-ink-500 hover:text-navy-900"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
