import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 2026년 8월 이벤트 보충 시드 — X 큐레이터 @layerggofficial "August 2026 Crypto + Market Calendar"
// (고정 포스트, 2026-08-01 게시) 수집분. 수집일 2026-08-03, 브라우저로 포스트 전문 확인.
// 운영 노트 (docs/data-collection/README.md §3·§5):
//  - LAYER.GG는 T3 큐레이터(기준점) — 7월 시드(seed-events.ts)와 동일하게 발행하되,
//    루머·미확인 TBA 항목(GPU 가격 인상설, OpenAI 신모델설 등)은 수록하지 않음.
//  - 기존 aug-sep 시드와 겹치는 항목(NVDA·잭슨홀·언락류)은 제외.
//  - PLTR(8/10→8/4)·AMD(8/4→8/5)는 LAYER.GG 날짜로 정정(revised) — 아래 REVISIONS.
// 실행: npx tsx prisma/seed-events-aug-layergg.ts (날짜±3일+티커+제목 존재 시 건너뜀 — 멱등)

const LGG_URL = "https://x.com/layerggofficial/status/2083535065699741932";
const LGG = { name: "LAYER.GG (@layerggofficial)", url: LGG_URL, tier: 3 as const, isOfficial: false };

type Seed = {
  date: string; // "YYYY-MM-DD"
  isTba?: boolean;
  ticker: string;
  title: string;
  description: string;
  category: "important" | "good" | "bad" | "neutral";
  groupMain: "크립토" | "주식" | "매크로" | "이벤트";
  groupSub: string;
  dateStatus: "confirmed" | "estimated" | "tba";
  importance: 1 | 2 | 3;
  nextCheck?: string;
};

