"use client";

import { useEffect } from "react";

// 접속자 집계 — 브라우저 세션당 1회만 /api/track 호출 (새 탭/세션 단위 카운트)
export default function VisitTracker() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem("ct_visit") === "1") return;
    } catch {
      // sessionStorage 불가 환경(시크릿 등)에서도 기록은 시도
    }
    // 성공했을 때만 세션 플래그 기록 — 로그인 전(401) 시도가 로그인 후 집계를 막지 않게
    fetch("/api/track", { method: "POST", keepalive: true })
      .then((r) => {
        if (r.ok) {
          try {
            sessionStorage.setItem("ct_visit", "1");
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  return null;
}
