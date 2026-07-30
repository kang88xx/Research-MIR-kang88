// 텔레 봇 & MEME — 큐레이션 고정 목록 (트레이딩 봇 · 밈코인 툴 텔레그램 채널/봇 8종)
// 실시간 수집 대상이 아니라 리서치용 바로가기 타일. 필요 시 여기서 목록만 수정하면 된다.

type Entry = {
  name: string;
  handle: string; // t.me 핸들
  desc: string;
  tag: "BOT" | "MEME";
};

const ENTRIES: Entry[] = [
  { name: "Maestro", handle: "MaestroSniperBot", desc: "멀티체인 스나이핑·트레이딩 봇의 표준", tag: "BOT" },
  { name: "Trojan", handle: "solana_trojanbot", desc: "솔라나 밈코인 트레이딩 봇 — 속도 특화", tag: "BOT" },
  { name: "Banana Gun", handle: "BananaGunSniper_bot", desc: "ETH·SOL 스나이퍼 봇, 신규 상장 대응", tag: "BOT" },
  { name: "BonkBot", handle: "bonkbot_bot", desc: "솔라나 원클릭 매매 봇 — BONK 생태계", tag: "BOT" },
  { name: "GMGN", handle: "GMGN_sol_bot", desc: "밈코인 스마트머니 추적 + 트레이딩", tag: "MEME" },
  { name: "PepeBoost", handle: "pepeboost_sol_bot", desc: "신규 밈코인 알림·매매 봇", tag: "MEME" },
  { name: "SolTradingBot", handle: "SolTradingBot", desc: "솔라나 DEX 트레이딩 봇", tag: "BOT" },
  { name: "Safeguard", handle: "SafeguardRobot", desc: "밈코인 커뮤니티 입장 검증 봇", tag: "MEME" },
];

export default function TelegramBotsMeme() {
  return (
    <section className="overflow-hidden rounded-[6px] border border-line bg-white">
      <header className="title-band flex items-center gap-2 border-b px-5 py-3">
        <h2 className="text-[15.5px] font-extrabold tracking-[-0.3px] text-[#e5e4e2]">
          텔레 봇 &amp; MEME
        </h2>
        <span className="text-[10.5px] font-medium text-[#93a5b2]">큐레이션 · 바로가기</span>
      </header>
      <ul className="grid grid-cols-1 gap-2.5 px-5 pb-4 pt-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {ENTRIES.map((e) => (
          <li
            key={e.handle}
            className="rounded-[5px] border border-hairline bg-white px-3.5 py-3 hover:border-line"
          >
            <div className="flex items-center gap-1.5 text-[11px]">
              <b className="truncate font-bold text-navy-600">{e.name}</b>
              <span
                className={`ml-auto shrink-0 rounded-[3px] px-1 font-mono text-[9px] font-bold ${
                  e.tag === "BOT" ? "bg-brand-weak text-brand-ink" : "bg-paper2 text-ink-500"
                }`}
              >
                {e.tag}
              </span>
            </div>
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
            <div className="mt-1.5 font-mono text-[10.5px] font-medium text-ink-400">
              @{e.handle}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
