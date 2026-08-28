// 출처(플랫폼) 로고 수집 — 캘린더 '개별 출처'에 티어 코드 대신 플랫폼 로고를 보여주기 위한 자산.
//   node scripts/collect-source-logos.mjs
// 자주 나오는 플랫폼을 SOURCES에 등록해 두면 항상 같은 파일이 적용된다.
//  1) Simple Icons(공식 브랜드 SVG, CC0) → public/logos/sources/<key>.svg
//  2) 없으면 Google favicon(64px PNG) → <key>.png (구글 기본 지구본 아이콘은 크기로 걸러냄)
//  3) 그래도 없으면 사이트 /favicon.ico 직접 시도
// 결과 매니페스트: lib/source-logos.ts (호스트 → 파일). 새 플랫폼이 자주 보이면 여기 추가 후 재실행.
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "public/logos/sources");

// key: 파일명 / hosts: 매칭 호스트(서브도메인 포함 suffix 매칭) / label: 툴팁용 표시명
// simple: Simple Icons 슬러그 / domain: favicon 조회 도메인(기본 hosts[0])
const SOURCES = [
  // 언락·토크노믹스
  { key: "tokenomist", hosts: ["tokenomist.ai", "unlocks.app"], label: "Tokenomist" },
  { key: "defillama", hosts: ["defillama.com"], label: "DefiLlama" },
  { key: "cryptorank", hosts: ["cryptorank.io"], label: "CryptoRank" },
  { key: "coindar", hosts: ["coindar.org"], label: "Coindar" },
  { key: "dropstab", hosts: ["dropstab.com"], label: "DropsTab" },
  { key: "coinglass", hosts: ["coinglass.com"], label: "CoinGlass" },
  { key: "messari", hosts: ["messari.io"], label: "Messari" },
  // 공식 기관
  { key: "bls", hosts: ["bls.gov"], label: "미 노동통계국(BLS)" },
  { key: "bea", hosts: ["bea.gov"], label: "미 경제분석국(BEA)" },
  { key: "fed", hosts: ["federalreserve.gov"], label: "미 연준(Fed)" },
  { key: "boj", hosts: ["boj.or.jp"], label: "일본은행(BOJ)", domain: "www.boj.or.jp" },
  { key: "bok", hosts: ["bok.or.kr"], label: "한국은행(BOK)", domain: "www.bok.or.kr" },
  { key: "ecb", hosts: ["ecb.europa.eu"], label: "유럽중앙은행(ECB)" },
  { key: "msci", hosts: ["msci.com"], label: "MSCI" },
  { key: "mods", hosts: ["mods.go.kr", "kostat.go.kr"], label: "통계청" },
  // 뉴스·미디어
  { key: "x", hosts: ["x.com", "twitter.com"], label: "X", simple: "x" },
  { key: "yahoo", hosts: ["finance.yahoo.com", "yahoo.com"], label: "Yahoo Finance" },
  { key: "cnbc", hosts: ["cnbc.com"], label: "CNBC" },
  { key: "coindesk", hosts: ["coindesk.com"], label: "CoinDesk" },
  { key: "cointelegraph", hosts: ["cointelegraph.com"], label: "Cointelegraph" },
  { key: "theblock", hosts: ["theblock.co"], label: "The Block" },
  { key: "bloomberg", hosts: ["bloomberg.com"], label: "Bloomberg" },
  { key: "reuters", hosts: ["reuters.com"], label: "Reuters" },
  { key: "globenewswire", hosts: ["globenewswire.com"], label: "GlobeNewswire" },
  { key: "prnewswire", hosts: ["prnewswire.com"], label: "PR Newswire" },
  { key: "chainwire", hosts: ["chainwire.org"], label: "Chainwire" },
  { key: "panews", hosts: ["panewslab.com"], label: "PANews" },
  { key: "bloomingbit", hosts: ["bloomingbit.io"], label: "블루밍비트" },
  { key: "ccn", hosts: ["ccn.com"], label: "CCN" },
  { key: "cryptobriefing", hosts: ["cryptobriefing.com"], label: "Crypto Briefing" },
  { key: "cryptodaily", hosts: ["cryptodaily.co.uk"], label: "Crypto Daily" },
  { key: "macrumors", hosts: ["macrumors.com"], label: "MacRumors" },
  { key: "tradingview", hosts: ["tradingview.com"], label: "TradingView", simple: "tradingview" },
  { key: "investing", hosts: ["investing.com"], label: "Investing.com" },
  { key: "tipranks", hosts: ["tipranks.com"], label: "TipRanks" },
  { key: "tradestation", hosts: ["tradestation.com"], label: "TradeStation" },
  { key: "jangjeon", hosts: ["jangjeon.kr"], label: "장전" },
  { key: "glasswallet", hosts: ["glasswallet.com"], label: "유리지갑" },
  { key: "wikipedia", hosts: ["wikipedia.org"], label: "Wikipedia", simple: "wikipedia" },
  { key: "github", hosts: ["github.com"], label: "GitHub", simple: "github" },
  { key: "telegram", hosts: ["t.me", "telegram.org"], label: "Telegram", simple: "telegram" },
  // 거래소·기업
  { key: "binance", hosts: ["binance.com"], label: "Binance", simple: "binance" },
  { key: "coinbase", hosts: ["coinbase.com"], label: "Coinbase", simple: "coinbase" },
  { key: "kucoin", hosts: ["kucoin.com"], label: "KuCoin", simple: "kucoin" },
  { key: "bybit", hosts: ["bybit.com"], label: "Bybit" },
  { key: "okx", hosts: ["okx.com"], label: "OKX" },
  { key: "gate", hosts: ["gate.com", "gate.io"], label: "Gate" },
  { key: "mexc", hosts: ["mexc.com"], label: "MEXC" },
  { key: "bitget", hosts: ["bitget.com"], label: "Bitget" },
  { key: "upbit", hosts: ["upbit.com"], label: "업비트" },
  { key: "bithumb", hosts: ["bithumb.com"], label: "빗썸" },
  { key: "deribit", hosts: ["deribit.com"], label: "Deribit" },
  { key: "robinhood", hosts: ["robinhood.com"], label: "Robinhood", simple: "robinhood" },
  { key: "strategy", hosts: ["strategy.com"], label: "Strategy" },
  { key: "apple", hosts: ["apple.com"], label: "Apple", simple: "apple" },
  { key: "nvidia", hosts: ["nvidia.com"], label: "NVIDIA", simple: "nvidia" },
  { key: "oracle", hosts: ["oracle.com"], label: "Oracle" },
  { key: "samsung", hosts: ["samsung.com"], label: "Samsung", simple: "samsung" },
];

