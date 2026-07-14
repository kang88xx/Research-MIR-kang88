import { Suspense } from "react";
import SignalRadar from "@/components/SignalRadar";
import ListingsStrip from "@/components/ListingsStrip";
import HomeBoards from "@/components/HomeBoards";
import CryptoCalendar from "@/components/CryptoCalendar";
import TelegramChannels from "@/components/TelegramChannels";
import BubbleMap from "@/components/BubbleMap";
import { getMonthEvents } from "@/lib/calendar";
import { getTelegramPopular } from "@/lib/telegram";
import {
  SignalRadarSkeleton,
  ListingsStripSkeleton,
  HomeBoardsSkeleton,
} from "@/components/Skeletons";

export const dynamic = "force-dynamic";

// 캘린더 이벤트는 빠른 로컬 DB 조회라 셸에서 바로 await(SSR)해 초기 스피너를 없앤다.
// 느린 외부 데이터(상장 스크래핑·시그널 레이더 등)는 각자의 Suspense 경계에서 독립
// 스트리밍되어, 가장 느린 데이터가 화면 전체를 막지 않는다.
// 텔레그램 인기 포스팅 — 30채널 수집(외부 호출)이 셸을 막지 않도록 Suspense 안에서 조회.
// 강프로 찻방(상장·상폐 추출)도 getTelegramPopular 내부에서 같은 사이클로 갱신된다.
async function TelegramSection() {
  const popular = await getTelegramPopular();
  return <TelegramChannels popular={popular} />;
}

// 2a 파이낸스 그레이드 — 캘린더(풀와이드) → 지금 주목할 코인·버블맵(반반 2열)
// → 텔레그램 인기 포스팅(가로 슬라이드) → 커뮤니티 게시판
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

      {/* 지금 주목할 코인 + 시총 상위 버블맵 — lg 이상에서 한 열 반반, 미만은 세로 스택 */}
      <div className="grid gap-[22px] lg:grid-cols-2 lg:items-stretch">
        <Suspense fallback={<SignalRadarSkeleton />}>
          <div className="reveal min-w-0">
            <SignalRadar />
          </div>
        </Suspense>

        {/* 버블맵은 옆의 랭킹 테이블 높이에 맞춰 늘어난다 (ResizeObserver가 부모 크기 추적) */}
        <section className="flex min-w-0 flex-col overflow-hidden rounded-[14px] border border-line bg-white">
          <header className="title-band flex items-baseline gap-2 border-b px-4 py-3 sm:px-6">
            <h2 className="text-[17px] font-extrabold tracking-[-0.3px] text-[#e5e4e2]">
              시총 상위 버블맵
            </h2>
            <span className="ml-auto font-mono text-[11px] font-medium tracking-[0.7px] text-[#93a5b2]">
              BUBBLE MAP
            </span>
          </header>
          <div className="flex-1 px-3 py-3">
            <div className="h-[340px] lg:h-full lg:min-h-[420px]">
              <BubbleMap />
            </div>
          </div>
        </section>
      </div>

      {/* 텔레그램 인기 포스팅 — 가로 슬라이드 스트립 */}
      <Suspense fallback={<TelegramChannels />}>
        <div className="reveal min-w-0">
          <TelegramSection />
        </div>
      </Suspense>

      {/* 커뮤니티 — 자유게시판 최신글 / 시장 분석 */}
      <Suspense fallback={<HomeBoardsSkeleton />}>
        <div className="reveal">
          <HomeBoards />
        </div>
      </Suspense>
    </div>
  );
}
