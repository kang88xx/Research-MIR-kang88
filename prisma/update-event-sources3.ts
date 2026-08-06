import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

// 3차 출처 교체 — LAYER.GG(@layerggofficial) 트위터 출처 전량 제거 (작업일: 2026-08-06)
// 1) RESEARCHED: 리서치로 확보한 공식(또는 주요 언론) 출처로 sourceUrl·sources·description 교체
// 2) 전 이벤트 공통: sources 배열의 layergg 항목 제거 + description 내 LAYER.GG 문구 제거
// 실행: npx tsx prisma/update-event-sources3.ts (재실행 안전 — 멱등)

type Researched = {
  id: number;
  ticker: string;
  sourceName: string;
  sourceUrl: string;
  tier: 1 | 2 | 3;
  isOfficial: boolean;
  dateStatus?: string; // confirmed | estimated
  correctedDate?: string; // YYYY-MM-DD
  description: string;
};

// ── 리서치 결과 (에이전트 4개 병렬 조사, 조사일 2026-08-06) ──
const RESEARCHED: Researched[] = [
  // ─── 8/1 ~ 8/6 ───
  { id: 158, ticker: "GOOG", sourceName: "구글 크롬 개발자 공식 블로그", sourceUrl: "https://developer.chrome.com/blog/cws-policy-updates-2026", tier: 1, isOfficial: true, dateStatus: "confirmed", description: "구글이 크롬 웹스토어 개발자 정책 업데이트의 집행을 8월 1일 시작한다. 암호화폐 채굴 확장 프로그램 금지 정책과 함께 실물 자금 예측시장 거래 확장 프로그램 금지, 데이터 수집 제한 등 크립토 관련 제한이 강화됐다. (구글 크롬 개발자 공식 블로그)" },
  { id: 159, ticker: "SWARMS", sourceName: "스웜스 공식 X (@swarms_corp)", sourceUrl: "https://x.com/swarms_corp", tier: 1, isOfficial: true, dateStatus: "estimated", description: "스웜스가 공식 X를 통해 초저지연·고성능 최적화와 신규 멀티에이전트 하네스에 초점을 둔 V14 'ZENA' 업데이트를 예고했다. 구체적인 출시일은 공식 확정 발표가 확인되지 않았다. (스웜스 공식 X)" },
  { id: 160, ticker: "SEMCO", sourceName: "뉴시스", sourceUrl: "https://www.newsis.com/view/NISX20260729_0003728542", tier: 2, isOfficial: false, dateStatus: "estimated", description: "삼성전기가 8월 1일 출하분부터 MLCC 전 품목 공급가를 30% 인상한다고 주요 고객사에 통보했다. AI 서버·인프라 투자 수요 급증에 따른 공급 부족이 배경이다. (뉴시스)" },
  { id: 161, ticker: "HOOD", sourceName: "로빈후드 공식 뉴스룸", sourceUrl: "https://robinhood.com/us/en/newsroom/RVII-roadshow-aug3/", tier: 1, isOfficial: true, dateStatus: "confirmed", description: "로빈후드 벤처스 펀드 II(RVII)의 IPO 로드쇼가 8월 3일 오전 9시(PT) 시작된다. 기관 전용이 아닌 일반 투자자에게도 공개되며, RVII는 8월 13일 NYSE 상장(주당 25달러 예정)을 앞두고 있다. (로빈후드 공식 뉴스룸)" },
  { id: 162, ticker: "AERGO", sourceName: "업비트 공식 공지", sourceUrl: "https://upbit.com/service_center/notice?id=1457543706", tier: 1, isOfficial: true, dateStatus: "confirmed", description: "업비트가 8월 3일 15시에 아르고(AERGO)와 알파쿼크(AQT)의 거래지원을 종료한다. 이후 두 토큰은 HPP(House Party Protocol)로 스왑되며, 스왑 완료 후에는 HPP 출금만 지원된다. (업비트 공식 공지)" },
  { id: 163, ticker: "VVV", sourceName: "베니스 AI 공식 블로그", sourceUrl: "https://venice.ai/blog/tokenomics-update-credit-burns-and-diem-supply-expansion", tier: 1, isOfficial: true, dateStatus: "confirmed", description: "베니스 AI가 DIEM 공급 목표를 38,000에서 40,000으로 상향한다. 8월 3일부터 9월 14일까지 2주 간격 4단계로 500 DIEM씩 늘리며, VVV 매입·소각 메커니즘 도입과 함께 발표됐다. (베니스 AI 공식 블로그)" },
  { id: 164, ticker: "HYNIX", sourceName: "디일렉(THE ELEC)", sourceUrl: "https://www.thelec.kr/news/articleView.html?idxno=60370", tier: 2, isOfficial: false, dateStatus: "estimated", description: "SK하이닉스 미국 ADR 등록공모 후속 절차(미 증권법 Rule 174에 따른 투자설명서 교부 의무 기간)가 8월 4일경 마무리되며 공시 제약이 완화된다. 이후 구체적인 주주환원 방안 공개가 예상된다. (디일렉)" },
  { id: 165, ticker: "GLXY", sourceName: "갤럭시 디지털 공식 보도자료", sourceUrl: "https://www.prnewswire.com/news-releases/galaxy-announces-second-quarter-2026-financial-results-302843529.html", tier: 1, isOfficial: true, dateStatus: "confirmed", description: "갤럭시 디지털이 8월 5일 나스닥 개장 전 2026년 2분기 실적을 발표하고, 같은 날 오전 8시 30분(ET) 투자자 콘퍼런스콜을 진행한다. (갤럭시 디지털 공식 보도자료)" },
  { id: 166, ticker: "CRCL", sourceName: "서클 공식 프레스룸", sourceUrl: "https://www.circle.com/pressroom/circle-to-announce-q2-2026-financial-results-on-august-5-2026", tier: 1, isOfficial: true, dateStatus: "confirmed", description: "USDC 발행사 서클이 8월 5일 2026년 2분기 실적을 발표한다. 오전 8시(ET) 라이브 웹캐스트로 진행되며, 코인베이스와의 수익 배분 구조가 관전 포인트다. (서클 공식 프레스룸)" },
  { id: 167, ticker: "ENS", sourceName: "ENS DAO 거버넌스 포럼", sourceUrl: "https://discuss.ens.domains/t/marketplace-rfp-submission-timeline-and-artifacts/22309", tier: 1, isOfficial: true, dateStatus: "confirmed", description: "ENS DAO 마켓플레이스 RFP 제안서 제출이 8월 5일 23:59(UTC) 마감된다. SPP3 예산에서 최대 50만 달러를 단일 수행팀에 지원해 ENS 네임 마켓플레이스를 구축하는 프로그램이다. (ENS DAO 거버넌스 포럼)" },
  { id: 168, ticker: "IONQ", sourceName: "아이온큐 공식 IR", sourceUrl: "https://investors.ionq.com/news/news-details/2026/IonQ-to-Report-Second-Quarter-2026-Financial-Results-on-August-5-2026/default.aspx", tier: 1, isOfficial: true, dateStatus: "confirmed", description: "아이온큐가 미국시간 8월 5일 장 마감 후(한국시간 6일 새벽) 2026년 2분기 실적을 발표하고, 오후 4시 30분(ET) 콘퍼런스콜을 진행한다. (아이온큐 공식 IR)" },
  // ─── 8/6 ~ 8/12 ───
  { id: 169, ticker: "NAVER", sourceName: "CBC뉴스", sourceUrl: "https://www.cbci.co.kr/news/articleView.html?idxno=594700", tier: 2, isOfficial: false, dateStatus: "estimated", correctedDate: "2026-08-07", description: "네이버가 2분기 실적을 발표한다. 언론 보도 기준 발표일은 8월 7일로, 커머스·핀테크 호조에 힘입은 매출 3조3천억원대·영업이익 5천600억원대가 전망된다. (언론 보도 — 네이버 IR 공지 미게시)" },
  { id: 170, ticker: "CN", sourceName: "중국 재정부 3분기 국채발행계획 공고", sourceUrl: "https://www.chinabond.com.cn/xwgg/ggtz/xwgg_jdgg/jdgg_czb_ath/202606/t20260630_855170652.html", tier: 1, isOfficial: true, dateStatus: "estimated", description: "중국 재정부의 3분기 국채발행계획에 따라 7년물 국채 입찰이 진행된다. 1,000억 위안 규모·8월 7일 세부 조건은 재정부 개별 발행 공고에서 최종 확정된다. (중국 재정부 3분기 국채발행계획 공고)" },
  { id: 171, ticker: "GBTC", sourceName: "그레이스케일 SEC 8-K 공시", sourceUrl: "https://www.stocktitan.net/sec-filings/ETHE/8-k-grayscale-ethereum-staking-etf-reports-material-event-00605fa9a50d.html", tier: 1, isOfficial: true, dateStatus: "confirmed", description: "그레이스케일이 이더리움(ETHE)·솔라나(GSOL) 스테이킹 ETF의 보상을 최소 분기 1회 현금화해 주주에게 분배하는 신탁 개정을 8월 7일경 발효한다. IRS 과세 지침(Rev. Proc. 2025-31) 정합을 위한 조치다. (SEC 8-K 공시)" },
  { id: 172, ticker: "QUICK", sourceName: "Crypto Briefing", sourceUrl: "https://cryptobriefing.com/dogechain-shutdown-august-withdraw-assets/", tier: 2, isOfficial: false, dateStatus: "estimated", description: "도지코인 사이드체인 도지체인이 8월 8일 12:00(UTC) 영구 종료되며, 체인 내 대표 DEX인 퀵스왑 운영도 함께 끝난다. 브리지 폐쇄 후 남은 자산은 회수할 수 없어 사전 출금이 필요하다. (Crypto Briefing 보도)" },
  { id: 173, ticker: "US", sourceName: "CoinDesk", sourceUrl: "https://www.coindesk.com/policy/2026/07/23/clarity-act-expected-to-miss-its-window-before-congress-summer-break-leadership-says", tier: 2, isOfficial: false, dateStatus: "estimated", correctedDate: "2026-08-07", description: "미 상원의 휴회 전 마지막 근무일인 8월 7일이 크립토 시장구조 법안(CLARITY Act)의 사실상 처리 시한이다. 툰 원내대표는 휴회 전 통과가 어려울 것이라고 밝혔고, 무산 시 법안은 9월 이후로 밀린다. (CoinDesk 보도)" },
  { id: 174, ticker: "BITHUMB", sourceName: "빗썸 공식 공지", sourceUrl: "https://feed.bithumb.com/notice/1654015", tier: 1, isOfficial: true, dateStatus: "estimated", description: "6월 개인 키 해킹으로 상장폐지된 휴머니티 프로토콜(H) 사태와 관련해 피해자 보상(신규 H 토큰 1:1 지급·보상 펀드) 신청 접수가 진행된다. 스냅샷 이후 매수자도 심사 대상에 포함된다. (빗썸 공식 공지)" },
  { id: 175, ticker: "UNITREE", sourceName: "Global Times", sourceUrl: "https://www.globaltimes.cn/page/202607/1367226.shtml", tier: 2, isOfficial: false, dateStatus: "estimated", description: "휴머노이드 로봇 1위 기업 유니트리가 상하이 커촹판(STAR Market) IPO 온·오프라인 청약을 8월 10일 진행한다. 신주 4,000만주 발행으로 약 42억 위안 조달을 목표로 한다. (Global Times 보도 — 회사 발표 인용)" },
  { id: 176, ticker: "SBET", sourceName: "샤프링크 공식 보도자료", sourceUrl: "https://www.globenewswire.com/news-release/2026/07/27/3333469/0/en/Sharplink-to-Host-Second-Quarter-2026-Earnings-Conference-Call-and-Webcast-on-August-10-2026-at-8-30-A-M-E-T.html", tier: 1, isOfficial: true, dateStatus: "confirmed", description: "이더리움 트레저리 기업 샤프링크(SBET)가 8월 10일 오전 8시 30분(미 동부시간) 2분기 실적 컨퍼런스콜·웹캐스트를 연다. (샤프링크 공식 보도자료)" },
  { id: 177, ticker: "HYPER", sourceName: "하이퍼레인 공식 X", sourceUrl: "https://x.com/hyperlane", tier: 1, isOfficial: true, dateStatus: "estimated", description: "하이퍼레인이 8월 10일부로 HYPER 스테이킹 보상 지급을 종료한다. 이후 스테이킹된 HYPER에는 보상이 발생하지 않으며 잔여 보상 물량도 발행되지 않는다. (하이퍼레인 공식 X 공지)" },
  { id: 178, ticker: "AVNT", sourceName: "TradingView News", sourceUrl: "https://www.tradingview.com/news/coinmarketcal:2a86cb8cd094b:0-avantis-v2-expands-rwa-access-and-introduces-zero-commission-trading-12-aug-2026/", tier: 2, isOfficial: false, dateStatus: "estimated", description: "베이스 기반 파생 프로토콜 아반티스가 8월 12일 V2를 출시한다. 실물자산(RWA) 마켓 접근을 확대하고 수수료 무료(zero-commission) 거래를 도입한다. (TradingView News)" },
  { id: 179, ticker: "CRWV", sourceName: "코어위브 IR 공식 안내", sourceUrl: "https://investors.coreweave.com/news/news-details/2026/CoreWeave-Announces-Date-of-Second-Quarter-2026-Financial-Results-and-Conference-Call/default.aspx", tier: 1, isOfficial: true, dateStatus: "confirmed", correctedDate: "2026-08-11", description: "AI 클라우드 기업 코어위브가 8월 11일 오후 5시(미 동부시간, 한국시간 12일 새벽) 2분기 실적 발표 컨퍼런스콜을 연다. (코어위브 IR 공식 안내)" },
  { id: 180, ticker: "MSCI", sourceName: "MSCI 공식 지수 리뷰 일정", sourceUrl: "https://www.msci.com/eqb/pressreleases/archive/ir_dates.pdf", tier: 1, isOfficial: true, dateStatus: "confirmed", description: "MSCI가 8월 12일 정기 지수 리뷰(편입·편출) 결과를 발표한다. 변경 사항은 9월 1일부로 지수에 반영되며, 국내 대형주 편입 여부에 따라 수급 이벤트가 발생한다. (MSCI 공식 일정 — 8/12 발표·9/1 발효)" },
  // ─── 8/12 ~ 8/18 ───
  { id: 181, ticker: "MON", sourceName: "팬텀 공식 X 공지", sourceUrl: "https://x.com/phantom/status/2080816333948940649", tier: 1, isOfficial: true, dateStatus: "estimated", correctedDate: "2026-08-26", description: "팬텀 월렛이 8월 26일부로 모나드(MON) 체인 지원을 종료한다고 공식 발표했다. 모나드 측 안내에는 8월 12일로 표기돼 날짜가 엇갈리며, 이용자는 복구 구문으로 타 월렛 이전 또는 솔라나 래핑 MON 스왑이 필요하다. (팬텀 공식 X 공지)" },
  { id: 182, ticker: "CBRS", sourceName: "세레브라스 IR 보도자료", sourceUrl: "https://www.globenewswire.com/news-release/2026/07/22/3331690/0/en/cerebras-systems-sets-date-of-second-quarter-2026-financial-results.html", tier: 1, isOfficial: true, dateStatus: "confirmed", correctedDate: "2026-08-12", description: "AI 칩 기업 세레브라스가 8월 12일(수) 미 증시 마감 후 2026년 2분기 실적을 발표하고 오후 5시(ET) 콘퍼런스콜을 연다 — 한국시간 13일 새벽. (세레브라스 IR 보도자료)" },
  { id: 183, ticker: "ETHFI", sourceName: "이더파이 공식 X", sourceUrl: "https://x.com/ether_fi", tier: 1, isOfficial: true, dateStatus: "confirmed", description: "이더파이가 8월 13일 오전 10시(ET) '서머 애널리스트 콜'을 개최한다. 신규 제품 발표가 예고돼 있으며 줌 웨비나 등록으로 참여할 수 있다. (이더파이 공식 X 공지)" },
  { id: 184, ticker: "AMAT", sourceName: "어플라이드 머티리얼즈 IR 보도자료", sourceUrl: "https://www.globenewswire.com/news-release/2026/07/23/3332037/0/en/Applied-Materials-to-Report-Fiscal-Third-Quarter-2026-Results-on-Aug-13-2026.html", tier: 1, isOfficial: true, dateStatus: "confirmed", correctedDate: "2026-08-13", description: "반도체 장비사 어플라이드 머티리얼즈가 8월 13일(목) 오후 4시 30분(ET) 회계연도 3분기 실적 콘퍼런스콜을 연다 — 한국시간 14일 새벽. (어플라이드 머티리얼즈 IR 보도자료)" },
  { id: 185, ticker: "JPYC", sourceName: "해시포트 공식 보도자료 (PR TIMES)", sourceUrl: "https://prtimes.jp/main/html/rd/p/000000181.000046288.html", tier: 1, isOfficial: true, dateStatus: "confirmed", correctedDate: "2026-08-06", description: "로손이 KDDI·해시포트와 8월 6일 다카나와 게이트웨이 시티점에서 엔화 스테이블코인 JPYC의 POS 연동 결제 기술 실증(일본 최초)을 진행하고, 8월 17일 오사키점에서 USDC·USDT·JPYC 2차 실증을 이어간다. 참여는 관계사 직원으로 한정된다. (해시포트 공식 보도자료)" },
  { id: 186, ticker: "US", sourceName: "미 SEC Investor.gov 공식 안내", sourceUrl: "https://www.investor.gov/introduction-investing/investing-basics/glossary/form-13f-reports-filed-institutional-investment-managers", tier: 1, isOfficial: true, dateStatus: "confirmed", description: "운용자산 1억 달러 이상 미 기관투자자는 분기 종료 후 45일 이내에 보유 현황(13F)을 제출해야 하며, 2분기분 마감은 8월 14일이다. 대형 펀드의 BTC ETF·기술주 포지션이 공개된다. (SEC Investor.gov 공식 안내)" },
  { id: 187, ticker: "SPURS", sourceName: "업비트 공식 공지", sourceUrl: "https://www.upbit.com/service_center/notice?id=410113732", tier: 1, isOfficial: true, dateStatus: "confirmed", correctedDate: "2026-08-18", description: "업비트가 8월 18일 15시에 토트넘홋스퍼(SPURS) 팬토큰의 거래지원을 종료한다. 보유자는 공지된 출금 지원 기간 내 자산을 이전해야 한다. (업비트 공식 공지)" },
  { id: 188, ticker: "STRC", sourceName: "스트래티지 공식 보도자료", sourceUrl: "https://www.strategy.com/press/strategy-announces-approval-of-strc-semi-monthly-dividends_06-08-2026", tier: 1, isOfficial: true, dateStatus: "confirmed", description: "스트래티지 우선주 STRC가 월 2회(기준일 매월 15일·말일) 배당 체제로 전환돼, 7월 31일 기준 주주에게 8월 15일 주당 0.50달러(연 12% 수준)가 지급된다. (스트래티지 공식 보도자료)" },
  { id: 189, ticker: "KR", sourceName: "한국거래소 휴장일 안내", sourceUrl: "https://global.krx.co.kr/contents/GLB/05/0501/0501110000/GLB0501110000.jsp", tier: 1, isOfficial: true, dateStatus: "confirmed", description: "8·15 광복절이 토요일이라 17일(월)이 대체공휴일로 지정돼 국내 증권·파생상품시장이 휴장한다. (한국거래소 휴장일 안내)" },
  { id: 190, ticker: "BASE", sourceName: "코인베이스 공식 X", sourceUrl: "https://x.com/coinbase/status/2082949787788190070", tier: 1, isOfficial: true, dateStatus: "confirmed", description: "코인베이스의 CFTC 규제 파생상품 거래소가 8월 17일 S&P500을 추종하는 US500 무기한형(perp-style) 선물을 출시한다. 만기 없이 펀딩레이트로 지수에 연동되며 최대 20배 레버리지를 제공한다. (코인베이스 공식 X 공지)" },
  { id: 191, ticker: "SOL", sourceName: "ANZA 공식 GitHub 릴리스 일정", sourceUrl: "https://github.com/anza-xyz/agave/wiki/v4.2-Release-Schedule", tier: 1, isOfficial: true, dateStatus: "confirmed", description: "ANZA가 8월 17일 솔라나 메인넷에서 Agave v4.2 피처 활성화를 시작한다(8/10 일반 채택 권고). 200ms 슬롯·트랜잭션 크기 확대 등 합의 개편 '알펜글로우'로 가는 핵심 기반 작업이며 일정은 변동될 수 있다. (ANZA 공식 GitHub 릴리스 일정)" },
  { id: 192, ticker: "CBRS", sourceName: "세레브라스 공식 행사 페이지", sourceUrl: "https://www.cerebras.ai/supernova", tier: 1, isOfficial: true, dateStatus: "confirmed", description: "세레브라스가 8월 18일 샌프란시스코 더 미드웨이에서 플래그십 행사 '슈퍼노바 2026'을 연다. CEO 앤드루 펠드먼의 키노트와 초고속 추론 시연·제품 발표가 예정돼 있다. (세레브라스 공식 행사 페이지)" },
  // ─── 8/18 ~ 8/31 ───
  { id: 193, ticker: "CRCL", sourceName: "CoinGape", sourceUrl: "https://coingape.com/block-of-fame/pulse/coinbase-circle-partnership-to-renew-on-same-terms-cfo-alesia-haas-says/", tier: 2, isOfficial: false, dateStatus: "estimated", description: "2023년 8월 18일 체결된 서클-코인베이스 USDC 수익 배분 계약(초기 3년)의 자동 갱신 시점이 도래한다. 코인베이스 CFO 알레시아 하스는 7월 30일 실적 콜에서 갱신 조건이 이미 충족돼 동일 조건으로 갱신된다고 확인했다. (코인게이프 보도)" },
  { id: 194, ticker: "US", sourceName: "TIME", sourceUrl: "https://time.com/article/2026/06/19/iran-united-states-agreement-nuclear-program-war-israel-lebanon/", tier: 2, isOfficial: false, dateStatus: "estimated", description: "6월 18일 서명된 미국-이란 휴전·협상 프레임워크의 60일 협상 시한이 만료된다. 이 기간 내 이란 우라늄 농축·제재 해제 일정 등 핵심 쟁점을 타결해야 하며, 실패 시 유엔 스냅백 제재 재발동 가능성이 거론된다. (타임 보도)" },
  { id: 195, ticker: "BNB", sourceName: "BNB체인 공식 GitHub", sourceUrl: "https://github.com/bnb-chain/bsc/blob/master/CHANGELOG.md", tier: 1, isOfficial: true, dateStatus: "confirmed", description: "BNB 스마트체인(BSC) 메인넷 '파스퇴르(Pasteur)' 하드포크가 8월 25일 02:30 UTC에 활성화된다. 노드 운영자는 v1.7.7로 사전 업그레이드가 필요하다. (BNB체인 공식 GitHub 릴리스 노트)" },
  { id: 196, ticker: "HYUNDAI", sourceName: "아주경제", sourceUrl: "https://www.ajunews.com/view/20260728135635062", tier: 2, isOfficial: false, dateStatus: "estimated", description: "현대차가 8월 26일 서울 여의도 콘래드 호텔에서 '2026 CEO 인베스터데이'를 열고 중장기 사업 전략과 피지컬 AI·로보틱스 청사진, 연간 가이던스를 제시한다. (아주경제 보도)" },
  { id: 197, ticker: "BITMART", sourceName: "비트마트 공식 공지", sourceUrl: "https://www.bitmart.com/en-US/support/articles/7922665245339/39162120325403/53544595916059", tier: 1, isOfficial: true, dateStatus: "confirmed", description: "비트마트가 8월 26일 01:00 UTC에 현물·선물 등 모든 거래 서비스를 중단한다. 출금은 8월 26일 05:00 UTC 이전 완료가 권고되며, 플랫폼 최종 폐쇄는 2027년 1월 31일이다. (비트마트 공식 공지)" },
  { id: 198, ticker: "BITMEX", sourceName: "비트멕스 공식 블로그", sourceUrl: "https://www.bitmex.com/blog/bitmex-closure", tier: 1, isOfficial: true, dateStatus: "confirmed", description: "비트멕스가 8월 26일 04:00 UTC부터 리스크 한도를 적용해 신규 포지션 진입을 막고 포지션 축소만 허용하며, 9월 23일 04:00 UTC 거래소를 완전 종료한다. 미청산 포지션은 순차 강제 청산된다. (비트멕스 공식 블로그)" },
  { id: 199, ticker: "BITHUMB", sourceName: "PANews", sourceUrl: "https://www.panewslab.com/ko/articles/019f8d6e-3780-74cc-b652-d4cd1cf09a60", tier: 2, isOfficial: false, dateStatus: "estimated", description: "서울중앙지방법원이 8월 27일 오후 2시 빗썸 비트코인 오지급 사태 관련 첫 부당이득 반환 소송(오지급 코인 매도 이용자 4명, 약 1억9,400만원 규모) 1심 판결을 선고한다. (PANews 보도)" },
  { id: 200, ticker: "MRVL", sourceName: "마벨 테크놀로지 IR", sourceUrl: "https://investor.marvell.com/news-events/press-releases/detail/1029/marvell-technology-inc-announces-conference-call-to-review-second-quarter-of-fiscal-year-2027-financial-results-announces-investor-day-on-october-6-2026", tier: 1, isOfficial: true, dateStatus: "confirmed", correctedDate: "2026-08-27", description: "AI 반도체 기업 마벨이 8월 27일(목) 장 마감 후 2027 회계연도 2분기 실적을 발표하고 오후 1시 45분(태평양시간) 컨퍼런스콜을 연다. (마벨 IR 공식 보도자료)" },
  { id: 201, ticker: "ZRO", sourceName: "레이어제로 공식 블로그", sourceUrl: "https://layerzero.network/blog/support-update-july-24-2026", tier: 1, isOfficial: true, dateStatus: "estimated", description: "레이어제로가 보타닉스·칸토·문빔·문리버·넥세라 등 저활동 체인에 대한 DVN·실행자(Executor) 오프체인 지원과 스타게이트 지원을 공지 후 약 30일에 걸쳐 종료한다. 해당 체인의 하이드라 자산 보유자는 기한 전 상환·브리지가 필요하다. (레이어제로 공식 블로그)" },
  { id: 202, ticker: "JEWEL", sourceName: "디파이킹덤 공식 X", sourceUrl: "https://x.com/DeFiKingdoms/status/2083238250311725278", tier: 1, isOfficial: true, dateStatus: "confirmed", description: "디파이킹덤이 8월 28일 DFK 체인을 공식 종료(선셋)하고 아발란체 C-체인으로 이전한다. JEWEL 및 브리지 자산(BTC·ETH·AVAX 등)은 종료 전 체인 밖으로 옮기지 않으면 영구 소실된다. (디파이킹덤 공식 X 공지)" },
  { id: 203, ticker: "REVOLUT", sourceName: "코인텔레그래프", sourceUrl: "https://cointelegraph.com/news/revolut-usdt-delisting-regulatory-risk-concerns", tier: 2, isOfficial: false, dateStatus: "estimated", description: "레볼루트가 EU MiCA 규제·리스크를 이유로 8월 31일까지 EEA·스위스 이용자 대상 테더(USDT) 지원을 종료한다. 기한 후 잔여 USDT는 당일 환율로 기본 통화 자동 전환된다. (코인텔레그래프 보도)" },
  { id: 204, ticker: "NFTFI", sourceName: "PANews", sourceUrl: "https://www.panewslab.com/en/articles/019eb74f-d355-7137-99d6-e79cfc79e76a", tier: 2, isOfficial: false, dateStatus: "estimated", description: "NFT 담보 대출 플랫폼 NFTfi가 NFT 시장 위축에 따른 수익성 악화로 8월 31일 프런트엔드(app.nftfi.com)를 폐쇄한다. 신규 대출은 이미 중단됐으며, 배포된 스마트컨트랙트는 온체인에 남아 상환·NFT 회수는 계속 가능하다. (PANews 보도)" },
];

