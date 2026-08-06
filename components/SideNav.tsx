"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import NavIcon, { type IconName } from "@/components/NavIcon";

type Item = { href: string; icon: IconName; en: string };

// 콘솔 사이드바 네비 — Pharos 라인 글리프 + 모노 영문 라벨(영문 전용, 그룹 라벨 없음)
// 항목은 항상 동일하게 고정 노출 (페이지별 필터링 없음 — 메뉴 흔들림 방지)
const ITEMS: Item[] = [
  { href: "/calendar", icon: "calendar", en: "CALENDAR" },
  { href: "/indicators", icon: "indicators", en: "INDICATORS" },
  { href: "/kimchi", icon: "kimchi", en: "KIMCHI PREMIUM" },
  { href: "/bubble", icon: "bubble", en: "BUBBLE MAP" },
  { href: "/telegram", icon: "telegram", en: "TELEGRAM" },
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

  return (
    <nav>
      <ul className="flex flex-col">
        {ITEMS.map((it) => {
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
