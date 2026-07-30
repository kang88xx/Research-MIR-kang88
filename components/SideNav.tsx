"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import NavIcon, { type IconName } from "@/components/NavIcon";

type Item = { href: string; icon: IconName; en: string; parent?: string };

// 콘솔 사이드바 네비 — Pharos 라인 글리프 + 모노 영문 라벨(영문 전용, 그룹 라벨 없음)
// parent가 있는 항목은 섹션 앵커 — 해당 페이지에 있을 때만 노출 (홈·대시보드 등 페이지 항목은 항상 노출)
const ITEMS: Item[] = [
  { href: "/", icon: "home", en: "HOME" },
  { href: "/dashboard", icon: "dashboard", en: "DASHBOARD" },
  { href: "/dashboard#indicators", icon: "indicators", en: "INDICATORS", parent: "/dashboard" },
  { href: "/calendar", icon: "calendar", en: "CALENDAR" },
  { href: "/dashboard#kimchi", icon: "kimchi", en: "KIMCHI PREMIUM", parent: "/dashboard" },
  { href: "/#bubblemap", icon: "bubble", en: "BUBBLE MAP", parent: "/" },
  { href: "/#telegram", icon: "telegram", en: "TELEGRAM", parent: "/" },
  { href: "/analysis", icon: "research", en: "RESEARCH" },
];

export default function SideNav() {
  const pathname = usePathname();
  // 앵커 링크는 활성 표시하지 않는다 (같은 경로의 본 메뉴와 이중 하이라이트 방지)
  const isActive = (href: string) =>
    href.includes("#")
      ? false
      : href === "/"
        ? pathname === "/"
        : pathname === href || pathname.startsWith(`${href}/`);

  const visible = ITEMS.filter((it) => !it.parent || it.parent === pathname);

  return (
    <nav>
      <ul className="flex flex-col">
        {visible.map((it) => {
          const active = isActive(it.href);
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className={`flex items-center gap-3 border-l-2 px-4 py-2.5 transition-colors ${
                  active ? "border-brand bg-brand-weak" : "border-transparent hover:bg-surface-2"
                }`}
              >
                <span
                  className={`w-5 shrink-0 ${active ? "text-brand-ink" : "text-ink-500"}`}
                  aria-hidden
                >
                  <NavIcon name={it.icon} size={17} className="mx-auto" />
                </span>
                <span
                  className={`font-mono text-[11px] tracking-[0.1em] uppercase ${
                    active ? "font-semibold text-brand-ink" : "font-medium text-ink-700"
                  }`}
                >
                  {it.en}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
