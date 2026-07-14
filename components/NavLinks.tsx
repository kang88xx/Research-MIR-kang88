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

// 헤더 네비 — 옵시디언 크롬 다크 헤더 위: 활성 탭은 알라바스터 + 라이트 슬레이트 인셋 언더라인
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
                ? "font-bold text-[#f4f3f1] shadow-[inset_0_-2px_0_#8fa5b5]"
                : "font-medium text-[#8b98a3] hover:text-[#e5e4e2]"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