const EVENTS: Seed[] = [
  // ── 8/1 ──
  { date: "2026-08-01", ticker: "GOOG", title: "구글, 크롬 내 BTC 채굴 차단 계획", description: "구글이 크롬 브라우저에서 비트코인 채굴 동작을 차단하는 정책을 예고했다. (출처: LAYER.GG 8월 캘린더)", category: "neutral", groupMain: "주식", groupSub: "제품·출시", dateStatus: "estimated", importance: 1 },
  { date: "2026-08-01", ticker: "SWARMS", title: "스웜스(SWARMS) V14 ZENA 업데이트", description: "스웜스가 V14 ZENA 업데이트를 진행한다. (출처: LAYER.GG 8월 캘린더)", category: "good", groupMain: "크립토", groupSub: "프로젝트", dateStatus: "estimated", importance: 1 },
  { date: "2026-08-01", ticker: "SEMCO", title: "삼성전기 MLCC 가격 30% 인상", description: "삼성전기가 적층세라믹콘덴서(MLCC) 가격을 30% 인상한다. AI 서버 수요발 부품 가격 상승 흐름. (출처: LAYER.GG 8월 캘린더)", category: "neutral", groupMain: "주식", groupSub: "제품·출시", dateStatus: "estimated", importance: 1 },
  // ── 8/3 ──
  { date: "2026-08-03", ticker: "HOOD", title: "로빈후드 벤처스 펀드 II 로드쇼", description: "로빈후드가 벤처스 펀드 II 로드쇼를 시작한다. (출처: LAYER.GG 8월 캘린더)", category: "neutral", groupMain: "주식", groupSub: "실적·발표", dateStatus: "estimated", importance: 1 },
  { date: "2026-08-03", ticker: "AERGO", title: "업비트, 아르고(AERGO)·에이커(AQT) 상장폐지", description: "업비트가 AERGO와 AQT의 거래지원을 종료한다. 보유자는 출금 지원 기간을 확인해야 한다. (출처: LAYER.GG 8월 캘린더 — 업비트 공지 원문 확인 권장)", category: "bad", groupMain: "크립토", groupSub: "상폐·리스크", dateStatus: "estimated", importance: 2, nextCheck: "2026-08-03" },
  { date: "2026-08-03", ticker: "VVV", title: "베니스(VVV) DIEM 공급 목표 조정", description: "베니스 AI가 DIEM 공급 목표를 조정한다. (출처: LAYER.GG 8월 캘린더)", category: "neutral", groupMain: "크립토", groupSub: "프로젝트", dateStatus: "estimated", importance: 1 },
  // ── 8/4 ──
  { date: "2026-08-04", ticker: "HYNIX", title: "SK하이닉스 ADR 규제 완화", description: "SK하이닉스 ADR 관련 규제가 완화된다. 외국인 접근성 개선 재료. (출처: LAYER.GG 8월 캘린더)", category: "good", groupMain: "주식", groupSub: "지수", dateStatus: "estimated", importance: 1 },
  // ── 8/5 ──
  { date: "2026-08-05", ticker: "GLXY", title: "갤럭시 디지털 실적 발표", description: "크립토 금융사 갤럭시 디지털이 2분기 실적을 발표한다. (출처: LAYER.GG 8월 캘린더)", category: "important", groupMain: "주식", groupSub: "실적·발표", dateStatus: "estimated", importance: 2 },
  { date: "2026-08-05", ticker: "CRCL", title: "서클(CRCL) 실적 발표", description: "USDC 발행사 서클이 2분기 실적을 발표한다. 코인베이스와의 수익 배분 구조가 관전 포인트. (출처: LAYER.GG 8월 캘린더)", category: "important", groupMain: "주식", groupSub: "실적·발표", dateStatus: "estimated", importance: 2 },
  { date: "2026-08-05", ticker: "ENS", title: "ENS 마켓플레이스 RFP 제출 마감", description: "ENS 마켓플레이스 제안요청서(RFP) 제출이 마감된다. (출처: LAYER.GG 8월 캘린더)", category: "neutral", groupMain: "크립토", groupSub: "프로젝트", dateStatus: "estimated", importance: 1 },
  // ── 8/6 ──
  { date: "2026-08-06", ticker: "IONQ", title: "아이온큐 실적 발표", description: "양자컴퓨터 기업 아이온큐가 2분기 실적을 발표한다. (출처: LAYER.GG 8월 캘린더)", category: "important", groupMain: "주식", groupSub: "실적·발표", dateStatus: "estimated", importance: 1 },
  { date: "2026-08-06", ticker: "NAVER", title: "네이버 실적 발표", description: "네이버가 2분기 실적을 발표한다. (출처: LAYER.GG 8월 캘린더)", category: "important", groupMain: "주식", groupSub: "실적·발표", dateStatus: "estimated", importance: 2 },
  // ── 8/7 ──
  { date: "2026-08-07", ticker: "CN", title: "중국 1,000억 위안 7년물 국채 입찰", description: "중국이 1,000억 위안 규모 7년물 국채 입찰을 진행한다. (출처: LAYER.GG 8월 캘린더)", category: "neutral", groupMain: "매크로", groupSub: "경제지표", dateStatus: "estimated", importance: 1 },
  { date: "2026-08-07", ticker: "GBTC", title: "그레이스케일 분기 스테이킹 보상 현금 분배", description: "그레이스케일이 분기 스테이킹 보상을 현금으로 분배한다. (출처: LAYER.GG 8월 캘린더)", category: "neutral", groupMain: "크립토", groupSub: "프로젝트", dateStatus: "estimated", importance: 1 },
  // ── 8/8 ──
  { date: "2026-08-08", ticker: "QUICK", title: "퀵스왑, 도지체인 운영 종료", description: "퀵스왑이 도지체인 운영을 종료한다. 체인 이용자·유동성 공급자는 자산 이전이 필요하다. (출처: LAYER.GG 8월 캘린더)", category: "bad", groupMain: "크립토", groupSub: "프로젝트", dateStatus: "estimated", importance: 1 },
  { date: "2026-08-08", ticker: "US", title: "미 의회 휴회 — CLARITY 법안 처리 시한", description: "미 의회가 휴회에 들어간다. 크립토 시장구조 법안(CLARITY Act)의 회기 내 처리 여부가 갈리는 시점. (출처: LAYER.GG 8월 캘린더)", category: "important", groupMain: "매크로", groupSub: "정치·정책", dateStatus: "estimated", importance: 2 },
  // ── 8/10 ──
  { date: "2026-08-10", ticker: "BITHUMB", title: "빗썸, H 사태 피해자 보상 신청 접수", description: "빗썸이 H 토큰 사태 피해자 보상 신청을 접수한다. (출처: LAYER.GG 8월 캘린더)", category: "neutral", groupMain: "크립토", groupSub: "거래소", dateStatus: "estimated", importance: 1 },
  { date: "2026-08-10", ticker: "UNITREE", title: "유니트리 로보틱스 IPO 청약", description: "휴머노이드 로봇 기업 유니트리가 IPO 청약을 진행한다. (출처: LAYER.GG 8월 캘린더)", category: "good", groupMain: "주식", groupSub: "IPO·상장", dateStatus: "estimated", importance: 2 },
  { date: "2026-08-10", ticker: "SBET", title: "샤프링크(SBET) 실적 발표", description: "이더리움 트레저리 기업 샤프링크가 실적 발표 컨퍼런스콜을 연다. (출처: LAYER.GG 8월 캘린더)", category: "important", groupMain: "주식", groupSub: "실적·발표", dateStatus: "estimated", importance: 1 },
  { date: "2026-08-10", ticker: "HYPER", title: "하이퍼레인(HYPER) 스테이킹 종료", description: "하이퍼레인이 HYPER 스테이킹을 종료한다. (출처: LAYER.GG 8월 캘린더)", category: "neutral", groupMain: "크립토", groupSub: "프로젝트", dateStatus: "estimated", importance: 1 },
  // ── 8/12 ──
  { date: "2026-08-12", ticker: "AVNT", title: "아반티스(AVNT) V2 출시", description: "온체인 파생 프로토콜 아반티스가 V2를 출시한다. (출처: LAYER.GG 8월 캘린더)", category: "good", groupMain: "크립토", groupSub: "프로젝트", dateStatus: "estimated", importance: 1 },
  { date: "2026-08-12", ticker: "CRWV", title: "코어위브 실적 발표", description: "AI 클라우드 기업 코어위브가 2분기 실적을 발표한다. (출처: LAYER.GG 8월 캘린더)", category: "important", groupMain: "주식", groupSub: "실적·발표", dateStatus: "estimated", importance: 2 },
  { date: "2026-08-12", ticker: "MSCI", title: "MSCI 지수 편입 발표", description: "MSCI가 지수 편입 종목을 발표한다. 국내 대형주 편입 여부에 따라 수급 이벤트가 발생한다. (출처: LAYER.GG 8월 캘린더)", category: "important", groupMain: "주식", groupSub: "지수", dateStatus: "estimated", importance: 2 },
  { date: "2026-08-12", ticker: "MON", title: "팬텀, 모나드(MON) 체인 지원 종료", description: "팬텀 월렛이 모나드 체인 지원을 종료한다. (출처: LAYER.GG 8월 캘린더)", category: "bad", groupMain: "크립토", groupSub: "프로젝트", dateStatus: "estimated", importance: 1 },
  // ── 8/13 ──
  { date: "2026-08-13", ticker: "CBRS", title: "세레브라스 실적 발표", description: "AI 칩 기업 세레브라스가 실적을 발표한다. (출처: LAYER.GG 8월 캘린더)", category: "important", groupMain: "주식", groupSub: "실적·발표", dateStatus: "estimated", importance: 1 },
  { date: "2026-08-13", ticker: "ETHFI", title: "이더파이(ETHFI) 애널리스트 콜", description: "이더파이가 ETHFI 애널리스트 콜을 진행한다. (출처: LAYER.GG 8월 캘린더)", category: "neutral", groupMain: "크립토", groupSub: "프로젝트", dateStatus: "estimated", importance: 1 },
  // ── 8/14 ──
  { date: "2026-08-14", ticker: "AMAT", title: "어플라이드 머티리얼즈 실적 발표", description: "반도체 장비사 어플라이드 머티리얼즈가 실적을 발표한다. (출처: LAYER.GG 8월 캘린더)", category: "important", groupMain: "주식", groupSub: "실적·발표", dateStatus: "estimated", importance: 1 },
  { date: "2026-08-14", ticker: "JPYC", title: "일본 로손, JPYC 스테이블코인 결제 테스트", description: "일본 편의점 로손이 엔화 스테이블코인 JPYC 결제 테스트를 시작한다. (출처: LAYER.GG 8월 캘린더)", category: "good", groupMain: "크립토", groupSub: "프로젝트", dateStatus: "estimated", importance: 1 },
  { date: "2026-08-14", ticker: "US", title: "미 기관투자자 13F 보고 마감", description: "미국 기관투자자의 2분기 보유 현황 보고서(13F) 제출이 마감된다. 대형 펀드의 BTC ETF·기술주 포지션이 공개된다. (출처: LAYER.GG 8월 캘린더)", category: "neutral", groupMain: "주식", groupSub: "실적·발표", dateStatus: "confirmed", importance: 1 },
  // ── 8/15 ──
  { date: "2026-08-15", ticker: "SPURS", title: "업비트, 토트넘(SPURS) 상장폐지", description: "업비트가 SPURS 팬토큰의 거래지원을 종료한다. (출처: LAYER.GG 8월 캘린더 — 업비트 공지 원문 확인 권장)", category: "bad", groupMain: "크립토", groupSub: "상폐·리스크", dateStatus: "estimated", importance: 1, nextCheck: "2026-08-14" },
  { date: "2026-08-15", ticker: "STRC", title: "스트래티지 STRC 격월 배당 지급 개시", description: "스트래티지의 우선주 STRC가 격월 정기 지급을 시작한다. (출처: LAYER.GG 8월 캘린더)", category: "neutral", groupMain: "주식", groupSub: "실적·발표", dateStatus: "estimated", importance: 1 },
  // ── 8/17 ──
  { date: "2026-08-17", ticker: "KR", title: "광복절 대체공휴일 — 국내 증시 휴장", description: "8·15 광복절이 토요일이라 17일(월)이 대체공휴일로 지정돼 국내 증시가 휴장한다. (출처: LAYER.GG 8월 캘린더)", category: "neutral", groupMain: "이벤트", groupSub: "행사", dateStatus: "confirmed", importance: 1 },
  { date: "2026-08-17", ticker: "BASE", title: "코인베이스, 베이스에 US500 지수 출시", description: "코인베이스가 베이스 체인에서 미국 주식 500종 지수(US500) 상품을 선보인다. (출처: LAYER.GG 8월 캘린더)", category: "good", groupMain: "크립토", groupSub: "프로젝트", dateStatus: "estimated", importance: 1 },
  { date: "2026-08-17", ticker: "SOL", title: "솔라나 알펜글로우 — Agave v4.2 (ANZA)", description: "ANZA가 솔라나 합의 개편 '알펜글로우'로 가는 Agave v4.2를 배포한다. 확정성 단축의 핵심 마일스톤. (출처: LAYER.GG 8월 캘린더)", category: "good", groupMain: "크립토", groupSub: "프로젝트", dateStatus: "estimated", importance: 2 },
  // ── 8/18 ──
  { date: "2026-08-18", ticker: "CBRS", title: "세레브라스 슈퍼노바 이벤트", description: "세레브라스가 슈퍼노바 행사를 연다. (출처: LAYER.GG 8월 캘린더)", category: "neutral", groupMain: "주식", groupSub: "제품·출시", dateStatus: "estimated", importance: 1 },
  { date: "2026-08-18", ticker: "CRCL", title: "서클-코인베이스 계약 자동 갱신 여부", description: "서클과 코인베이스의 USDC 수익 배분 계약 자동 갱신 여부가 갈리는 날. 갱신 조건 변화는 양사 수익 구조에 직결된다. (출처: LAYER.GG 8월 캘린더)", category: "important", groupMain: "크립토", groupSub: "파트너십", dateStatus: "estimated", importance: 2, nextCheck: "2026-08-17" },
  { date: "2026-08-18", ticker: "US", title: "핵협상 시한", description: "미국 관련 핵협상 시한이 도래한다. 지정학 리스크 변수. (출처: LAYER.GG 8월 캘린더 — 세부 내용 원문 확인 필요)", category: "neutral", groupMain: "매크로", groupSub: "지정학", dateStatus: "estimated", importance: 1, nextCheck: "2026-08-17" },
  // ── 8/25 ──
  { date: "2026-08-25", ticker: "BNB", title: "BNB 체인 BSC 하드포크", description: "BNB 스마트체인이 하드포크 업그레이드를 진행한다. 노드 운영자는 사전 업데이트가 필요하다. (출처: LAYER.GG 8월 캘린더)", category: "good", groupMain: "크립토", groupSub: "프로젝트", dateStatus: "estimated", importance: 2 },
  // ── 8/26 ──
  { date: "2026-08-26", ticker: "HYUNDAI", title: "현대차 CEO 인베스터 데이", description: "현대차가 CEO 인베스터 데이를 열고 중장기 전략을 발표한다. (출처: LAYER.GG 8월 캘린더)", category: "neutral", groupMain: "주식", groupSub: "실적·발표", dateStatus: "estimated", importance: 2 },
  { date: "2026-08-26", ticker: "BITMART", title: "비트마트 서비스 종료", description: "비트마트 거래소가 서비스를 종료한다. 이용자 자산 출금 필요. (출처: LAYER.GG 8월 캘린더)", category: "bad", groupMain: "크립토", groupSub: "거래소", dateStatus: "estimated", importance: 1 },
  { date: "2026-08-26", ticker: "BITMEX", title: "비트멕스 신규 주문 중단·서비스 종료", description: "비트멕스가 신규 주문을 중단하고 서비스 종료 절차에 들어간다. 파생 포지션 정리 필요. (출처: LAYER.GG 8월 캘린더)", category: "bad", groupMain: "크립토", groupSub: "거래소", dateStatus: "estimated", importance: 2 },
  // ── 8/27 ──
  { date: "2026-08-27", ticker: "BITHUMB", title: "빗썸 BTC 과소지급 사태 법원 판결", description: "빗썸 BTC 과소지급 사태에 대한 법원 판결이 나온다. (출처: LAYER.GG 8월 캘린더)", category: "neutral", groupMain: "크립토", groupSub: "거래소", dateStatus: "estimated", importance: 1 },
  // ── 8/28 ──
  { date: "2026-08-28", ticker: "MRVL", title: "마벨 테크놀로지 실적 발표", description: "AI 반도체 기업 마벨이 실적을 발표한다. (출처: LAYER.GG 8월 캘린더)", category: "important", groupMain: "주식", groupSub: "실적·발표", dateStatus: "estimated", importance: 1 },
  { date: "2026-08-28", ticker: "ZRO", title: "레이어제로(ZRO) 8개 체인 지원 종료", description: "레이어제로가 8개 체인에 대한 지원을 종료한다. 해당 체인 브리지 이용자 확인 필요. (출처: LAYER.GG 8월 캘린더)", category: "bad", groupMain: "크립토", groupSub: "프로젝트", dateStatus: "estimated", importance: 1 },
  { date: "2026-08-28", ticker: "JEWEL", title: "디파이킹덤 DFK 체인 종료", description: "디파이킹덤(JEWEL)의 DFK 체인이 운영을 종료한다. (출처: LAYER.GG 8월 캘린더)", category: "bad", groupMain: "크립토", groupSub: "프로젝트", dateStatus: "estimated", importance: 1 },
  // ── 8/31 ──
  { date: "2026-08-31", ticker: "REVOLUT", title: "레볼루트, USDT 상장폐지", description: "핀테크 레볼루트가 테더(USDT) 지원을 종료한다. (출처: LAYER.GG 8월 캘린더)", category: "bad", groupMain: "크립토", groupSub: "거래소", dateStatus: "estimated", importance: 1 },
  { date: "2026-08-31", ticker: "NFTFI", title: "NFTfi 서비스 종료", description: "NFT 담보 대출 플랫폼 NFTfi가 서비스를 종료한다. (출처: LAYER.GG 8월 캘린더)", category: "bad", groupMain: "크립토", groupSub: "프로젝트", dateStatus: "estimated", importance: 1 },
];

