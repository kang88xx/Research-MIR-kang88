import { permanentRedirect } from "next/navigation";

// 대시보드 메뉴 제거(영구) — 기존 북마크·외부 링크 호환을 위해 홈(캘린더 최상단)으로 보낸다.
export default function DashboardPage() {
  permanentRedirect("/");
}
