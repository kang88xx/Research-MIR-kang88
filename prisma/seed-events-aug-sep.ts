import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 2026년 8~9월 이벤트 시드 — 4개 병렬 웹 리서치(매크로·실적·언락·컨퍼런스) 결과 취합 (조사일 2026-07-07).
// 발행 게이트 (docs/data-collection/README.md §1·§5):
//  - dateStatus "confirmed" = 공식 일정표/공식 발표에서 직접 확인 (BLS·BEA·KC연준·BOJ·국가데이터처·회사 고지·공식 문서)
//  - dateStatus "estimated" = 집계 사이트(T2) 기준 추정 — nextCheck(D-7)에 원 소스 재확인 필수
//  - 언락은 2개 이상 소스 교차 확인된 것만 수록 (SUI 대형 월간 언락은 종료 확인 → 제외)
// 시각 저장 규칙: 미국 지표 08:30 ET(EDT) = KST 21:30 = UTC 12:30 → "T12:30:00Z" (기존 6월 시드와 동일).
//  KST 오전 발표(한국 CPI 등)는 기존 금통위 관례대로 시각 생략.
// 실행: npx tsx prisma/seed-events-aug-sep.ts (날짜+티커+제목 존재 시 건너뜀 — 멱등)

type Src = { name: string; url: string; tier: 1 | 2 | 3; isOfficial: boolean };
type Seed = {
  date: string; // "YYYY-MM-DD" 또는 "YYYY-MM-DDTHH:MM:00Z"
  isTba?: boolean;
  ticker: string;
  title: string;
  description: string;
  category: "important" | "good" | "bad" | "neutral";
  groupMain: "크립토" | "주식" | "매크로" | "이벤트";
  groupSub: string;
  dateStatus: "confirmed" | "estimated" | "tba";
  importance: 1 | 2 | 3;
  sources: Src[];
  nextCheck?: string; // "YYYY-MM-DD"
};

const BLS_CPI: Src = { name: "BLS CPI 공식 일정", url: "https://www.bls.gov/schedule/news_release/cpi.htm", tier: 1, isOfficial: true };
const BLS_PPI: Src = { name: "BLS PPI 공식 일정", url: "https://www.bls.gov/schedule/news_release/ppi.htm", tier: 1, isOfficial: true };
const BLS_EMP: Src = { name: "BLS 고용보고서 공식 일정", url: "https://www.bls.gov/schedule/news_release/empsit.htm", tier: 1, isOfficial: true };
const BEA: Src = { name: "BEA 공식 발표 일정", url: "https://www.bea.gov/news/schedule", tier: 1, isOfficial: true };

