import type { Metadata } from "next";
import { Suspense } from "react";
import { Noto_Sans_KR, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import ConsoleSidebar from "@/components/ConsoleSidebar";
import MarketBar from "@/components/MarketBar";
import ListingsStrip from "@/components/ListingsStrip";
import RouteGate from "@/components/RouteGate";
import VisitTracker from "@/components/VisitTracker";
import {
  HeaderSkeleton,
  ListingsStripSkeleton,
  MarketBarSkeleton,
  SidebarAccountSkeleton,
} from "@/components/Skeletons";

// 데이터 콘솔 — UI/본문: Pretendard(CDN, 폴백 Noto Sans KR) · 숫자/티커/마이크로 라벨: Geist Mono
const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
});

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
      className={`${notoSansKr.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      {/* Pretendard Variable — 시안 본문 서체 (React 19가 head로 호이스팅) */}
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
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
            {/* 마켓바 — 홈·대시보드에서만 노출 (크립토·주가지수·코인 미니차트) */}
            <RouteGate show={["/", "/dashboard"]}>
              <Suspense fallback={<MarketBarSkeleton />}>
                <div className="reveal">
                  <MarketBar />
                </div>
              </Suspense>
            </RouteGate>
            <main className="w-full flex-1 px-5 py-8">{children}</main>
            {/* 푸터 — 투명 배경 한 줄: 워드마크 · 출처 · 면책 */}
            <footer>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 text-[11.5px] text-ink-400">
                <span className="text-xs font-bold text-navy-600">KMIR</span>
                <span>시세 출처: 업비트 · 바이낸스 · Yahoo(환율)</span>
                <span>투자 판단의 책임은 본인에게 있습니다.</span>
              </div>
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}
