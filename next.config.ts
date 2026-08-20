import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// 콘텐츠 보안 정책(CSP) — 현재 React 이스케이프로 XSS는 없지만, 의존성/향후 변경 대비 백스톱.
// Next/Tailwind의 인라인 부트스트랩·스타일 때문에 'unsafe-inline'은 유지하되 프레임 차단·
// object/base 제한 등 고가치 항목을 건다. dev는 React Refresh(eval)와 HMR 웹소켓을 허용.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  // Pretendard는 셀프호스팅(public/fonts)으로 전환 — 외부 CDN 예외 불필요
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:", // 외부 상품 이미지(https) 허용
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "frame-ancestors 'none'", // 클릭재킹 차단
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  devIndicators: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