const EVENTS: Seed[] = [
  // ── 매크로: 미국 지표 (BLS·BEA 공식 일정표 확인 — 08:30 ET = KST 21:30) ──
  { date: "2026-08-07T12:30:00Z", ticker: "US", title: "미국 고용보고서 (7월 비농업 고용)", description: "미 노동통계국(BLS)이 7월 고용보고서(비농업 고용·실업률)를 발표한다. 발표는 한국시간 21시 30분. (출처: BLS 공식 일정)", category: "important", groupMain: "매크로", groupSub: "경제지표", dateStatus: "confirmed", importance: 3, sources: [BLS_EMP] },
  { date: "2026-08-12T12:30:00Z", ticker: "US", title: "미국 소비자물가지수(CPI) (7월분)", description: "미 노동통계국(BLS)이 7월 소비자물가지수를 발표한다. 연준 금리 경로의 핵심 지표. 발표는 한국시간 21시 30분. (출처: BLS 공식 일정)", category: "important", groupMain: "매크로", groupSub: "경제지표", dateStatus: "confirmed", importance: 3, sources: [BLS_CPI] },
  { date: "2026-08-13T12:30:00Z", ticker: "US", title: "미국 생산자물가지수(PPI) (7월분)", description: "미 노동통계국(BLS)이 7월 생산자물가지수를 발표한다. 발표는 한국시간 21시 30분. (출처: BLS 공식 일정)", category: "important", groupMain: "매크로", groupSub: "경제지표", dateStatus: "confirmed", importance: 2, sources: [BLS_PPI] },
  { date: "2026-08-26T12:30:00Z", ticker: "US", title: "미국 개인소비지출(PCE) (7월분)", description: "미 경제분석국(BEA)이 연준이 선호하는 물가지표인 7월 PCE를 발표한다. 발표는 한국시간 21시 30분. (출처: BEA 공식 일정)", category: "important", groupMain: "매크로", groupSub: "경제지표", dateStatus: "confirmed", importance: 3, sources: [BEA] },
  { date: "2026-09-04T12:30:00Z", ticker: "US", title: "미국 고용보고서 (8월 비농업 고용)", description: "미 노동통계국(BLS)이 8월 고용보고서(비농업 고용·실업률)를 발표한다. 9월 FOMC 직전 핵심 지표. 발표는 한국시간 21시 30분. (출처: BLS 공식 일정)", category: "important", groupMain: "매크로", groupSub: "경제지표", dateStatus: "confirmed", importance: 3, sources: [BLS_EMP] },
  { date: "2026-09-10T12:30:00Z", ticker: "US", title: "미국 생산자물가지수(PPI) (8월분)", description: "미 노동통계국(BLS)이 8월 생산자물가지수를 발표한다. 발표는 한국시간 21시 30분. (출처: BLS 공식 일정)", category: "important", groupMain: "매크로", groupSub: "경제지표", dateStatus: "confirmed", importance: 2, sources: [BLS_PPI] },
  { date: "2026-09-11T12:30:00Z", ticker: "US", title: "미국 소비자물가지수(CPI) (8월분)", description: "미 노동통계국(BLS)이 8월 소비자물가지수를 발표한다. 9월 FOMC(15~16일) 직전 마지막 물가 확인. 발표는 한국시간 21시 30분. (출처: BLS 공식 일정)", category: "important", groupMain: "매크로", groupSub: "경제지표", dateStatus: "confirmed", importance: 3, sources: [BLS_CPI] },
  { date: "2026-09-30T12:30:00Z", ticker: "US", title: "미국 개인소비지출(PCE) (8월분)", description: "미 경제분석국(BEA)이 8월 PCE 물가를 발표한다. 발표는 한국시간 21시 30분. (출처: BEA 공식 일정)", category: "important", groupMain: "매크로", groupSub: "경제지표", dateStatus: "confirmed", importance: 3, sources: [BEA] },

  // ── 매크로: 잭슨홀·BOJ·한국 CPI ──
  { date: "2026-08-27", ticker: "US", title: "잭슨홀 심포지엄 (8/27~29)", description: "캔자스시티 연은 주최 잭슨홀 경제정책 심포지엄. 올해 주제는 '금융 혁신: 결제와 정책에 대한 함의'로 연준 의장 연설이 시장 변곡점이 되어 왔다. (출처: 캔자스시티 연은)", category: "important", groupMain: "매크로", groupSub: "금리결정", dateStatus: "confirmed", importance: 3, sources: [{ name: "캔자스시티 연은 공식", url: "https://www.kansascityfed.org/research/jackson-hole-economic-symposium/", tier: 1, isOfficial: true }] },
  { date: "2026-09-18", ticker: "JP", title: "일본은행(BOJ) 금리 결정", description: "일본은행이 9월 금융정책결정회의(17~18일)를 마치고 기준금리를 발표한다. 엔 캐리 트레이드 경로에 영향. (출처: 일본은행 공식 일정)", category: "important", groupMain: "매크로", groupSub: "금리결정", dateStatus: "confirmed", importance: 3, sources: [{ name: "일본은행 MPM 일정", url: "https://www.boj.or.jp/en/mopo/mpmsche_minu/index.htm", tier: 1, isOfficial: true }] },
  { date: "2026-08-04", ticker: "KR", title: "한국 소비자물가동향 (7월분)", description: "국가데이터처가 7월 소비자물가동향을 발표한다(통상 오전 8시). (출처: 국가데이터처 공표일정)", category: "important", groupMain: "매크로", groupSub: "경제지표", dateStatus: "confirmed", importance: 2, sources: [{ name: "국가데이터처 공표일정", url: "https://mods.go.kr/menu.es?mid=b70203020000", tier: 1, isOfficial: true }] },
  { date: "2026-09-02", ticker: "KR", title: "한국 소비자물가동향 (8월분)", description: "국가데이터처가 8월 소비자물가동향을 발표한다(통상 오전 8시). (출처: 국가데이터처 공표일정)", category: "important", groupMain: "매크로", groupSub: "경제지표", dateStatus: "confirmed", importance: 2, sources: [{ name: "국가데이터처 공표일정", url: "https://mods.go.kr/menu.es?mid=b70203020000", tier: 1, isOfficial: true }] },

  // ── 주식: 실적 (NVDA만 회사 고지 확정, 나머지는 집계 사이트 추정 → D-7 재확인) ──
  { date: "2026-08-26", ticker: "NVDA", title: "엔비디아 실적 발표", description: "엔비디아가 FY2027 2분기 실적을 발표한다(장 마감 후). 직전 실적발표에서 회사가 직접 고지한 확정 일정. (출처: 엔비디아 IR·CNBC)", category: "important", groupMain: "주식", groupSub: "실적·발표", dateStatus: "confirmed", importance: 3, sources: [{ name: "엔비디아 IR", url: "https://investor.nvidia.com/", tier: 1, isOfficial: true }, { name: "CNBC", url: "https://www.cnbc.com/2026/05/20/nvidia-nvda-earnings-report-q1-2027.html", tier: 2, isOfficial: false }] },
  { date: "2026-08-04", ticker: "MSTR", title: "스트래티지(MSTR) 실적 발표", description: "비트코인 트레저리 기업 스트래티지의 2분기 실적 발표 추정일(장 마감 후). 회사 공식 확정 전 — 7월 말 재확인 필요. (출처: TipRanks)", category: "important", groupMain: "주식", groupSub: "실적·발표", dateStatus: "estimated", importance: 2, sources: [{ name: "TipRanks", url: "https://www.tipranks.com/stocks/mstr/earnings", tier: 2, isOfficial: false }], nextCheck: "2026-07-28" },
  { date: "2026-08-04", ticker: "AMD", title: "AMD 실적 발표", description: "AMD의 2분기 실적 발표 추정일(장 마감 후). 회사 IR 캘린더에 아직 공식 미게시. (출처: Investing.com)", category: "important", groupMain: "주식", groupSub: "실적·발표", dateStatus: "estimated", importance: 2, sources: [{ name: "Investing.com", url: "https://www.investing.com/equities/adv-micro-device-earnings", tier: 2, isOfficial: false }, { name: "AMD IR", url: "https://ir.amd.com/news-events/ir-calendar", tier: 1, isOfficial: true }], nextCheck: "2026-07-28" },
  { date: "2026-08-10", ticker: "PLTR", title: "팔란티어 실적 발표", description: "팔란티어의 2분기 실적 발표 추정일(장 마감 후). 집계 사이트 간 8/3 설도 있어 재확인 필요. (출처: TipRanks)", category: "important", groupMain: "주식", groupSub: "실적·발표", dateStatus: "estimated", importance: 2, sources: [{ name: "TipRanks", url: "https://www.tipranks.com/stocks/pltr/earnings", tier: 2, isOfficial: false }], nextCheck: "2026-07-28" },
  { date: "2026-09-03", ticker: "AVGO", title: "브로드컴 실적 발표", description: "브로드컴의 FY2026 3분기 실적 발표 추정일(장 마감 후). AI 반도체 수요의 가늠자. (출처: Investing.com)", category: "important", groupMain: "주식", groupSub: "실적·발표", dateStatus: "estimated", importance: 2, sources: [{ name: "Investing.com", url: "https://www.investing.com/equities/avago-technologies-earnings", tier: 2, isOfficial: false }], nextCheck: "2026-08-27" },
  { date: "2026-09-10", ticker: "ADBE", title: "어도비 실적 발표", description: "어도비의 FY2026 3분기 실적 발표 추정일(장 마감 후). (출처: Investing.com)", category: "important", groupMain: "주식", groupSub: "실적·발표", dateStatus: "estimated", importance: 1, sources: [{ name: "Investing.com", url: "https://www.investing.com/equities/adobe-sys-inc-earnings", tier: 2, isOfficial: false }], nextCheck: "2026-09-03" },
  { date: "2026-09-14", ticker: "ORCL", title: "오라클 실적 발표", description: "오라클의 FY2027 1분기 실적 발표 추정일(장 마감 후). 통상 발표 1주 전에야 공식 고지. (출처: TipRanks)", category: "important", groupMain: "주식", groupSub: "실적·발표", dateStatus: "estimated", importance: 2, sources: [{ name: "TipRanks", url: "https://www.tipranks.com/stocks/orcl/earnings", tier: 2, isOfficial: false }], nextCheck: "2026-09-07" },
  { date: "2026-09-29", ticker: "MU", title: "마이크론 실적 발표", description: "마이크론의 FY2026 4분기 실적 발표 추정일(장 마감 후). 집계 사이트 간 9/23 설과 상충 — 재확인 필요. (출처: TipRanks)", category: "important", groupMain: "주식", groupSub: "실적·발표", dateStatus: "estimated", importance: 2, sources: [{ name: "TipRanks", url: "https://www.tipranks.com/stocks/mu/earnings", tier: 2, isOfficial: false }], nextCheck: "2026-09-15" },
  { date: "2026-09-09", ticker: "AAPL", title: "애플 가을 이벤트 (아이폰 18 공개 예상)", description: "애플의 가을 신제품 이벤트 추정일. 아이폰 18 프로와 첫 폴더블 아이폰 공개가 예상된다. 공식 초청장은 통상 8월 말 발송 — 미발표 상태. (출처: Apple Events)", category: "good", groupMain: "주식", groupSub: "제품·출시", dateStatus: "estimated", importance: 2, sources: [{ name: "Apple Events", url: "https://www.apple.com/apple-events/", tier: 1, isOfficial: false }, { name: "MacRumors", url: "https://www.macrumors.com/guide/apple-event/", tier: 3, isOfficial: false }], nextCheck: "2026-09-01" },

  // ── 크립토: 언락 (2소스 교차 확인분만 — D-7 재확인 필수) ──
  { date: "2026-08-05", ticker: "PROVE", title: "석싱트(PROVE) 대형 클리프 언락", description: "석싱트가 기여자 물량 2억 333만 PROVE를 언락한다 — 현 유통량의 약 104%에 달하는 대형 클리프. (출처: Tokenomist·KuCoin)", category: "bad", groupMain: "크립토", groupSub: "언락", dateStatus: "confirmed", importance: 2, sources: [{ name: "Tokenomist", url: "https://www.tokenomist.ai/succinct/unlock-events", tier: 2, isOfficial: false }, { name: "KuCoin 블로그", url: "https://www.kucoin.com/blog/what-cryptocurrency-projects-will-have-large-scale-unlocks", tier: 2, isOfficial: false }], nextCheck: "2026-07-29" },
  { date: "2026-08-06", ticker: "HYPE", title: "하이퍼리퀴드 코어 기여자 월간 언락", description: "하이퍼리퀴드 코어 기여자 물량 월간 언락. 직전 회차 기준 회당 약 6억 달러 규모로 8월에도 유사 규모가 예상된다. (출처: Tokenomist)", category: "bad", groupMain: "크립토", groupSub: "언락", dateStatus: "confirmed", importance: 2, sources: [{ name: "Tokenomist", url: "https://tokenomist.ai/hyperliquid/unlock-events", tier: 2, isOfficial: false }, { name: "DEXTools", url: "https://www.dextools.io/news/hyperliquid-hype-token-unlock-565-million-june-2026", tier: 3, isOfficial: false }], nextCheck: "2026-07-30" },
  { date: "2026-08-11", ticker: "APT", title: "앱토스(APT) 월간 언락", description: "앱토스가 월간 정기 언락으로 1,131만 APT(총공급의 0.54%)를 해제한다. 월간 언락 종료(9~10월)를 앞둔 막바지 구간. (출처: Tokenomist·CCN)", category: "bad", groupMain: "크립토", groupSub: "언락", dateStatus: "estimated", importance: 1, sources: [{ name: "Tokenomist", url: "https://tokenomist.ai/aptos/unlock-events", tier: 2, isOfficial: false }, { name: "CCN", url: "https://www.ccn.com/analysis/crypto/aptos-faces-token-unlock-apt-price-recovery/", tier: 3, isOfficial: false }], nextCheck: "2026-08-04" },
  { date: "2026-08-13", ticker: "IP", title: "스토리 프로토콜(IP) 락업 해제 재개", description: "2월에서 6개월 연기됐던 스토리 프로토콜 팀·투자자·초기 기여자 물량 언락이 재개된다. 연기 전력이 있어 일정 재확인 필수. (출처: 공식 발표·CoinDesk)", category: "bad", groupMain: "크립토", groupSub: "언락", dateStatus: "confirmed", importance: 2, sources: [{ name: "Story 공식 발표 (Chainwire)", url: "https://chainwire.org/2026/02/02/story-updates-ip-unlock-schedule-as-the-network-evolves-toward-ai-driven-use-cases/", tier: 1, isOfficial: true }, { name: "CoinDesk", url: "https://www.coindesk.com/markets/2026/02/02/story-delays-usdip-token-unlock-by-6-months-as-supply-overhang-fears-mount-and-usage-remains-thin", tier: 2, isOfficial: false }], nextCheck: "2026-08-06" },
  { date: "2026-08-16", ticker: "ARB", title: "아비트럼(ARB) 월간 언락", description: "아비트럼이 월간 정기 언락으로 9,265만 ARB(유통량의 약 1.8%)를 해제한다. 2027년 3월까지 지속되는 정기 물량. (출처: CoinMarketCal·Gate)", category: "bad", groupMain: "크립토", groupSub: "언락", dateStatus: "confirmed", importance: 2, sources: [{ name: "CoinMarketCal", url: "https://coinmarketcal.com/en/event/92-65mm-token-unlock-311726", tier: 2, isOfficial: false }, { name: "Gate 언락 캘린더", url: "https://www.gate.com/crypto-calendar/token-unlock", tier: 2, isOfficial: false }], nextCheck: "2026-08-09" },
  { date: "2026-08-16", ticker: "YZY", title: "이지(YZY) 클리프 언락", description: "칸예 웨스트의 YZY 토큰이 Yeezy Investments 트랜치 약 1억 2,080만 개(기존 유통 대비 22.8%)를 언락한다. (출처: Tokenomist·KuCoin)", category: "bad", groupMain: "크립토", groupSub: "언락", dateStatus: "confirmed", importance: 1, sources: [{ name: "Tokenomist", url: "https://tokenomist.ai/yzy", tier: 2, isOfficial: false }, { name: "KuCoin 블로그", url: "https://www.kucoin.com/blog/what-cryptocurrency-projects-will-have-large-scale-unlocks", tier: 2, isOfficial: false }], nextCheck: "2026-08-09" },
  { date: "2026-09-11", ticker: "APT", title: "앱토스(APT) 월간 언락", description: "앱토스 월간 정기 언락 1,131만 APT(총공급의 0.54%) — 월간 리니어 언락의 사실상 마지막 회차. (출처: Tokenomist·CCN)", category: "bad", groupMain: "크립토", groupSub: "언락", dateStatus: "estimated", importance: 1, sources: [{ name: "Tokenomist", url: "https://tokenomist.ai/aptos/unlock-events", tier: 2, isOfficial: false }, { name: "CCN", url: "https://www.ccn.com/analysis/crypto/aptos-faces-token-unlock-apt-price-recovery/", tier: 3, isOfficial: false }], nextCheck: "2026-09-04" },
  { date: "2026-09-16", ticker: "ARB", title: "아비트럼(ARB) 월간 언락", description: "아비트럼 월간 정기 언락 9,265만 ARB(유통량의 약 1.8%). (출처: Gate·Coincub)", category: "bad", groupMain: "크립토", groupSub: "언락", dateStatus: "confirmed", importance: 2, sources: [{ name: "Gate 언락 캘린더", url: "https://www.gate.com/crypto-calendar/token-unlock", tier: 2, isOfficial: false }, { name: "Coincub", url: "https://coincub.com/arbitrum-price-prediction/", tier: 3, isOfficial: false }], nextCheck: "2026-09-09" },
  { date: "2026-09-17", ticker: "ASTER", title: "애스터(ASTER) 팀 물량 베스팅 개시", description: "TGE 1주년을 맞아 팀 물량 4억 ASTER의 12개월 클리프가 종료되고 40개월 선형 베스팅이 시작된다 — 팀 물량의 첫 유통 진입. (출처: Coin Bureau 외)", category: "bad", groupMain: "크립토", groupSub: "언락", dateStatus: "confirmed", importance: 2, sources: [{ name: "Coin Bureau", url: "https://coinbureau.com/review/what-is-aster-crypto", tier: 3, isOfficial: false }, { name: "CryptoDaily", url: "https://cryptodaily.co.uk/2026/06/aster-june-9-unlock-depth", tier: 3, isOfficial: false }], nextCheck: "2026-09-10" },
  { date: "2026-09-25", ticker: "XPL", title: "플라즈마(XPL) 대형 클리프 언락", description: "플라즈마가 1년 클리프 종료로 팀·투자자 물량 약 16.7억 XPL(총공급의 약 16.7%)을 언락한다 — 8~9월 중 최대 규모. (출처: Plasma 공식 문서·Bitget)", category: "bad", groupMain: "크립토", groupSub: "언락", dateStatus: "confirmed", importance: 2, sources: [{ name: "Plasma 공식 토크노믹스", url: "https://www.plasma.org/docs/get-started/xpl/tokenomics", tier: 1, isOfficial: true }, { name: "Bitget Academy", url: "https://web3.bitget.com/en/academy/plasma-xpl-token-unlock-schedule-key-dates-vesting-periods-and-price-impact", tier: 2, isOfficial: false }], nextCheck: "2026-09-18" },

  // ── 크립토: 프로젝트·컨퍼런스 / 이벤트 ──
  { date: "2026-08-01", isTba: true, ticker: "ETH", title: "이더리움 글램스터담 업그레이드 (8월 목표)", description: "이더리움의 차기 하드포크 글램스터담(ePBS·BAL 도입)이 8월 말을 목표로 최종 데브넷 단계에 있다. 메인넷 확정일은 미발표 — TBA. (출처: ethereum.org 로드맵)", category: "good", groupMain: "크립토", groupSub: "프로젝트", dateStatus: "tba", importance: 2, sources: [{ name: "ethereum.org 로드맵", url: "https://ethereum.org/roadmap/glamsterdam/", tier: 1, isOfficial: true }, { name: "CryptoTimes", url: "https://www.cryptotimes.io/2026/06/05/ethereum-sets-stage-for-glamsterdam-hard-fork-in-q3-2026/", tier: 3, isOfficial: false }], nextCheck: "2026-08-01" },
  { date: "2026-09-29", ticker: "KBW", title: "코리아 블록체인 위크 2026 (9/29~10/1)", description: "아시아 최대급 블록체인 행사 KBW 2026이 서울 워커힐에서 열린다. 9/29 업비트 기관 서밋을 시작으로 메인 컨퍼런스는 9/30~10/1. (출처: KBW 공식)", category: "good", groupMain: "크립토", groupSub: "컨퍼런스", dateStatus: "confirmed", importance: 2, sources: [{ name: "KBW 공식", url: "https://koreablockchainweek.com/", tier: 1, isOfficial: true }, { name: "PRNewswire", url: "https://www.prnewswire.com/news-releases/kbw-2026-returns-to-seoul-september-29october-1-upbit-joins-as-main-sponsor-302660025.html", tier: 2, isOfficial: false }] },
  { date: "2026-10-07", ticker: "T2049", title: "토큰2049 싱가포르 (10/7~8)", description: "글로벌 최대급 크립토 컨퍼런스 토큰2049가 싱가포르 마리나 베이 샌즈에서 열린다. (출처: TOKEN2049 공식)", category: "good", groupMain: "크립토", groupSub: "컨퍼런스", dateStatus: "confirmed", importance: 2, sources: [{ name: "TOKEN2049 공식", url: "https://www.token2049.com/singapore", tier: 1, isOfficial: true }] },
  { date: "2026-09-19", ticker: "ASIAD", title: "아이치·나고야 아시안게임 개막 (9/19~10/4)", description: "제20회 아시안게임이 일본 아이치·나고야에서 개막한다. 대회 기간은 10월 4일까지. (출처: 조직위 공식)", category: "good", groupMain: "이벤트", groupSub: "스포츠", dateStatus: "confirmed", importance: 1, sources: [{ name: "아이치·나고야 2026 공식", url: "https://www.aichi-nagoya2026.org/en/", tier: 1, isOfficial: true }] },
];

