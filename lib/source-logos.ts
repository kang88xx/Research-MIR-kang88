// 자동 생성됨 — scripts/collect-source-logos.mjs. 직접 수정하지 말 것.
// 출처 URL 호스트 → 플랫폼 로고 파일(public/logos/sources/) 매니페스트. CryptoCalendar '개별 출처'가 참조한다.

export type SourceLogo = { file: string; label: string };

const BY_HOST: Record<string, SourceLogo> = {
  "tokenomist.ai": { file: "tokenomist.png", label: "Tokenomist" },
  "unlocks.app": { file: "tokenomist.png", label: "Tokenomist" },
  "defillama.com": { file: "defillama.png", label: "DefiLlama" },
  "cryptorank.io": { file: "cryptorank.png", label: "CryptoRank" },
  "coindar.org": { file: "coindar.png", label: "Coindar" },
  "dropstab.com": { file: "dropstab.png", label: "DropsTab" },
  "coinglass.com": { file: "coinglass.ico", label: "CoinGlass" },
  "bls.gov": { file: "bls.png", label: "미 노동통계국(BLS)" },
  "bea.gov": { file: "bea.png", label: "미 경제분석국(BEA)" },
  "federalreserve.gov": { file: "fed.png", label: "미 연준(Fed)" },
  "boj.or.jp": { file: "boj.ico", label: "일본은행(BOJ)" },
  "bok.or.kr": { file: "bok.ico", label: "한국은행(BOK)" },
  "ecb.europa.eu": { file: "ecb.png", label: "유럽중앙은행(ECB)" },
  "msci.com": { file: "msci.png", label: "MSCI" },
  "mods.go.kr": { file: "mods.png", label: "통계청" },
  "kostat.go.kr": { file: "mods.png", label: "통계청" },
  "x.com": { file: "x.svg", label: "X" },
  "twitter.com": { file: "x.svg", label: "X" },
  "finance.yahoo.com": { file: "yahoo.png", label: "Yahoo Finance" },
  "yahoo.com": { file: "yahoo.png", label: "Yahoo Finance" },
  "cnbc.com": { file: "cnbc.png", label: "CNBC" },
  "coindesk.com": { file: "coindesk.png", label: "CoinDesk" },
  "cointelegraph.com": { file: "cointelegraph.png", label: "Cointelegraph" },
  "theblock.co": { file: "theblock.png", label: "The Block" },
  "bloomberg.com": { file: "bloomberg.png", label: "Bloomberg" },
  "reuters.com": { file: "reuters.png", label: "Reuters" },
  "globenewswire.com": { file: "globenewswire.png", label: "GlobeNewswire" },
  "chainwire.org": { file: "chainwire.png", label: "Chainwire" },
  "panewslab.com": { file: "panews.png", label: "PANews" },
  "bloomingbit.io": { file: "bloomingbit.png", label: "블루밍비트" },
  "ccn.com": { file: "ccn.png", label: "CCN" },
  "cryptobriefing.com": { file: "cryptobriefing.png", label: "Crypto Briefing" },
  "cryptodaily.co.uk": { file: "cryptodaily.png", label: "Crypto Daily" },
  "macrumors.com": { file: "macrumors.png", label: "MacRumors" },
  "tradingview.com": { file: "tradingview.svg", label: "TradingView" },
  "investing.com": { file: "investing.png", label: "Investing.com" },
  "tipranks.com": { file: "tipranks.png", label: "TipRanks" },
  "tradestation.com": { file: "tradestation.png", label: "TradeStation" },
  "jangjeon.kr": { file: "jangjeon.png", label: "장전" },
  "glasswallet.com": { file: "glasswallet.png", label: "유리지갑" },
  "wikipedia.org": { file: "wikipedia.svg", label: "Wikipedia" },
  "github.com": { file: "github.svg", label: "GitHub" },
  "t.me": { file: "telegram.svg", label: "Telegram" },
  "telegram.org": { file: "telegram.svg", label: "Telegram" },
  "binance.com": { file: "binance.svg", label: "Binance" },
  "coinbase.com": { file: "coinbase.svg", label: "Coinbase" },
  "kucoin.com": { file: "kucoin.svg", label: "KuCoin" },
  "bybit.com": { file: "bybit.png", label: "Bybit" },
  "okx.com": { file: "okx.ico", label: "OKX" },
  "gate.com": { file: "gate.png", label: "Gate" },
  "gate.io": { file: "gate.png", label: "Gate" },
  "bitget.com": { file: "bitget.png", label: "Bitget" },
  "upbit.com": { file: "upbit.png", label: "업비트" },
  "bithumb.com": { file: "bithumb.png", label: "빗썸" },
  "robinhood.com": { file: "robinhood.svg", label: "Robinhood" },
  "strategy.com": { file: "strategy.png", label: "Strategy" },
  "apple.com": { file: "apple.svg", label: "Apple" },
  "nvidia.com": { file: "nvidia.svg", label: "NVIDIA" },
  "oracle.com": { file: "oracle.png", label: "Oracle" },
  "samsung.com": { file: "samsung.svg", label: "Samsung" },
};

// URL의 호스트를 suffix 매칭(서브도메인 포함)해 로고를 찾는다. 없으면 null → UI는 이니셜 뱃지로 폴백.
export function sourceLogoFor(url: string): SourceLogo | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
  const parts = host.split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    const hit = BY_HOST[parts.slice(i).join(".")];
    if (hit) return hit;
  }
  return null;
}
