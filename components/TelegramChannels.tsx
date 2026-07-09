"use client";

// 한국 텔레그램 인기 포스팅 — 우측 레일 카드(스택 리스트, 2a 파이낸스 그레이드).
// 실데이터: lib/telegram(t.me 공개 프리뷰, 15분 캐시) → feed prop. 수신 실패 시 샘플 폴백.
// t.me/s에는 조회수만 있고 댓글·공유 수가 없어, 실데이터 모드에선 조회수만 표시한다.

import type { TelegramFeed } from "@/lib/telegram";

const CHANNEL_LINK = "https://t.me/kang_tearoom";
const MAX_POSTS = 3;

type Post = {
  channel: string; // 채널명
  time: string; // 게시 시각 표기
  title: string; // 게시글 제목
  excerpt: string; // 본문 미리보기
  views: string; // 조회수
  postUrl: string; // 게시글 링크
};

// KST "M/D HH:MM" — 서버/클라이언트 동일 결과(하이드레이션 안전)
function kstTimeLabel(iso: string): string {
  const k = new Date(new Date(iso).getTime() + 9 * 3600_000);
  return `${k.getUTCMonth() + 1}/${k.getUTCDate()} ${String(k.getUTCHours()).padStart(2, "0")}:${String(
    k.getUTCMinutes()
  ).padStart(2, "0")}`;
}

// 샘플 데이터 — 피드 수신 실패/최초 수집 전 폴백
const SAMPLE_POSTS: Post[] = [
  { channel: "강프로 찻방", time: "2시간 전", title: "비트코인 5.8만달러 지지 확인, 단기 반등 시나리오 점검", excerpt: "거래량 동반 여부가 관건. 이탈 시 5.6만 지지선까지 열어둬야 합니다.", views: "12.4K", postUrl: `${CHANNEL_LINK}/1487` },
  { channel: "김치프리미엄 알림", time: "5시간 전", title: "USDT 김프 -1.8% 진입, 역프 확대 주의", excerpt: "국내 매도 우위 신호. 환율 변동성 확대 구간이라 차익거래 유의.", views: "15.2K", postUrl: `${CHANNEL_LINK}/2231` },
  { channel: "신규상장 速報", time: "8시간 전", title: "바이낸스 신규 상장 공지: 신규 토큰 현물 마켓 추가", excerpt: "상장 직후 변동성 큼. 진입 전 유통량·언락 일정 확인 필수.", views: "21.7K", postUrl: `${CHANNEL_LINK}/3390` },
];

export default function TelegramChannels({ feed }: { feed?: TelegramFeed | null }) {
  // 실데이터(t.me 프리뷰) 우선, 없으면 샘플 폴백
  const live = feed != null && feed.posts.length > 0;
  const posts: Post[] = (live
    ? feed.posts.map((p) => ({
        channel: feed.channelName,
        time: kstTimeLabel(p.dateIso),
        title: p.title,
        excerpt: p.excerpt,
        views: p.views,
        postUrl: p.url,
      }))
    : SAMPLE_POSTS
  ).slice(0, MAX_POSTS);

  return (
    <section className="rounded-[14px] border border-line bg-white px-5 py-[18px]">
      <header className="flex items-baseline gap-2">
        <h2 className="text-[15.5px] font-extrabold tracking-[-0.3px] text-navy-900">
          텔레그램 인기 포스팅
        </h2>
        {!live && (
          <span className="rounded-[5px] bg-brand-weak px-1.5 py-0.5 text-[10px] font-bold text-brand-ink">
            샘플
          </span>
        )}
        <a
          href={CHANNEL_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-xs font-bold text-brand-ink hover:underline"
        >
          더보기 →
        </a>
      </header>

      <ul>
        {posts.map((p, i) => (
          <li
            key={i}
            className="border-b border-hairline py-[9px] first:pt-[11px] last:border-b-0 last:pb-0.5"
          >
            <div className="flex items-baseline gap-2 text-[11.5px] text-ink-400">
              <b className="font-bold text-navy-600">{p.channel}</b>
              {p.time}
              <span className="ml-auto font-mono text-[10.5px] font-medium">조회 {p.views}</span>
            </div>
            <a
              href={p.postUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group mt-[5px] block text-[12.5px] leading-[1.55] text-ink-900"
            >
              <span className="group-hover:underline">{p.title}</span>
              {p.excerpt && <span className="text-ink-500"> — {p.excerpt}</span>}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
