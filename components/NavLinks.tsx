"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import NavIcon, { type IconName } from "@/components/NavIcon";

const NAV: { href: string; icon: IconName; label: string }[] = [
  { href: "/dashboard", icon: "dashboard", label: "대시보드" },
  { href: "/indicators", icon: "indicators", label: "각종 지표" },
  { href: "/calendar", icon: "calendar", label: "캘린더" },
  { href: "/kimchi", icon: "kimchi", label: "김치 프리미엄" },
  { href: "/bubble", icon: "bubble", label: "버블맵" },
  { href: "/telegram", icon: "telegram", label: "텔레그램" },
  { href: "/analysis", icon: "research", label: "시장분석" },
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
      {NAV.map(({ href, icon, label }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex shrink-0 items-center gap-1.5 px-3 py-2.5 transition-colors ${
              active
                ? "font-bold text-brand-ink shadow-[inset_0_-2px_0_var(--color-brand)]"
                : "font-medium text-ink-500 hover:text-ink-900"
            }`}
          >
            <NavIcon name={icon} size={14} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
