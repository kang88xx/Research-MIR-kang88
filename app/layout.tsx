import type { Metadata } from "next";
import { Suspense } from "react";
import { Noto_Sans_KR, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import TickerBar from "@/components/TickerBar";
import LogoStrip from "@/components/LogoStrip";
import MarketBar from "@/components/MarketBar";
import AppPromo from "@/components/AppPromo";
import VisitTracker from "@/components/VisitTracker";
import { HeaderSkeleton, MarketBarSkeleton } from "@/components/Skeletons";

// 2a 파이낸스 그레이드 — UI/본문: Noto Sans KR · 숫자/티커/날짜: IBM Plex Mono
const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Coinom 코인놈 - 크립토 커뮤니티",
  description: "실시간 시세와 김치프리미엄, 크립토 커뮤니티 코인놈(Coinom)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${notoSansKr.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <VisitTracker />
        {/* Header·MarketBar는 async라 Suspense로 감싸 셸을 막지 않게 한다(즉시 스트리밍) */}
        <Suspense fallback={<HeaderSkeleton />}>
          <Header />
        </Suspense>
        <TickerBar />
        {/* 마켓바 — 티커 바 아래에 배치 (크립토·주가지수·코인 미니차트 + 동시접속·언어) */}
        <Suspense fallback={<MarketBarSkeleton />}>
          <div className="reveal">
            <MarketBar />
          </div>
        </Suspense>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <AppPromo />
        <LogoStrip />
        {/* 푸터 — 투명 배경 한 줄: 워드마크 · 출처 · 면책 + 우측 앱 심사 칩 */}
        <footer>
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4 text-[11.5px] text-ink-400">
            <span className="font-mono text-xs font-bold text-navy-600">COINOM</span>
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
      </body>
    </html>
  );
}
