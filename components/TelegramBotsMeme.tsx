// 텔레 봇 — 큐레이션 고정 목록 (뉴스·온체인·알림 텔레그램 채널/봇 8종)
// 실시간 수집 대상이 아니라 리서치용 바로가기 타일. 필요 시 여기서 목록만 수정하면 된다.
// active 미지정 항목은 준비중(비활성) — 링크 없이 흐리게만 노출. 확정되면 active: true.
// (2026-08-20 운영자 큐레이션 교체, 현재 8종 전부 활성. 전 핸들 t.me 검증)

type Entry = {
  name: string;
  handle: string; // t.me 핸들
  desc: string;
  tag: "BOT" | "MEME" | "ALPHA";
  active?: boolean; // 미지정(false) = 준비중
};

const ENTRIES: Entry[] = [
  { name: "Walter Bloomberg", handle: "WalterBloomberg", desc: "미 증시·크립토 속보 터미널 뉴스 중계", tag: "BOT", active: true },
  { name: "Onchain Radar", handle: "onchain_radar_eng", desc: "온체인 스마트머니·지갑 추적 알파", tag: "BOT", active: true },
  { name: "Binance Alpha Tracker", handle: "binance_alpha_airdrop", desc: "바이낸스 알파 에어드롭 트래커", tag: "ALPHA", active: true },
  { name: "New Listings Feed", handle: "NewListingsFeed", desc: "거래소 신규 상장 실시간 피드", tag: "BOT", active: true },
  { name: "더따리 김프 알림", handle: "theddari_kimp", desc: "김프 0.5% 변동 알림 (업비트·바이낸스 기준)", tag: "BOT", active: true },
  { name: "BWEnews", handle: "BWEnews", desc: "최속 크립토 속보·알파 뉴스", tag: "BOT", active: true },
  { name: "Yndegen", handle: "Yndegen", desc: "밈코인 디젠 콜 채널", tag: "MEME", active: true },
  { name: "GMGN", handle: "GMGN_sol_bot", desc: "밈코인 스마트머니 추적 + 트레이딩", tag: "MEME", active: true },
];

export default function TelegramBotsMeme() {
  return (
    <section className="overflow-hidden rounded-[6px] border border-line bg-white">
      <header className="title-band flex items-center gap-2 border-b px-5 py-3">
        <h2 className="text-[15.5px] font-extrabold tracking-[-0.3px] text-[#e5e4e2]">텔레 봇</h2>
        <span className="text-[10.5px] font-medium text-[#93a5b2]">큐레이션 · 바로가기</span>
      </header>
      <ul className="grid grid-cols-1 gap-2.5 px-5 pb-4 pt-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {ENTRIES.map((e) => (
          <li
            key={e.handle}
            className={`rounded-[5px] border border-hairline bg-white px-3.5 py-3 ${
              e.active ? "hover:border-line" : "opacity-55"
            }`}
          >
            <div className="flex items-center gap-1.5 text-[11px]">
              <b className="truncate font-bold text-navy-600">{e.name}</b>
              {e.active ? (
                <span
                  className={`ml-auto shrink-0 rounded-[3px] px-1 font-mono text-[9px] font-bold ${
                    e.tag === "BOT"
                      ? "bg-brand-weak text-brand-ink"
                      : e.tag === "ALPHA"
                        ? "bg-info-bg text-info"
                        : "bg-paper2 text-ink-500"
                  }`}
                >
                  {e.tag}
                </span>
              ) : (
                <span className="ml-auto shrink-0 rounded-[3px] bg-paper2 px-1 py-px text-[9px] font-bold text-ink-400">
                  준비중
                </span>
              )}
            </div>
            {e.active ? (
              <a
                href={`https://t.me/${e.handle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group mt-1.5 block"
              >
                <span className="line-clamp-2 h-[38px] text-[12.5px] leading-[1.5] text-ink-900 group-hover:underline">
                  {e.desc}
                </span>
              </a>
            ) : (
              <span className="mt-1.5 line-clamp-2 block h-[38px] text-[12.5px] leading-[1.5] text-ink-500">
                {e.desc}
              </span>
            )}
            <div className="mt-1.5 font-mono text-[10.5px] font-medium text-ink-400">@{e.handle}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