async function main() {
  let created = 0;
  for (const e of EVENTS) {
    const date = new Date(e.date.includes("T") ? e.date : `${e.date}T00:00:00Z`);
    const exists = await prisma.calendarEvent.findFirst({
      where: {
        ticker: e.ticker,
        title: e.title,
        date: {
          gte: new Date(date.getTime() - 3 * 86400_000), // ±3일 윈도우 — 날짜 변동 이벤트 중복 방지
          lte: new Date(date.getTime() + 3 * 86400_000),
        },
      },
      select: { id: true },
    });
    if (exists) {
      console.log(`skip (이미 존재): ${e.date} ${e.ticker} ${e.title}`);
      continue;
    }
    await prisma.calendarEvent.create({
      data: {
        date,
        isTba: e.isTba ?? false,
        ticker: e.ticker,
        title: e.title,
        description: e.description,
        category: e.category,
        groupMain: e.groupMain,
        groupSub: e.groupSub,
        sourceUrl: e.sources[0]?.url ?? null,
        dateStatus: e.dateStatus,
        importance: e.importance,
        sources: e.sources,
        reviewStatus: "published",
        nextCheck: e.nextCheck ? new Date(`${e.nextCheck}T00:00:00Z`) : null,
      },
    });
    created++;
    console.log(`created: ${e.date.slice(0, 10)} ${e.ticker} ${e.title} [${e.dateStatus}]`);
  }
  console.log(`완료 — 신규 ${created}건 / 전체 ${EVENTS.length}건`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
