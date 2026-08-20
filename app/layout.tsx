import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import ConsoleSidebar from "@/components/ConsoleSidebar";
import ListingsStrip from "@/components/ListingsStrip";
import VisitTracker from "@/components/VisitTracker";
import {
  HeaderSkeleton,
  ListingsStripSkeleton,
  SidebarAccountSkeleton,
} from "@/components/Skeletons";

// 데이터 콘솔 — UI/본문: Pretendard Variable(셀프호스팅 동적 서브셋) · 숫자/티커: Geist Mono.
// Noto Sans KR(next/font 4웨이트)은 제거 — 실제 한글은 Pretendard가 그려서 낭비 다운로드였고,
// 폴백은 시스템 서체(Apple SD Gothic Neo·Malgun Gothic, globals.css)로 충분하다.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "KMIR — Kang Market Intelligence & Research",
  description: "Kang의 투자 리서치 종합 지표 콘솔 — 실시간 시세·김치프리미엄·시장 분석·일정",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      {/* Pretendard Variable — 셀프호스팅(public/fonts, v1.3.9 동적 서브셋).
          jsdelivr CDN 의존 제거: 렌더 블로킹 서드파티·CDN 장애 리스크·CSP 예외가 함께 사라진다.
          no-css-tags 예외: 유니코드 레인지 서브셋 92개를 쓰는 폰트 CSS라 next/font로 못 옮긴다. */}
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link
        rel="stylesheet"
        href="/fonts/pretendard/pretendardvariable-dynamic-subset.min.css"
        precedence="default"
      />
      <body className="flex min-h-full flex-col">
        {/* 다크 모드 초기화 — 페인트 전에 html.dark 적용(FOUC 방지). 콘솔 톤은 라이트가 기본, 명시적으로 dark 저장 시에만 다크. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}`,
          }}
        />
        <VisitTracker />
        <div className="flex min-h-0 flex-1 items-stretch">
          {/* 좌측 사이드바 — 데스크톱 전용 (로고 · 번호형 네비 · 계정) */}
          <Suspense fallback={<SidebarAccountSkeleton />}>
            <ConsoleSidebar />
          </Suspense>
          {/* 우측 콘텐츠 컬럼 */}
          <div className="flex min-w-0 flex-1 flex-col">
            {/* 신규 상장·상폐 정보 — 전 페이지 최상단 고정 스트립 */}
            <div className="sticky top-0 z-40">
              <Suspense fallback={<ListingsStripSkeleton />}>
                <ListingsStrip />
              </Suspense>
            </div>
            {/* 모바일 헤더 — lg 미만에서만 (콘솔 라이트) */}
            <Suspense fallback={<HeaderSkeleton />}>
              <Header />
            </Suspense>
            <main className="w-full flex-1 px-5 py-8">{children}</main>
            {/* 푸터 — 투명 배경 한 줄: 워드마크 · 출처 · 면책 */}
            <footer>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 text-[11.5px] text-ink-400">
                <span className="text-xs font-bold text-navy-600">KMIR</span>
                <span>Data: Upbit · Binance · CoinGecko · Yahoo Finance</span>
                <span>Not financial advice. Trade at your own risk.</span>
              </div>
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}
