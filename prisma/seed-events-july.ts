import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// LAYER.GG July 2026 Market Calendar 기반 — 단, 출처(sourceUrl)는 각 이벤트의
// 실제 콘텐츠 출처(공식 IR·정부기관·프로젝트 공식·보도)로 개별 검증해 반영 (검증일 2026-07-01)
// category(색상): important(파랑) | good(초록) | bad(빨강) | neutral(회색)
// [day, ticker, title(국문), category, groupMain(대분류), groupSub(소분류), description(국문), sourceUrl]
type Seed = [number, string, string, string, string, string, string, string];

const EVENTS: Seed[] = [
  [1, "KLAR", "클라르나 vs 구글 반독점 소송 판결", "important", "주식", "규제·소송", "클라르나 자회사 프라이스러너가 구글을 상대로 제기한 83억 달러 규모 반독점 손해배상 소송의 스웨덴 법원 판결이 7월 1일로 예정됐다. (출처: PYMNTS)", "https://www.pymnts.com/legal/antitrust/2026/klarna-google-antitrust-verdict-set-for-july-1/"],
  [1, "SPCX", "스페이스X-Reflection AI 63억 달러 컴퓨트 계약", "important", "주식", "파트너십", "스페이스X가 오픈소스 AI 스타트업 Reflection AI와 콜로서스 데이터센터 컴퓨팅 파워를 최대 63억 달러 규모로 제공하는 계약을 체결했다. (출처: CNBC)", "https://www.cnbc.com/2026/06/22/spacex-ai-colossus-data-center-reflection.html"],
  [1, "HOOD", "로빈후드 크립토 신제품 발표 이벤트", "good", "주식", "실적·발표", "로빈후드가 런던에서 'The World is Flat' 라이브 이벤트를 열고 블라드 테네브 CEO가 국경 없는 시장을 위한 신규 크립토 제품군을 공개한다. (출처: Robinhood)", "https://robinhood.com/us/en/campaign/presents/"],
  [1, "XCN", "오닉스(XCN) '새로운 시대' 발표", "good", "크립토", "프로젝트", "은행·금융기관용 L1 오닉스가 7월 1일 '$XCN의 새로운 시대'(Onyx Mesh)를 예고했다. (출처: Onyx 공식)", "https://onyx.org/"],
  [1, "DYDX", "dYdX 주요 발표 예고", "good", "크립토", "프로젝트", "dYdX가 7월 1일 중대 발표를 예고하며 시장 기대감이 커졌다. (출처: dYdX 공식 블로그)", "https://www.dydx.xyz/blog"],
  [1, "POL", "폴리곤 zkEVM 메인넷 베타 종료", "bad", "크립토", "프로젝트", "폴리곤이 7월 1일 zkEVM 메인넷 베타 시퀀서를 종료하고 자산 클레임 절차를 시작한다. (출처: Polygon 커뮤니티 포럼)", "https://forum.polygon.technology/t/polygon-zkevm-mainnet-beta-sunset-claim-your-funds/21856"],
  [2, "SECZ", "시큐리타이즈(SECZ) NYSE 상장", "important", "주식", "상장", "토큰화 플랫폼 시큐리타이즈가 캔터 에쿼티 파트너스 II와의 SPAC 합병을 완료하고 7월 2일 티커 SECZ로 뉴욕증권거래소(NYSE)에 상장했다. 약 4억 달러를 조달했으며 아발란체·솔라나에서 주식을 동시 토큰화했다. (출처: PR Newswire)", "https://www.prnewswire.com/news-releases/securitize-completes-business-combination-with-cantor-equity-partners-ii-302816174.html"],
  [2, "INJ", "인젝티브 INJ 커뮤니티 바이백 재개", "good", "크립토", "프로젝트", "인젝티브가 7월 커뮤니티 바이백을 재개하며 프로토콜 수익으로 INJ를 매입·소각한다. (출처: Injective 공식 블로그)", "https://injective.com/blog/2026-injective-community-buy-back-guide"],
  [2, "LIT", "라이터(LIT) 투자자 콜", "good", "크립토", "프로젝트", "탈중앙 무기한 선물 거래소 라이터가 투자자 콜에서 LIT 소각·스테이킹 목표 등 토크노믹스 업데이트를 공유했다. (출처: Lighter 공식)", "https://lighter.xyz/"],
  [3, "KR", "코스닥 개설 30주년 기념행사", "good", "이벤트", "행사", "한국거래소가 1996년 개설된 코스닥 시장의 30주년을 맞아 기념식과 IR 행사를 7월 1~3일 개최한다. (출처: 한국거래소)", "https://www.krx.co.kr"],
  [4, "USA", "미 CLARITY 법안 최종 절차", "important", "매크로", "정치·정책", "미국 가상자산 시장구조 법안인 CLARITY법(H.R.3633)이 상원 본회의 등 최종 입법 절차를 밟는다. (출처: 미 의회 congress.gov)", "https://www.congress.gov/bill/119th-congress/house-bill/3633"],
  [4, "US", "트럼프 독립 250주년 연설", "good", "매크로", "정치·정책", "미국 독립 250주년(7월 4일) 'Salute to America 250' 행사에서 트럼프 대통령이 대국민 연설에 나선다. (출처: 백악관)", "https://www.whitehouse.gov/freedom250/"],
  [6, "STRK", "스타크넷 v0.14.3 — 동적 L2 가스 기본수수료", "good", "크립토", "프로젝트", "스타크넷이 7월 6일 메인넷 v0.14.3을 적용해 동적 L2 가스 기본수수료와 블록 생성 속도 개선을 도입한다. (출처: Starknet 커뮤니티 포럼)", "https://community.starknet.io/t/starknet-0-14-3-pre-release-notes/116211"],
  [7, "SAMSUNG", "삼성전자 2분기 잠정실적 발표", "important", "주식", "실적·발표", "삼성전자가 2026년 2분기 매출·영업이익 등 핵심 수치를 담은 잠정실적을 공개한다. (출처: 삼성전자 IR)", "https://www.samsung.com/sec/ir/financial-information/earnings-release/"],
  [7, "SPCX", "스페이스X 나스닥100 지수 편입", "important", "주식", "지수", "스페이스X가 나스닥의 신속 편입 제도를 통해 상장 15거래일 만에 7월 7일 개장부터 나스닥100 지수에 편입된다. (출처: CNBC)", "https://www.cnbc.com/2026/06/26/spacex-added-to-nasdaq-100.html"],
  [8, "ANTHROPIC", "앤트로픽 클로드 사용자 신원인증(KYC) 도입", "good", "주식", "서비스", "앤트로픽이 7월 8일부터 개정 정책을 적용해 정부 발급 신분증과 셀피를 활용한 사용자 신원인증(KYC)을 도입한다. (출처: Anthropic)", "https://support.claude.com/en/articles/14328960-identity-verification-on-claude"],
  [8, "BERA", "베라체인 PoL Next 업그레이드 (7/7~8)", "good", "크립토", "프로젝트", "베라체인이 7월 7~8일 하드포크로 PoL Next를 적용해 BGT를 폐지하고 BERA 중심으로 인센티브 구조를 재편한다. (출처: Berachain 공식 블로그)", "https://blog.berachain.com/blog/introducing-pol-v2"],
  [10, "HYNIX", "SK하이닉스 ADR 나스닥 상장", "important", "주식", "상장", "SK하이닉스가 최대 45조원 규모의 주식예탁증서(ADR)를 발행하며 나스닥에 상장한다. (출처: 전자신문)", "https://www.etnews.com/20260624000425"],
  [13, "CC", "DTCC, 캔톤서 토큰화 서비스 테스트", "good", "크립토", "프로젝트", "DTCC가 SEC 승인 하에 7월 캔톤 네트워크에서 토큰화 증권의 프로덕션 테스트를 시작한다. (출처: The Block)", "https://www.theblock.co/post/383009/dtcc-onchain-treasury-test-canton-network-sec-greenlight"],
  [14, "FED", "워시 연준의장 의회 증언", "bad", "매크로", "정치·정책", "케빈 워시 신임 연준 의장이 통화정책 관련 의회 증언에 나선다. (출처: 미 연방준비제도)", "https://www.federalreserve.gov/newsevents/testimony.htm"],
  [15, "ASML", "ASML 실적 발표", "important", "주식", "실적·발표", "반도체 노광장비 선두주자 ASML의 분기 실적 발표 일정입니다. (출처: ASML IR)", "https://www.asml.com/en/investors"],
  [15, "STRC", "STRC 반월 배당 지급 시작", "important", "크립토", "프로젝트", "스트래티지의 STRC 우선주가 7월 15일 첫 반월 배당을 지급하며 월 2회 지급 체계로 전환한다. (출처: Strategy 공식 보도자료)", "https://www.strategy.com/press/strategy-announces-approval-of-strc-semi-monthly-dividends_06-08-2026"],
  [15, "OPENAI", "오픈AI 첫 하드웨어 'Codex Micro' 출시", "bad", "주식", "제품·출시", "오픈AI가 Work Louder와 협업해 Codex 단축키(Shortcuts) 전용 매크로패드 'Codex Micro'를 7월 15일 공개한다. (출처: The Mac Observer)", "https://www.macobserver.com/news/openais-first-custom-hardware-could-be-a-keyboard-built-for-codex/"],
  [15, "SIGN", "$SIGN 토큰 언락 일정 재조정", "bad", "크립토", "언락", "사인 프로토콜(SIGN)의 토큰 언락 일정이 재조정되며, 다음 물량 해제가 예정되어 있어 공급 변동에 유의해야 합니다. (출처: Tokenomist)", "https://tokenomist.ai/sign-global"],
  [16, "KR", "한은 기준금리 결정", "important", "매크로", "금리결정", "한국은행 금융통화위원회가 7월 통화정책방향 회의를 열고 기준금리를 결정한다. (출처: 한국은행)", "https://www.bok.or.kr/portal/singl/crncyPolicyDrcMtg/listYear.do?mtgSe=A&menuNo=200755"],
  [16, "TSM", "TSMC 실적 발표", "important", "주식", "실적·발표", "세계 최대 파운드리 TSMC의 2분기 실적 발표 및 콘퍼런스콜이 예정돼 있습니다. (출처: TSMC IR)", "https://investor.tsmc.com/english"],
  [16, "HYPE", "하이퍼리퀴드 서밋 NYC", "good", "크립토", "컨퍼런스", "HL Global이 7월 16일 뉴욕에서 기관·빌더 대상 하이퍼리퀴드 서밋을 개최한다. (출처: HL Global 공식 이벤트)", "https://hlglobal.xyz/"],
  [17, "US", "美 하원 CLARITY 청문회", "bad", "매크로", "정치·정책", "미국 하원 금융서비스위원회가 가상자산 시장구조 법안(CLARITY법) 관련 청문회를 연다. (출처: 미 하원 금융서비스위원회)", "https://financialservices.house.gov/news/documentsingle.aspx?DocumentID=409758"],
  [19, "WORLDCUP", "FIFA 월드컵 2026 결승전", "good", "이벤트", "스포츠", "2026 FIFA 월드컵 결승전이 7월 19일 뉴욕·뉴저지(메트라이프) 스타디움에서 개최됩니다. (출처: FIFA)", "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/new-york-new-jersey-stadium-host-world-cup-2026-final"],
  [22, "IBM", "IBM 실적 발표", "important", "주식", "실적·발표", "IBM의 분기 실적 발표 일정입니다. (출처: IBM IR)", "https://www.ibm.com/investor"],
  [22, "SAMSUNG", "갤럭시 Z 폴드8 공개", "important", "주식", "제품·출시", "삼성전자가 7월 22일 갤럭시 언팩에서 갤럭시 Z 폴드8을 공개하며 신형 폴더블 라인업을 선보인다. (출처: Tom's Guide)", "https://www.tomsguide.com/phones/samsung-phones/samsung-galaxy-unpacked-2026-preview-galaxy-z-fold-8-z-flip-8-intelligent-eyewear-and-more"],
  [22, "TSLA", "테슬라 실적 발표", "important", "주식", "실적·발표", "전기차 기업 테슬라의 분기 실적 발표 일정입니다. (출처: 테슬라 IR)", "https://ir.tesla.com/"],
  [23, "HYUNDAI", "현대차 2분기 실적 발표", "important", "주식", "실적·발표", "현대자동차가 2026년 2분기 경영실적을 컨퍼런스콜과 함께 발표한다. (출처: 현대자동차 IR)", "https://www.hyundai.com/worldwide/ko/company/ir/financial-information/quarterly-earnings"],
  [23, "INTC", "인텔 실적 발표", "important", "주식", "실적·발표", "반도체 기업 인텔의 분기 실적 발표 일정입니다. (출처: 인텔 IR)", "https://www.intc.com/"],
  [23, "KLAC", "KLA 실적 발표", "important", "주식", "실적·발표", "반도체 검사장비 기업 KLA의 분기 실적 발표 일정입니다. (출처: KLA IR)", "https://ir.kla.com/"],
  [23, "SAMSUNG", "삼성전자 2분기 확정 실적 발표", "important", "주식", "실적·발표", "삼성전자가 2026년 2분기 사업부별 세부 실적과 컨퍼런스콜을 포함한 확정 실적을 발표한다. (출처: 삼성전자 IR)", "https://www.samsung.com/sec/ir/financial-information/earnings-release/"],
  [24, "WLD", "월드코인(WLD) 언락 비율 43% 감소", "bad", "크립토", "언락", "월드코인(WLD)의 토큰 언락 비율이 43% 감소하며 신규 공급 압력이 완화될 것으로 예상됩니다. (출처: DefiLlama)", "https://defillama.com/unlocks/worldcoin"],
  [27, "MSFT", "마이크로소프트 실적 발표", "important", "주식", "실적·발표", "마이크로소프트의 분기 실적 발표 일정입니다. (출처: 마이크로소프트 IR)", "https://www.microsoft.com/en-us/investor"],
  [28, "GOOG", "알파벳(구글) 실적 발표", "important", "주식", "실적·발표", "구글 모회사 알파벳의 분기 실적 발표 일정입니다. (출처: 알파벳 IR)", "https://abc.xyz/investor/"],
  [29, "ARM", "Arm 실적 발표", "important", "주식", "실적·발표", "반도체 설계 기업 Arm의 분기 실적 발표 일정입니다. (출처: Arm IR)", "https://investors.arm.com/"],
  [29, "META", "메타 실적 발표", "important", "주식", "실적·발표", "페이스북·인스타그램 모회사 메타의 분기 실적 발표 일정입니다. (출처: 메타 IR)", "https://investor.atmeta.com/"],
  [29, "SAMSUNGEM", "삼성전기 2분기 실적 발표", "important", "주식", "실적·발표", "삼성전기가 2026년 2분기 경영실적을 발표한다. (출처: 삼성전기 IR)", "https://m.samsungsem.com/kr/about-us/investor-relations/earnings-release.do"],
  [29, "HYNIX", "SK하이닉스 2분기 실적 발표", "important", "주식", "실적·발표", "SK하이닉스가 2026년 2분기 경영실적과 컨퍼런스콜을 진행한다. (출처: SK하이닉스 IR)", "https://www.skhynix.com/ir/UI-FR-IR01/"],
  [30, "AAPL", "애플 실적 발표", "important", "주식", "실적·발표", "애플의 분기 실적 발표 일정입니다. (출처: 애플 IR)", "https://investor.apple.com/"],
  [30, "AMZN", "아마존 실적 발표", "important", "주식", "실적·발표", "아마존의 분기 실적 발표 일정입니다. (출처: 아마존 IR)", "https://ir.aboutamazon.com/"],
  [30, "US", "미 FOMC 기준금리 결정", "important", "매크로", "금리결정", "미국 연준 FOMC가 7월 정례회의(28~29일)를 열고 기준금리를 결정한다 — 이달 최대 변동성 이벤트. (출처: 연준 FOMC 공식 일정)", "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"],
  [30, "STRC", "STRC 배당 지급일", "good", "크립토", "프로젝트", "스트래티지 STRC 우선주의 반월 배당 지급일로, 정기 배당이 지급된다. (출처: Strategy 공식 보도자료)", "https://www.strategy.com/press/strategy-announces-approval-of-strc-semi-monthly-dividends_06-08-2026"],
  [31, "AAPL", "애플 폴더블 아이폰 7월 말 양산 착수", "good", "주식", "제품·출시", "애플의 첫 폴더블 아이폰(아이폰 폴드)이 7월 말 양산에 들어가 가을 라인업과 함께 공개될 전망이다. (출처: MacRumors)", "https://www.macrumors.com/roundup/iphone-fold/"],
  [31, "CBRS", "세레브라스에서 오픈AI GPT-5.6 Sol 구동", "good", "주식", "제품·출시", "오픈AI가 엔비디아 대안인 세레브라스 하드웨어에서 초저지연 추론으로 GPT-5.6 Sol 모델을 구동한다. (출처: Tech Times)", "https://www.techtimes.com/articles/319172/20260626/openai-cerebras-bet-spawns-jalapeno-chip-gpt-56-faces-government-gate.htm"],
];

