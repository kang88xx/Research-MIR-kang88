"use client";

import { useSyncExternalStore } from "react";

// html.dark 클래스 변경 구독 — 클래스가 바뀌면 재렌더를 트리거한다.
function subscribeThemeClass(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

// 다크 모드 토글 — html.dark 클래스 + localStorage("theme") 저장.
// 첫 방문 기본값은 다크(layout의 인라인 스크립트가 페인트 전에 적용).
// html.dark 클래스를 단일 진실로 useSyncExternalStore로 구독한다 — SSR 스냅샷(false)으로
// 하이드레이션한 뒤 실제 값으로 동기화되므로 effect 내 setState가 필요 없다.
export default function ThemeToggle() {
  const dark = useSyncExternalStore(
    subscribeThemeClass,
    () => document.documentElement.classList.contains("dark"),
    () => false
  );

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    // MutationObserver 구독이 클래스 변경을 감지해 재렌더한다.
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* 사생활 보호 모드 등 저장 불가 시 세션 내 전환만 유지 */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "라이트 모드로 전환" : "다크 모드로 전환"}
      title={dark ? "라이트 모드" : "다크 모드"}
      className="grid h-7 w-7 place-items-center rounded-[5px] text-[#aeb9c2] hover:bg-[#ffffff14] hover:text-[#e5e4e2]"
    >
      {dark ? (
        /* 해 — 라이트로 전환 */
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8" />
        </svg>
      ) : (
        /* 달 — 다크로 전환 */
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}
