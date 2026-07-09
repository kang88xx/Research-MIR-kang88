import { Suspense } from "react";
import SignalRadar from "@/components/SignalRadar";
import ListingsStrip from "@/components/ListingsStrip";
import UpcomingEvents from "@/components/UpcomingEvents";
import HomeBoards from "@/components/HomeBoards";
import CryptoCalendar from "@/components/CryptoCalendar";
import TelegramChannels from "@/components/TelegramChannels";
import BubbleMap from "@/components/BubbleMap";
import { getMonthEvents } from "@/lib/calendar";
import { getTelegramFeed } from "@/lib/telegram";
import {
  SignalRadarSkeleton,
  ListingsStripSkeleton,
  UpcomingEventsSkeleton,
  HomeBoardsSkeleton,
} from "@/components/Skeletons";

export const dynamic = "force-dynamic";

// 캘린더 이벤트는 빠른 로컬 DB 조회라 셸에서 바로 await(SSR)해 초기 스피너를 없앤다.
// 느린 외부 데이터(상장 스크래핑·시그널 레이더 등)는 각자의 Suspense 경계에서 독립
// 스트리밍되어, 가장 느린 데이터가 화면 전체를 막지 않는다.
// 텔레그램 피드 — 첫 수집(외부 호출)이 셸을 막지 않도록 Suspense 안에서 조회
async function TelegramSection() {
  const feed = await getTelegramFeed();
  return <TelegramChannels feed={feed} />;
}

// 2a 파이낸스 그레이드 — 캘린더(풀와이드) → 버블맵 → 실시간 시세(1fr) + 우측 레일(380px:
// 다가오는 일정 / 텔레그램 인기 포스팅) → 커뮤니티 게시판
export default async function Home() {
  // 캘린더는 UTC 통상일 기준으로 이벤트를 배치하므로 초기 달도 UTC 기준으로 잡는다.
  const now = new Date();
  const calYear = now.getUTCFullYear();
  const calMonth = now.getUTCMonth() + 1;
  // 현재 달 이벤트를 SSR로 미리 넘겨 초기 스피너·재요청을 없앤다(LCP·SEO 개선).
  const initialEvents = await getMonthEvents(calYear, calMonth);
  return (
    <div className="flex flex-col gap-[22px]">
      {/* 신규 상장·상폐 정보 — 맨 위. 스켈레톤이 풀리면 .reveal로 부드럽게 등장 */}
      <Suspense fallback={<ListingsStripSkeleton />}>
        <div className="reveal">
          <ListingsStrip />
        </div>
      </Suspense>

      {/* 크립토 캘린더 — 풀와이드 카드 (제목은 캘린더 자체 헤더 사용) */}
      <CryptoCalendar initialYear={calYear} initialMonth={calMonth} initialEvents={initialEvents} />

      {/* 시총 상위 버블맵 — 풀와이드 카드 */}
      <section className="overflow-hidden rounded-[14px] border border-line bg-white">
        <header className="flex items-baseline gap-2 px-4 pt-4 pb-3 sm:px-6">
          <h2 className="text-[17px] font-extrabold tracking-[-0.3px] text-navy-900">
            시총 상위 버블맵
          </h2>
          <span className="ml-auto font-mono text-[11px] font-medium tracking-[0.7px] text-ink-400">
            BUBBLE MAP
          </span>
        </header>
        <div className="px-3 pb-3">
          <div className="h-[340px] lg:h-[460px]">
            <BubbleMap />
          </div>
        </div>
      </section>

      {/* 실시간 시세 + 우측 레일 (다가오는 일정 / 텔레그램 인기 포스팅) */}
      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Suspense fallback={<SignalRadarSkeleton />}>
          <div className="reveal min-w-0">
            <SignalRadar />
          </div>
        </Suspense>
        <div className="flex min-w-0 flex-col gap-3.5">
          <Suspense fallback={<UpcomingEventsSkeleton />}>
            <div className="reveal">
              <UpcomingEvents />
            </div>
          </Suspense>
          <Suspense fallback={<TelegramChannels />}>
            <TelegramSection />
          </Suspense>
        </div>
      </div>

      {/* 커뮤니티 — 자유게시판 최신글 / 시장 분석 */}
      <Suspense fallback={<HomeBoardsSkeleton />}>
        <div className="reveal">
          <HomeBoards />
        </div>
      </Suspense>
    </div>
  );
}
