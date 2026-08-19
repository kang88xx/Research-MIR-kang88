import type { MetadataRoute } from "next";

// 회원 전용(승인제) 사이트 — 크롤러 색인 불필요, 로그인 페이지만 노출되므로 전체 차단
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