// 기존 이벤트 날짜 정정 — LAYER.GG 캘린더 기준 (dateStatus: revised + 출처 추가)
const REVISIONS: { ticker: string; titleContains: string; newDate: string; note: string }[] = [
  { ticker: "PLTR", titleContains: "팔란티어", newDate: "2026-08-04", note: "LAYER.GG 8월 캘린더 기준 8/10 → 8/4 정정" },
  { ticker: "AMD", titleContains: "AMD", newDate: "2026-08-05", note: "LAYER.GG 8월 캘린더 기준 8/4 → 8/5 정정" },
];

async function main() {
  let created = 0;
  for (const e of EVENTS) {
    const date = new Date(`${e.date}T00:00:00Z`);
    const exists = await prisma.calendarEvent.findFirst({
      where: {
        ticker: e.ticker,
        title: e.title,
        date: {
          gte: new Date(date.getTime() - 3 * 86400_000),
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
        sourceUrl: LGG_URL,
        dateStatus: e.dateStatus,
        importance: e.importance,
        sources: [LGG],
        reviewStatus: "published",
        nextCheck: e.nextCheck ? new Date(`${e.nextCheck}T00:00:00Z`) : null,
      },
    });
    created++;
    console.log(`created: ${e.date} ${e.ticker} ${e.title}`);
  }

  // 날짜 정정 — 기존 행 유지(출처 보존) + 날짜·상태만 갱신
  for (const r of REVISIONS) {
    const row = await prisma.calendarEvent.findFirst({
      where: {
        ticker: r.ticker,
        title: { contains: r.titleContains },
        date: { gte: new Date("2026-08-01T00:00:00Z"), lt: new Date("2026-09-01T00:00:00Z") },
      },
      orderBy: { id: "asc" }, // 다중 매치 시 결정적 선택
    });
    if (!row) {
      console.log(`revise skip (미발견): ${r.ticker} ${r.titleContains}`);
      continue;
    }
    const newDate = new Date(`${r.newDate}T00:00:00Z`);
    if (row.date.getTime() === newDate.getTime()) {
      console.log(`revise skip (동일 날짜): ${r.ticker} ${r.newDate}`);
      continue;
    }
    const prevSources = Array.isArray(row.sources) ? (row.sources as object[]) : [];
    await prisma.calendarEvent.update({
      where: { id: row.id },
      data: {
        date: newDate,
        dateStatus: "revised",
        description: `${row.description} ※ ${r.note}.`,
        sources: [...prevSources, LGG],
      },
    });
    console.log(`revised: ${r.ticker} → ${r.newDate} (${r.note})`);
  }

  console.log(`완료 — 신규 ${created}건 / 후보 ${EVENTS.length}건 + 정정 ${REVISIONS.length}건`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
