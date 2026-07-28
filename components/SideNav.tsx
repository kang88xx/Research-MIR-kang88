"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; num: string; ko: string; en: string };
type Group = { label: string; items: Item[] };

// 콘솔 사이드바 네비 — 번호형 항목 + 모노 영문 서브라벨, 그룹 마이크로 라벨
const GROUPS: Group[] = [
  {
    label: "MARKET · 시세",
    items: [
      { href: "/", num: "01", ko: "홈", en: "HOME" },
      { href: "/dashboard", num: "02", ko: "대시보드", en: "DASHBOARD" },
    ],
  },
  {
    label: "COMMUNITY · 커뮤니티",
    items: [
      { href: "/free", num: "03", ko: "자유게시판", en: "FORUM" },
      { href: "/analysis", num: "04", ko: "시장분석", en: "RESEARCH" },
    ],
  },
  {
    label: "SCHEDULE · 일정",
    items: [{ href: "/calendar", num: "05", ko: "캘린더", en: "CALENDAR" }],
  },
  {
    label: "REWARD · 리워드",
    items: [{ href: "/box", num: "06", ko: "랜덤박스", en: "RANDOM BOX" }],
  },
];

export default function SideNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

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
                      className={`font-mono text-[10px] ${active ? "font-semibold text-brand-ink" : "text-ink-400"}`}
                    >
                      {it.num}
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
