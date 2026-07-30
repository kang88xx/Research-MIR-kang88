"use client";

import { useEffect, useState } from "react";
import { IN_APP_RE, openExternalBrowser } from "@/lib/inapp";

// 인앱 브라우저(카카오톡·네이버·라인·인스타·페북·안드로이드 웹뷰)에서는 구글 OAuth가
// "403 disallowed_useragent"로 차단된다(구글 "Use secure browsers" 정책).
// 감지되면 기본 브라우저(Chrome/Safari)로 다시 열도록 안내한다.
export default function InAppBrowserNotice() {
  const [ua, setUa] = useState<string | null>(null);

  useEffect(() => {
    // navigator는 클라이언트에서만 접근 가능 → 마운트 후 감지(하이드레이션 불일치 방지).
    // effect 내 동기 setState 회피: 다음 틱으로 지연(react-hooks/set-state-in-effect).
    const t = setTimeout(() => {
      if (IN_APP_RE.test(navigator.userAgent)) setUa(navigator.userAgent);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  if (!ua) return null;

  const isIos = /iphone|ipad|ipod/i.test(ua);

  return (
    <div className="mb-4 rounded-[6px] border border-warn bg-warn-bg p-3 text-xs">
      <p className="font-semibold text-warn">⚠ 인앱 브라우저에서는 구글 로그인이 안 됩니다</p>
      <p className="mt-1 text-ink-700">
        카카오톡·네이버 등 앱 안의 브라우저는 구글 정책상 로그인이 차단됩니다. 아래 버튼으로
        기본 브라우저(Chrome/Safari)에서 열어주세요.
      </p>
      <button
        type="button"
        onClick={openExternalBrowser}
        className="mt-2 w-full rounded-[5px] bg-warn py-2 font-semibold text-white hover:brightness-95"
      >
        외부 브라우저로 열기
      </button>
      {isIos && (
        <p className="mt-1.5 text-[11px] text-ink-500">
          iOS는 화면 우측 하단/상단 메뉴(···) → “기본 브라우저로 열기”를 눌러도 됩니다.
        </p>
      )}
    </div>
  );
}
