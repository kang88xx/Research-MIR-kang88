"use client";

import { usePathname } from "next/navigation";

// 지정한 경로에서만 children을 렌더 — 레이아웃 공용 요소(마켓 카드 등)의 페이지 제한용
export default function RouteGate({
  show,
  children,
}: {
  show: string[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return show.includes(pathname) ? <>{children}</> : null;
}