type Source = { name?: string; url?: string; tier?: number; isOfficial?: boolean };

function toSources(v: unknown): Source[] | null {
  return Array.isArray(v) ? (v as Source[]) : null;
}

const LAYERGG_RE = /layergg|layer\.gg/i;

function isLayergg(s: Source): boolean {
  return LAYERGG_RE.test(`${s.url ?? ""} ${s.name ?? ""}`);
}

// description에서 LAYER.GG 언급 제거 — "(출처: LAYER.GG …)" 괄호부와 "※ LAYER.GG …" 꼬리 문구
function stripLayergg(desc: string): string {
  return desc
    .replace(/\s*\(출처:\s*LAYER\.GG[^)]*\)/gi, "")
    .replace(/\s*※\s*LAYER\.GG[^.]*\.?\s*$/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function main() {
  // 1) 리서치 결과 적용
  let researched = 0;
  const misses: string[] = [];
  for (const r of RESEARCHED) {
    const ev = await prisma.calendarEvent.findUnique({ where: { id: r.id } });
    if (!ev || ev.ticker !== r.ticker) {
      misses.push(`#${r.id} ${r.ticker}`);
      continue;
    }
    const keep = (toSources(ev.sources) ?? []).filter((s) => !isLayergg(s) && s.url !== r.sourceUrl);
    await prisma.calendarEvent.update({
      where: { id: r.id },
      data: {
        sourceUrl: r.sourceUrl,
        description: stripLayergg(r.description),
        sources: [{ name: r.sourceName, url: r.sourceUrl, tier: r.tier, isOfficial: r.isOfficial }, ...keep] as Prisma.InputJsonValue,
        ...(r.dateStatus ? { dateStatus: r.dateStatus } : {}),
        ...(r.correctedDate ? { date: new Date(`${r.correctedDate}T00:00:00Z`) } : {}),
      },
    });
    researched++;
  }

  // 1.5) ENA #38 — 공식 원문 미확인 (에테나 블로그·거버넌스 포럼·docs·X·언론 검색 실패,
  // ether.fi 8개 체인 브리지 종료(6/30 시한)와의 티커 혼동 가능성) → 출처 제거 + 재확인 대상
  const ena = await prisma.calendarEvent.findUnique({ where: { id: 38 } });
  if (ena?.ticker === "ENA") {
    await prisma.calendarEvent.update({
      where: { id: 38 },
      data: {
        sourceUrl: null,
        description: "에테나가 일부 체인 지원을 종료하고 이더리움으로의 자산 마이그레이션 마감일을 둔 것으로 알려졌으나, 공식 발표 원문은 확인되지 않았다.",
        dateStatus: "estimated",
        reviewStatus: "needs_recheck",
      },
    });
  }

  // 2) 전 이벤트 공통 정리 — sources 배열·description에 남은 LAYER.GG 흔적 제거
  const dirty = await prisma.calendarEvent.findMany({
    where: {
      OR: [
        { description: { contains: "LAYER.GG", mode: "insensitive" } },
        { sourceUrl: { contains: "layergg", mode: "insensitive" } },
        { sourceUrl: { contains: "layer.gg", mode: "insensitive" } },
      ],
    },
  });
  const dirtyJson = (await prisma.calendarEvent.findMany({ where: { sources: { not: Prisma.DbNull } } })).filter(
    (e) => JSON.stringify(e.sources).toLowerCase().includes("layergg"),
  );
  const targets = new Map<number, (typeof dirty)[number]>();
  for (const e of [...dirty, ...dirtyJson]) targets.set(e.id, e);

  let cleaned = 0;
  for (const ev of targets.values()) {
    const sources = toSources(ev.sources)?.filter((s) => !isLayergg(s)) ?? null;
    await prisma.calendarEvent.update({
      where: { id: ev.id },
      data: {
        description: stripLayergg(ev.description),
        ...(sources ? { sources: sources as Prisma.InputJsonValue } : {}),
        // sourceUrl이 여전히 layergg면 남은 출처 중 첫 번째로 폴백, 없으면 null
        ...(ev.sourceUrl && LAYERGG_RE.test(ev.sourceUrl)
          ? { sourceUrl: sources && sources.length > 0 ? (sources[0].url ?? null) : null }
          : {}),
      },
    });
    cleaned++;
  }

  // 3) 검증
  const all = await prisma.calendarEvent.findMany();
  const leftover = all.filter((e) =>
    `${e.sourceUrl ?? ""} ${e.description} ${JSON.stringify(e.sources ?? "")}`.toLowerCase().match(/layergg|layer\.gg/),
  );
  console.log(`리서치 출처 적용 ${researched}건 / 공통 정리 ${cleaned}건`);
  console.log(`LAYER.GG 잔여: ${leftover.length}건${leftover.length ? " — " + leftover.map((e) => `#${e.id} ${e.ticker}`).join(", ") : ""}`);
  // 부분 실패를 성공처럼 넘기지 않는다 — 매칭 실패나 잔여 건이 있으면 비정상 종료
  if (misses.length || leftover.length) {
    throw new Error(
      `정리 미완료 — 매칭 실패 ${misses.length}건${misses.length ? ` (${misses.join(" | ")})` : ""}, LAYER.GG 잔여 ${leftover.length}건`,
    );
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