// TBA in July — 월 중 일정 미정
// [ticker, title(국문), category, groupMain, groupSub, description(국문), sourceUrl]
const TBA_EVENTS: [string, string, string, string, string, string, string][] = [
  ["KR", "토큰증권(STO) 규율 정비", "good", "매크로", "정치·정책", "금융위원회가 자본시장법 틀 안에서 토큰증권(STO)의 발행·유통 규율체계를 7월 중 정비한다. (출처: 금융위원회)", "https://www.fsc.go.kr/no010101"],
  ["AERO", "에어로드롬·벨로드롬 통합 'Aero' 멀티체인 DEX", "good", "크립토", "프로젝트", "드로모스랩스가 에어로드롬과 벨로드롬을 단일 토큰 'Aero'로 통합하고 멀티체인 DEX를 선보인다. (출처: CoinDesk)", "https://www.coindesk.com/tech/2025/11/13/leading-base-dex-aerodrome-merges-into-aero-in-major-overhaul"],
  ["ZEC", "지캐시 아이언우드 업그레이드", "good", "크립토", "프로젝트", "지캐시가 7월 중 아이언우드 업그레이드로 새 프라이버시 풀을 도입해 유통량 검증성을 복원한다. (출처: Zcash 커뮤니티 포럼)", "https://forum.zcashcommunity.com/t/ironwood-verifying-the-soundness-of-zcash-s-circulating-supply/56044"],
  ["SPCX", "스페이스X 스타링크 자체 모바일 서비스 추진", "important", "주식", "제품·출시", "스페이스X가 EchoStar 주파수 확보와 'Starlink Mobile' 상표 출원을 바탕으로 자체 소비자 모바일 서비스를 준비 중이다. (출처: Android Authority)", "https://www.androidauthority.com/spacex-starlink-mobile-service-imminent-3681804/"],
  ["GOOG", "구글 제미나이 신규 모델 공개", "important", "주식", "제품·출시", "구글이 에이전트·코딩용 프런티어 지능을 내세운 신규 제미나이 모델을 공개했다. (출처: Google)", "https://blog.google/innovation-and-ai/technology/ai/google-ai-updates-may-2026/"],
];

