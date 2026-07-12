"use client";

// 한국 텔레그램 인기 포스팅 — 가로 슬라이드 스트립 (풀와이드, 낮은 높이).
// 실데이터: lib/telegram getTelegramPopular(한국 크립토 25채널 t.me 프리뷰, 15분 캐시)
// 에서 혼합 점수(조회수×반응) 톱12를 받아 카드 슬라이드로 노출. 수신 실패 시 샘플 폴백.
// 스크롤 스냅 + 좌우 화살표 — 자동재생은 두지 않는다(파이낸스 그레이드, 시선 방해 방지).

import { useRef } from "react";
import type { TelegramPopular } from "@/lib/telegram";

const MAX_POSTS = 12;

type Post = {
  channel: string; // 채널명
  time: string; // 게시 시각 표기
  title: string; // 게시글 제목
  views: string; // 조회수
  reactions: number; // 이모지 반응 수 (0이면 미표시)
  postUrl: string; // 게시글 링크
};

// KST "M/D HH:MM" — 서버/클라이언트 동일 결과(하이드레이션 안전)
function kstTimeLabel(iso: string): string {
  const k = new Date(new Date(iso).getTime() + 9 * 3600_000);
  return `${k.getUTCMonth() + 1}/${k.getUTCDate()} ${String(k.getUTCHours()).padStart(2, "0")}:${String(
    k.getUTCMinutes()
  ).padStart(2, "0")}`;
}

// 반응 수 컴팩트 표기 (1234 → "1.2K")
function compact(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}

// 샘플 데이터 — 피드 수신 실패/최초 수집 전 폴백
const SAMPLE_POSTS: Post[] = [
  { channel: "우리는 트윗충", time: "2시간 전", title: "비트코인 5.8만달러 지지 확인, 단기 반등 시나리오 점검", views: "12.4K", reactions: 231, postUrl: "https://t.me/twitchoong" },
  { channel: "캔들의 신 관점", time: "5시간 전", title: "USDT 김프 -1.8% 진입, 역프 확대 주의", views: "15.2K", reactions: 468, postUrl: "https://t.me/godofcandle" },
  { channel: "해달의 투자 정보", time: "8시간 전", title: "바이낸스 신규 상장 공지: 신규 토큰 현물 마켓 추가", views: "21.7K", reactions: 152, postUrl: "https://t.me/seaotterbtc" },
];

export default function TelegramChannels({ popular }: { popular?: TelegramPopular | null }) {
  const railRef = useRef<HTMLUListElement>(null);

  // 실데이터(t.me 프리뷰 25채널 랭킹) 우선, 없으면 샘플 폴백
  const live = popular != null && popular.posts.length > 0;
  const posts: Post[] = (live
    ? popular.posts.map((p) => ({
        channel: p.channelName,
        time: kstTimeLabel(p.dateIso),
        title: p.title,
        views: p.views,
        reactions: p.reactions,
        postUrl: p.url,
      }))
    : SAMPLE_POSTS
  ).slice(0, MAX_POSTS);

  const slide = (dir: -1 | 1) => {
    const el = railRef.current;
    if (el) el.scrollBy({ left: dir * (el.clientWidth - 80), behavior: "smooth" });
  };

  return (
    <section className="overflow-hidden rounded-[14px] border border-line bg-white px-5 py-4">
      <header className="flex items-center gap-2">
        <h2 className="text-[15.5px] font-extrabold tracking-[-0.3px] text-navy-900">
          텔레그램 인기 포스팅
        </h2>
        {!live && (
          <span className="rounded-[5px] bg-brand-weak px-1.5 py-0.5 text-[10px] font-bold text-brand-ink">
            샘플
          </span>
        )}
        <span className="text-[10.5px] font-medium text-ink-400">24시간 · 인기순</span>
        <div className="ml-auto flex gap-1">
          <button
            onClick={() => slide(-1)}
            aria-label="이전 포스팅"
            className="grid h-6 w-6 place-items-center rounded-[6px] border border-line text-[11px] text-ink-500 hover:bg-paper2 hover:text-navy-900"
          >
            ‹
          </button>
          <button
            onClick={() => slide(1)}
            aria-label="다음 포스팅"
            className="grid h-6 w-6 place-items-center rounded-[6px] border border-line text-[11px] text-ink-500 hover:bg-paper2 hover:text-navy-900"
          >
            ›
          </button>
        </div>
      </header>

      <ul
        ref={railRef}
        className="mt-3 flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {posts.map((p, i) => (
          <li
            key={p.postUrl}
            className="w-[264px] shrink-0 snap-start rounded-[10px] border border-hairline bg-white px-3.5 py-3 hover:border-line"
          >
            <div className="flex items-baseline gap-1.5 text-[11px] text-ink-400">
              <span
                className={`shrink-0 font-mono font-bold ${i < 3 ? "text-brand-ink" : "text-ink-400"}`}
              >
                {i + 1}
              </span>
              <b className="truncate font-bold text-navy-600">{p.channel}</b>
              <span className="ml-auto shrink-0">{p.time}</span>
            </div>
            <a
              href={p.postUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group mt-1.5 block"
            >
              <span className="line-clamp-2 h-[38px] text-[12.5px] leading-[1.5] text-ink-900 group-hover:underline">
                {p.title}
              </span>
            </a>
            <div className="mt-1.5 font-mono text-[10.5px] font-medium text-ink-400">
              {p.reactions > 0 && <span className="mr-2 text-brand-ink">♥ {compact(p.reactions)}</span>}
              조회 {p.views}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
