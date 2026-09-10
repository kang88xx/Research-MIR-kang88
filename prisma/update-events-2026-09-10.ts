import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

// .env → .env.local 순으로 로드 (Prisma 클라이언트는 .env.local을 읽지 않는다)
for (const file of [".env", ".env.local"]) {
  try {
    for (const line of readFileSync(resolve(process.cwd(), file), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const val = m[2].replace(/^(['"])(.*)\1$/, "$2");
      if (file === ".env.local" || !(m[1] in process.env)) process.env[m[1]] = val;
    }
  } catch {}
}

const prisma = new PrismaClient();

// 2026-09-10 캘린더 검증 업데이트 — Layergg(@layerggofficial) 9월 캘린더·최근 포스트 재대조 + 임박 추정 항목 확정.
// Layergg 확인 경로: X 직접 조회는 로그인 벽(403)·nitter 미러는 봇 차단이라, 같은 글을 미러하는 공개 텔레그램 채널
// t.me/s/layergg 프리뷰로 9/1 캘린더 포스트와 9/7~9/10 포스트를 확인했다. 9/1 캘린더 항목은 9/2 반영분과 일치(신규 없음),
// 9/10 Arc 포스트 "6 days left" = 9/16 메인넷(#265)과 일치.
// 근거(웹 검증 2026-09-10):
//  - CLARITY(#257): 튠 원내대표가 8/8 클로처 동의안 제출 → 9/15 14:15 ET 본회의 클로처(motion to proceed) 표결 확정 (The Block·CoinDesk)
//  - EGLD(#275): 슈퍼노바 메인넷 v2.0.6.0, 에폭 2233 = 9/10 18:06 UTC 활성화, 약 24분 거래 중단 (CryptoSlate)
//  - BYBIT(#279): 주식 무기한 계약 기반 USDT 옵션 9/17 20:00 UTC 출시, NVDA·SPCX부터 (Bybit 보도자료·FinanceFeeds)
//  - APT(#139): 9/11 1,131만 APT(약 709만달러, 유통량 0.65%) 언락, 코어 기여자 396만 (BeInCrypto·KuCoin)
//  - VET(#266) 9/16 블록 25,902,540 추정·SEC/CFTC(#278) 9/16 예상: 변동 없음(추정 유지)
//  - 텔레그램 자동 포착 #291·#292는 상장 공지가 아님(파시피카 타운홀 요약·로빈후드 IPO 인수단 기사) → archived
//  - 추가: ETH 글램스터담 세폴리아 테스트넷 포크 9/28 14:44 UTC(잠정, 다음 ACD 콜에서 확정) — 메인넷 아님
// 실행: node --import file:///<loader>/register.mjs prisma/update-events-2026-09-10.ts (멱등 — 재실행 안전)

const LGG = { name: "Layergg (X) 9월 캘린더", url: "https://x.com/layerggofficial/status/2094725653669294182", tier: 3, isOfficial: false };

type Src = { name: string; url: string; tier: number; isOfficial: boolean };

const UPDATES: {
  id: number;
  expectTicker: string;
  set: {
    date?: string;
    isTba?: boolean;
    title?: string;
    description?: string;
    dateStatus?: string;
    reviewStatus?: string;
    sourceUrl?: string;
    sources?: Src[];
    nextCheck?: string | null;
  };
}[] = [
  {
    id: 257,
    expectTicker: "US",
    set: {
      date: "2026-09-15T18:15:00Z", // 9/15 14:15 ET = 9/16 03:15 KST
      isTba: false,
      title: "미 상원 CLARITY 법안 클로처 표결 (현지 9/15 14:15 ET)",
      description:
        "튠 원내대표가 8/8 휴회 직전 클로처 동의안을 제출해 9/15 오후 2시 15분(ET, 한국시간 16일 새벽 3시 15분) 본회의 표결이 확정됐다. 법안 심의 개시(motion to proceed)에 대한 토론 종결 표결로 60표가 필요해 공화 53석에 민주·무소속 7표 이상이 붙어야 한다. 통과 시 본회의 토론·수정안 단계로, 부결 시 2026년 내 처리는 사실상 무산된다. 윤리 규정 집행 주체·스테이블코인 리워드·개발자 보호 범위 3개 쟁점이 미해결.",
      dateStatus: "confirmed",
      reviewStatus: "published",
      sourceUrl: "https://www.theblock.co/news/regulation/2026-08-08-majority-leader-thune-files-cloture-on-clarity-act-setting-up-sept-15-senate-vote-411211",
      sources: [
        { name: "The Block", url: "https://www.theblock.co/news/regulation/2026-08-08-majority-leader-thune-files-cloture-on-clarity-act-setting-up-sept-15-senate-vote-411211", tier: 2, isOfficial: false },
        { name: "CoinDesk", url: "https://www.coindesk.com/policy/2026/08/08/u-s-senate-opens-first-stage-of-crypto-clarity-act-voting-to-give-bill-a-chance-next-month", tier: 2, isOfficial: false },
        LGG,
      ],
      nextCheck: "2026-09-15T00:00:00Z",
    },
  },
  {
    id: 275,
    expectTicker: "EGLD",
    set: {
      date: "2026-09-10T18:06:00Z", // 9/11 03:06 KST
      title: "멀티버스X(EGLD) 슈퍼노바 하드포크 활성화 (에폭 2233)",
      description:
        "멀티버스X 슈퍼노바 메인넷 릴리스 v2.0.6.0이 에폭 2233(9/10 18:06 UTC, 한국시간 11일 새벽 3시 6분)에 활성화된다. 블록 타임을 6초에서 0.6초로 줄이는 하드포크로, 전환 과정에서 약 24분간 신규 거래가 중단된다. 발표 하루 만에 메인넷 노드 84%가 업그레이드를 마쳤다.",
      dateStatus: "confirmed",
      sourceUrl: "https://cryptoslate.com/a-major-layer-1-chain-will-pause-new-transactions-for-24-minutes-to-unlock-a-10x-speed-boost/",
      sources: [
        { name: "CryptoSlate", url: "https://cryptoslate.com/a-major-layer-1-chain-will-pause-new-transactions-for-24-minutes-to-unlock-a-10x-speed-boost/", tier: 2, isOfficial: false },
        LGG,
      ],
    },
  },
  {
    id: 279,
    expectTicker: "BYBIT",
    set: {
      date: "2026-09-17T20:00:00Z", // 9/18 05:00 KST
      title: "바이비트, 주식 무기한 계약 옵션(Perp Options) 출시 (NVDA·SPCX)",
      description:
        "바이비트가 9/17 20:00 UTC(한국시간 18일 새벽 5시) 주식 무기한 계약을 기초로 하는 USDT 결제 유럽형 옵션을 출시한다. 엔비디아(NVDA)와 합성 스페이스X(SPCX) 계약부터 시작해 테슬라·QQQ·SOXL·마이크론이 뒤따른다. 24시간 거래되는 업계 첫 상품이며, OCC 청산 상장 옵션이 아니라 자사 주식 무기한 계약을 기초로 하는 현금 결제 계약이다.",
      dateStatus: "confirmed",
      sourceUrl: "https://www.bybit.com/en/press/post/bybit-teases-industry-first-perp-options-unlocking-247-us-equity-options-trading-bb3aae7e6c3eb14ba88",
      sources: [
        { name: "Bybit 보도자료", url: "https://www.bybit.com/en/press/post/bybit-teases-industry-first-perp-options-unlocking-247-us-equity-options-trading-bb3aae7e6c3eb14ba88", tier: 1, isOfficial: true },
        { name: "FinanceFeeds", url: "https://financefeeds.com/bybit-sets-17-september-launch-for-options-on-stock-perpetuals/", tier: 2, isOfficial: false },
        LGG,
      ],
    },
  },
  {
    id: 139,
    expectTicker: "APT",
    set: {
      description:
        "앱토스 월간 정기 언락 1,131만 APT(약 709만달러, 유통량의 0.65%)가 9/11 풀린다. 이 가운데 396만 APT는 코어 기여자 배정분이다. 월간 리니어 언락의 사실상 마지막 회차. (출처: Tokenomist·BeInCrypto·KuCoin)",
      dateStatus: "confirmed",
      sources: [
        { name: "Tokenomist", url: "https://tokenomist.ai/aptos/unlock-events", tier: 2, isOfficial: false },
        { name: "BeInCrypto", url: "https://beincrypto.com/token-unlocks-second-week-of-september-2026/", tier: 3, isOfficial: false },
        { name: "KuCoin News", url: "https://www.kucoin.com/news/flash/three-major-token-unlocks-to-watch-in-second-week-of-september-2026", tier: 3, isOfficial: false },
      ],
      nextCheck: null,
    },
  },
];

// 텔레그램 자동 포착 오탐 — 상장 공지가 아닌 일반 뉴스 요약이 후보로 잡힌 건. 아카이브(삭제 대신 보존).
const ARCHIVE_IDS: { id: number; expectTitle: string }[] = [
  { id: 291, expectTitle: "코인 상장 후보 (텔레그램 포착)" },
  { id: 292, expectTitle: "코인 상장 후보 (텔레그램 포착)" },
];

const ADDS: {
  date: string;
  ticker: string;
  title: string;
  description: string;
  category: string;
  groupMain: string;
  groupSub: string;
  importance: number;
  dateStatus: string;
  nextCheck?: string;
  sources: Src[];
}[] = [
  {
    date: "2026-09-28T14:44:00Z", // 9/28 23:44 KST
    ticker: "ETH",
    title: "이더리움 글램스터담, 세폴리아 테스트넷 포크 (잠정)",
    description:
      "이더리움 차기 하드포크 글램스터담의 세폴리아 테스트넷 활성화가 9/28 14:44 UTC(에폭 351,232, 한국시간 23시 44분)로 잠정 제안됐다. 직전 테스트에서 빌더 기능 관련 클라이언트 이슈가 나와 추가 데브넷 이후 다음 개발자 콜에서 확정한다. 메인넷 활성화는 4분기 목표로 날짜 미정.",
    category: "neutral",
    groupMain: "크립토",
    groupSub: "프로젝트",
    importance: 1,
    dateStatus: "estimated",
    nextCheck: "2026-09-21T00:00:00Z",
    sources: [
      { name: "CryptoTicker", url: "https://cryptoticker.io/en/ethereum-glamsterdam-date-sepolia-fork/", tier: 3, isOfficial: false },
      { name: "Crypto Benelux", url: "https://cryptobenelux.com/ethereum-nieuws/ethereum-mikt-op-28-september-voor-glamsterdam-na-testproblemen", tier: 3, isOfficial: false },
    ],
  },
];

async function main() {
  for (const u of UPDATES) {
    const cur = await prisma.calendarEvent.findUnique({ where: { id: u.id } });
    if (!cur) {
      console.log(`SKIP #${u.id}: 없음`);
      continue;
    }
    if (cur.ticker !== u.expectTicker) {
      console.log(`SKIP #${u.id}: 티커 불일치 (${cur.ticker} != ${u.expectTicker})`);
      continue;
    }
    const { date, nextCheck, ...rest } = u.set;
    await prisma.calendarEvent.update({
      where: { id: u.id },
      data: {
        ...rest,
        ...(date ? { date: new Date(date) } : {}),
        ...(nextCheck !== undefined ? { nextCheck: nextCheck ? new Date(nextCheck) : null } : {}),
      },
    });
    console.log(`UPDATE #${u.id} ${cur.ticker}: ${u.set.title ?? cur.title} → ${u.set.dateStatus ?? cur.dateStatus}/${u.set.reviewStatus ?? cur.reviewStatus}`);
  }

  for (const a of ARCHIVE_IDS) {
    const cur = await prisma.calendarEvent.findUnique({ where: { id: a.id } });
    if (!cur || cur.title !== a.expectTitle) {
      console.log(`SKIP archive #${a.id}: 없음/제목 불일치`);
      continue;
    }
    if (cur.reviewStatus === "archived") {
      console.log(`SKIP archive #${a.id}: 이미 archived`);
      continue;
    }
    await prisma.calendarEvent.update({ where: { id: a.id }, data: { reviewStatus: "archived" } });
    console.log(`ARCHIVE #${a.id}: ${cur.title} (${cur.description.slice(0, 40)}…)`);
  }

  for (const e of ADDS) {
    const d = new Date(e.date);
    const lo = new Date(d.getTime() - 3 * 86400_000);
    const hi = new Date(d.getTime() + 3 * 86400_000);
    const dup = await prisma.calendarEvent.findFirst({
      where: { ticker: e.ticker, date: { gte: lo, lte: hi }, title: { contains: "글램스터담" } },
    });
    if (dup) {
      console.log(`SKIP add ${e.ticker} ${e.date}: 이미 존재 #${dup.id}`);
      continue;
    }
    const created = await prisma.calendarEvent.create({
      data: {
        date: d,
        ticker: e.ticker,
        title: e.title,
        description: e.description,
        category: e.category,
        groupMain: e.groupMain,
        groupSub: e.groupSub,
        importance: e.importance,
        dateStatus: e.dateStatus,
        reviewStatus: "published",
        sourceUrl: e.sources[0].url,
        sources: e.sources,
        nextCheck: e.nextCheck ? new Date(e.nextCheck) : null,
      },
    });
    console.log(`ADD #${created.id} ${e.ticker} ${e.date}: ${e.title}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