async function main() {
  // 7월 데이터만 재시드 (6월 데이터는 보존)
  const from = new Date(Date.UTC(2026, 6, 1));
  const to = new Date(Date.UTC(2026, 7, 1));
  await prisma.calendarEvent.deleteMany({ where: { date: { gte: from, lt: to } } });

  await prisma.calendarEvent.createMany({
    data: [
      ...EVENTS.map(([day, ticker, title, category, groupMain, groupSub, description, sourceUrl]) => ({
        date: new Date(Date.UTC(2026, 6, day)),
        ticker,
        title,
        category,
        groupMain,
        groupSub,
        description,
        sourceUrl,
      })),
      ...TBA_EVENTS.map(([ticker, title, category, groupMain, groupSub, description, sourceUrl]) => ({
        date: new Date(Date.UTC(2026, 6, 1)),
        isTba: true,
        ticker,
        title,
        category,
        groupMain,
        groupSub,
        description,
        sourceUrl,
      })),
    ],
  });

  const count = await prisma.calendarEvent.count({ where: { date: { gte: from, lt: to } } });
  const layergg = await prisma.calendarEvent.count({
    where: { date: { gte: from, lt: to }, sourceUrl: { contains: "layergg" } },
  });
  console.log(`Seeded ${count} July 2026 calendar events (June preserved) — LAYER.GG 출처 잔존: ${layergg}건`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
