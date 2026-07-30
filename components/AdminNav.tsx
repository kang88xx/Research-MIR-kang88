"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import NavIcon, { type IconName } from "@/components/NavIcon";

const TABS: { href: string; icon: IconName; label: string }[] = [
  { href: "/admin", icon: "dashboard", label: "대시보드" },
  { href: "/admin/members", icon: "members", label: "회원" },
  { href: "/admin/events", icon: "calendar", label: "이벤트" },
];

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="mb-5 flex gap-1 border-b border-line">
      {TABS.map((t) => {
        const active = t.href === "/admin" ? pathname === "/admin" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-3.5 py-2 text-sm font-medium ${
              active
                ? "border-navy-900 text-navy-900"
                : "border-transparent text-ink-500 hover:text-navy-700"
            }`}
          >
            <NavIcon name={t.icon} size={14} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