// 구글 favicon 서비스는 아이콘이 없으면 기본 지구본(약 300B 대)을 200으로 돌려준다 → 크기로 판별
const GOOGLE_DEFAULT_MAX_BYTES = 450;

async function fetchBytes(url, accept) {
  try {
    const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0", Accept: accept } });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    // HTML/텍스트 응답(오류 페이지·SPA 셸)은 이미지가 아니다 — SVG(<svg / <?xml)만 마크업 허용
    if (buf.length === 0) return null;
    if (buf[0] === 0x3c /* < */ && !/^\s*(<\?xml|<svg)/.test(buf.toString("utf8", 0, 300))) return null;
    return buf;
  } catch {
    return null;
  }
}

async function collect(src) {
  if (src.simple) {
    const svg = await fetchBytes(`https://cdn.simpleicons.org/${src.simple}`, "image/svg+xml");
    if (svg && svg.length > 100 && svg.toString("utf8", 0, 200).includes("<svg")) {
      await writeFile(path.join(OUT_DIR, `${src.key}.svg`), svg);
      return `${src.key}.svg`;
    }
  }
  const domain = src.domain ?? src.hosts[0];
  const g = await fetchBytes(`https://www.google.com/s2/favicons?domain=${domain}&sz=64`, "image/*");
  if (g && g.length > GOOGLE_DEFAULT_MAX_BYTES) {
    await writeFile(path.join(OUT_DIR, `${src.key}.png`), g);
    return `${src.key}.png`;
  }
  for (const u of [`https://${domain}/favicon.ico`, `https://www.${domain}/favicon.ico`]) {
    const ico = await fetchBytes(u, "image/*");
    if (ico && ico.length > 200) {
      await writeFile(path.join(OUT_DIR, `${src.key}.ico`), ico);
      return `${src.key}.ico`;
    }
  }
  return null;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const entries = [];
  for (const src of SOURCES) {
    const file = await collect(src);
    console.log(file ? `✓ ${src.key} → ${file}` : `✗ ${src.key} (로고 없음 — 이니셜 폴백)`);
    if (file) entries.push({ hosts: src.hosts, file, label: src.label });
  }
  const lines = [
    "// 자동 생성됨 — scripts/collect-source-logos.mjs. 직접 수정하지 말 것.",
    "// 출처 URL 호스트 → 플랫폼 로고 파일(public/logos/sources/) 매니페스트. CryptoCalendar '개별 출처'가 참조한다.",
    "",
    "export type SourceLogo = { file: string; label: string };",
    "",
    "const BY_HOST: Record<string, SourceLogo> = {",
    ...entries.flatMap((e) =>
      e.hosts.map((h) => `  ${JSON.stringify(h)}: { file: ${JSON.stringify(e.file)}, label: ${JSON.stringify(e.label)} },`)
    ),
    "};",
    "",
    "// URL의 호스트를 suffix 매칭(서브도메인 포함)해 로고를 찾는다. 없으면 null → UI는 이니셜 뱃지로 폴백.",
    "export function sourceLogoFor(url: string): SourceLogo | null {",
    "  let host: string;",
    "  try {",
    '    host = new URL(url).hostname.toLowerCase().replace(/^www\\./, "");',
    "  } catch {",
    "    return null;",
    "  }",
    '  const parts = host.split(".");',
    "  for (let i = 0; i < parts.length - 1; i++) {",
    '    const hit = BY_HOST[parts.slice(i).join(".")];',
    "    if (hit) return hit;",
    "  }",
    "  return null;",
    "}",
    "",
  ];
  await writeFile(path.join(ROOT, "lib/source-logos.ts"), lines.join("\n"));
  console.log(`\n매니페스트 갱신: lib/source-logos.ts (${entries.length}/${SOURCES.length})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
