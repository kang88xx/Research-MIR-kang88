import type { Metadata } from "next";
import { Suspense } from "react";
import { Noto_Sans_KR, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import ConsoleSidebar from "@/components/ConsoleSidebar";
import TickerBar from "@/components/TickerBar";
import MarketBar from "@/components/MarketBar";
import AppPromo from "@/components/AppPromo";
import VisitTracker from "@/components/VisitTracker";
import { HeaderSkeleton, MarketBarSkeleton, SidebarAccountSkeleton } from "@/components/Skeletons";

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
  title: "가자가자 - 크립토 커뮤니티",
  description: "실시간 시세와 김치프리미엄, 크립토 커뮤니티 가자가자",
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
        {/* 콘솔 상단 스트립 — 얇은 모노 시스템 바 */}
        <div className="console-strip flex items-center justify-between px-4 py-[7px]">
          <span>V2.0 — DATA CONSOLE</span>
          <span className="hidden sm:block">가자가자 · CRYPTO RESEARCH DESK</span>
          <span>COINOM.KANG88.IO</span>
        </div>
        <div className="flex min-h-0 flex-1 items-stretch">
          {/* 좌측 사이드바 — 데스크톱 전용 (로고 · 번호형 네비 · 계정) */}
          <Suspense fallback={<SidebarAccountSkeleton />}>
            <ConsoleSidebar />
          </Suspense>
          {/* 우측 콘텐츠 컬럼 */}
          <div className="flex min-w-0 flex-1 flex-col">
            {/* 모바일 헤더 — lg 미만에서만 (콘솔 라이트) */}
            <Suspense fallback={<HeaderSkeleton />}>
              <Header />
            </Suspense>
            <TickerBar />
            {/* 마켓바 — 티커 바 아래 (크립토·주가지수·코인 미니차트 + 동시접속·언어) */}
            <Suspense fallback={<MarketBarSkeleton />}>
              <div className="reveal">
                <MarketBar />
              </div>
            </Suspense>
            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
            <AppPromo />
            {/* 푸터 — 투명 배경 한 줄: 워드마크 · 출처 · 면책 + 우측 앱 심사 칩 */}
            <footer>
              <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4 text-[11.5px] text-ink-400">
                <span className="text-xs font-bold text-navy-600">가자가자</span>
                <span>시세 출처: 업비트 · 바이낸스 · Yahoo(환율)</span>
                <span>투자 판단의 책임은 본인에게 있습니다.</span>
                <span className="ml-auto flex items-center gap-2">
                  <span className="rounded-[5px] bg-navy-100 px-2 py-0.5 text-[10.5px] font-bold text-ink-500">
                    iOS 심사중
                  </span>
                  <span className="rounded-[5px] bg-navy-100 px-2 py-0.5 text-[10.5px] font-bold text-ink-500">
                    Android 심사중
                  </span>
                  모바일 앱 출시 예정
                </span>
              </div>
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}
