"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import InAppBrowserNotice from "@/components/InAppBrowserNotice";
import { isInAppBrowser, openExternalBrowser } from "@/lib/inapp";

// 오픈리다이렉트/javascript:/백슬래시 우회 차단 — 동일 출처 경로만 허용
function safeCallback(raw: string | null): string {
  if (!raw) return "/";
  try {
    const u = new URL(raw, window.location.origin);
    if (u.origin === window.location.origin) return u.pathname + u.search + u.hash;
  } catch {
    // 파싱 불가 → 기본 경로
  }
  return "/";
}

// 가입·로그인 단일 진입점 — 구글 OAuth만 허용(이메일/비밀번호 폐지).
// 처음 로그인하면 자동 가입되며, 관리자 승인 후 사이트 열람 가능(proxy.ts 게이트).
function LoginForm() {
  const searchParams = useSearchParams();

  return (
    <div className="mx-auto mt-16 w-full max-w-sm border border-line bg-white p-8">
      <h1 className="text-center text-lg font-semibold text-navy-900">로그인</h1>
      <p className="mt-2 text-center text-xs leading-relaxed text-ink-500">
        구글 계정으로 로그인·가입할 수 있습니다.
        <br />
        신규 가입은 관리자 승인 후 이용 가능합니다.
      </p>
      <div className="mt-5">
        <InAppBrowserNotice />
      </div>
      <button
        type="button"
        onClick={() => {
          // 인앱 브라우저면 구글로 보내지 말고 외부 브라우저로 전환(403 차단 회피)
          if (isInAppBrowser()) {
            openExternalBrowser();
            return;
          }
          signIn("google", { callbackUrl: safeCallback(searchParams.get("callbackUrl")) });
        }}
        className="mt-2 flex w-full items-center justify-center gap-2 border border-navy-300 bg-white py-2.5 text-sm font-medium text-ink-900 hover:border-navy-900"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.49 12c0-.73.13-1.44.35-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.16-3.16A11 11 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
        </svg>
        Google로 계속하기
      </button>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
