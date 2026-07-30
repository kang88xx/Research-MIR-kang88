"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import NavIcon, { type IconName } from "@/components/NavIcon";

type Item = { href: string; icon: IconName; ko: string; en: string };
type Group = { label: string; items: Item[] };

// 콘솔 사이드바 네비 — Pharos 라인 글리프 + 모노 영문 서브라벨, 그룹 마이크로 라벨
// 페이지 없는 항목(각종 지표·김프·버블맵·텔레그램)은 해당 섹션 앵커로 이동
const GROUPS: Group[] = [
  {
    label: "MARKET · 시세",
    items: [
      { href: "/", icon: "home", ko: "홈", en: "HOME" },
      { href: "/dashboard", icon: "dashboard", ko: "대시보드", en: "DASHBOARD" },
      { href: "/dashboard#indicators", icon: "indicators", ko: "각종 지표", en: "INDICATORS" },
    ],
  },
  {
    label: "SCHEDULE · 일정",
    items: [{ href: "/calendar", icon: "calendar", ko: "캘린더", en: "CALENDAR" }],
  },
  {
    label: "DATA · 데이터",
    items: [
      { href: "/dashboard#kimchi", icon: "kimchi", ko: "김치 프리미엄", en: "KIMCHI PREMIUM" },
      { href: "/#bubblemap", icon: "bubble", ko: "버블맵", en: "BUBBLE MAP" },
      { href: "/#telegram", icon: "telegram", ko: "텔레그램 포스팅", en: "TELEGRAM" },
    ],
  },
  {
    label: "RESEARCH · 리서치",
    items: [{ href: "/analysis", icon: "research", ko: "시장분석", en: "RESEARCH" }],
  },
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
    <nav className="flex flex-col gap-4">
      {GROUPS.map((g) => (
        <div key={g.label}>
          <p className="px-4 font-mono text-[9.5px] font-medium tracking-[0.16em] text-ink-400 uppercase">
            {g.label}
          </p>
          <ul className="mt-1.5">
            {g.items.map((it) => {
              const active = isActive(it.href);
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    className={`flex items-center gap-3 border-l-2 px-4 py-2 transition-colors ${
                      active
                        ? "border-brand bg-brand-weak"
                        : "border-transparent hover:bg-surface-2"
                    }`}
                  >
                    <span
                      className={`w-5 shrink-0 ${active ? "text-brand-ink" : "text-ink-500"}`}
                      aria-hidden
                    >
                      <NavIcon name={it.icon} size={17} className="mx-auto" />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span
                        className={`text-[13px] leading-tight ${
                          active ? "font-bold text-brand-ink" : "font-medium text-ink-700"
                        }`}
                      >
                        {it.ko}
                      </span>
                      <span className="font-mono text-[8.5px] tracking-[0.14em] text-ink-400 uppercase">
                        {it.en}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
