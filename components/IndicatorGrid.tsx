"use client";

// 각종 지표 전용 페이지 — 대시보드 12개 지표를 그대로 쓰되(같은 getMarketBar 캐시,
// 추가 외부 호출 0), 카드마다 설명 한 줄을 붙이고 클릭 시 상세 모달(해석·산출 방식·
// 출처 링크·최근 추이)을 연다.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import type { BarTile } from "@/lib/marketbar";
import { formatPercent } from "@/lib/format";
import Sparkline from "@/components/Sparkline";

// 등락 색 — 한국식 (상승=레드, 하락=블루). MarketBar와 동일 문법.
function dir(n: number | null): { text: string; stroke: string } {
  if (n != null && n > 0) return { text: "text-up", stroke: "var(--color-up)" };
  if (n != null && n < 0) return { text: "text-down", stroke: "var(--color-down)" };
  return { text: "text-neutral", stroke: "var(--color-neutral)" };
}

function fngColor(v: number): string {
  if (v < 25) return "var(--color-up)";
  if (v < 45) return "var(--color-warn)";
  if (v < 55) return "var(--color-neutral)";
  if (v < 75) return "var(--color-live)";
  return "var(--color-good)";
}

// ── 지표별 정적 메타 — 설명·해석·산출·출처 (데이터 아님 → 트래픽 0) ──
type SourceLink = { label: string; url: string };
type Meta = {
  short: string; // 카드에 붙는 한 줄 설명
  what: string; // 이 지표는?
  read: string; // 해석 가이드
  method: string; // 산출 방식
  update: string; // 갱신 주기
  sources: SourceLink[];
};

const META: Record<string, Meta> = {
  btc: {
    short: "글로벌 기축 크립토 — 시장 전체의 방향타",
    what: "비트코인의 달러 표시 현재가입니다. 크립토 시장 전체 유동성과 심리를 대표하는 기준 자산으로, 알트코인 대부분이 BTC 방향에 동조합니다.",
    read: "전일 대비 등락과 함께 최근 한 달 추이(스파크라인)를 보세요. BTC가 급락하면 알트는 보통 더 크게 빠지고, BTC 횡보 구간에서 알트 순환매가 나타나는 경향이 있습니다.",
    method: "바이낸스 BTCUSDT 일봉 종가 시리즈에서 현재가·전일 종가·최근 24일 추이를 추출합니다.",
    update: "5분 캐시",
    sources: [
      { label: "바이낸스 BTCUSDT", url: "https://www.binance.com/en/trade/BTC_USDT" },
      { label: "코인게코 비트코인", url: "https://www.coingecko.com/ko/코인/bitcoin" },
      { label: "업비트 KRW-BTC", url: "https://upbit.com/exchange?code=CRIX.UPBIT.KRW-BTC" },
    ],
  },
  eth: {
    short: "스마트컨트랙트 대표 체인 — 알트 시장의 바로미터",
    what: "이더리움의 달러 표시 현재가입니다. 디파이·스테이블코인·L2 생태계의 기반 자산이라 알트코인 시장 심리를 대표합니다.",
    read: "ETH/BTC 상대 강도가 알트 시즌 판단에 자주 쓰입니다. ETH가 BTC보다 강하면 위험 선호(알트 강세) 신호로 해석되는 경우가 많습니다.",
    method: "바이낸스 ETHUSDT 일봉 종가 시리즈에서 현재가·전일 종가·최근 24일 추이를 추출합니다.",
    update: "5분 캐시",
    sources: [
      { label: "바이낸스 ETHUSDT", url: "https://www.binance.com/en/trade/ETH_USDT" },
      { label: "코인게코 이더리움", url: "https://www.coingecko.com/ko/코인/ethereum" },
      { label: "업비트 KRW-ETH", url: "https://upbit.com/exchange?code=CRIX.UPBIT.KRW-ETH" },
    ],
  },
  btcDom: {
    short: "전체 크립토 시총 중 BTC 비중 — 자금 쏠림 방향",
    what: "전체 암호화폐 시가총액에서 비트코인이 차지하는 비율(%)입니다. 시장 자금이 BTC와 알트 중 어디로 쏠리는지 보여줍니다.",
    read: "도미넌스 상승은 BTC로의 자금 집중(알트 약세 경향), 하락은 알트로의 자금 분산(알트 시즌 기대)으로 읽습니다. 급락장에선 스테이블코인 도미넌스와 함께 봐야 정확합니다.",
    method: "CoinGecko 글로벌 시총 데이터를 5분 간격 스냅샷으로 적재하고, KST 일자별 마지막 값으로 6일 추세를 구성합니다.",
    update: "5분 스냅샷 · 추세는 일 단위",
    sources: [
      { label: "코인게코 글로벌 차트", url: "https://www.coingecko.com/ko/global-charts" },
      { label: "TradingView BTC.D", url: "https://www.tradingview.com/symbols/CRYPTOCAP-BTC.D/" },
    ],
  },
  fng: {
    short: "시장 심리 온도계 — 0(공포) ~ 100(탐욕)",
    what: "변동성·거래량·소셜 언급·도미넌스 등을 합성해 0~100으로 나타낸 크립토 시장 심리 지수입니다(BTC 중심).",
    read: "극단적 공포(25 미만)는 역발상 매수 관심 구간, 극단적 탐욕(75 이상)은 과열 경계 구간으로 흔히 해석합니다. 단독 매매 신호보다는 포지션 크기 조절 참고용으로 쓰는 것이 일반적입니다.",
    method: "alternative.me가 변동성·모멘텀·소셜·설문·도미넌스·트렌드 6개 요소를 가중 합성해 일 1회 산출합니다.",
    update: "일 1회 (UTC 자정 부근) · 5분 캐시",
    sources: [
      {
        label: "alternative.me Fear & Greed",
        url: "https://alternative.me/crypto/fear-and-greed-index/",
      },
    ],
  },
  usdtKimchi: {
    short: "국내 자금 유입 강도 — 테더 원화가 vs 환율",
    what: "업비트 테더(USDT) 원화 가격이 공식 환율 대비 얼마나 비싼지(%)입니다. 개별 코인 김프보다 순수한 '원화 자금 유입 압력'을 보여줍니다.",
    read: "플러스(+)는 국내 매수 수요 우위, 마이너스(역프)는 수요 위축·자금 유출 신호입니다. ±0.5% 이내는 중립, +3% 이상은 과열로 자주 해석합니다.",
    method: "업비트 KRW-USDT 현재가 ÷ USD/KRW 환율 − 1. 6일 추이는 업비트 일봉 종가와 해당일 환율로 계산합니다.",
    update: "5분 캐시",
    sources: [
      { label: "업비트 KRW-USDT", url: "https://upbit.com/exchange?code=CRIX.UPBIT.KRW-USDT" },
      { label: "김치프리미엄 페이지", url: "/kimchi" },
    ],
  },
  fx: {
    short: "원·달러 환율 — 김프·해외 자산 환산의 기준",
    what: "미국 달러 대비 원화 환율입니다. 김치프리미엄 계산과 해외 자산의 원화 체감 가격을 좌우하는 기준값입니다.",
    read: "환율이 오르면(원화 약세) 같은 달러 가격이라도 원화 표시 가격이 올라 김프가 눌리는 효과가 있습니다. 급등 구간에선 김프 수치 해석에 주의하세요.",
    method: "Yahoo Finance KRW=X 장중 시세를 우선 사용하고, 실패 시 ECB(Frankfurter) 고시환율로 폴백합니다.",
    update: "15분 캐시",
    sources: [
      { label: "Yahoo Finance USD/KRW", url: "https://finance.yahoo.com/quote/KRW=X/" },
      { label: "Frankfurter (ECB)", url: "https://frankfurter.dev/" },
    ],
  },
  mstr: {
    short: "비트코인 최다 보유 상장사 — BTC 프록시 주식",
    what: "스트래티지(구 마이크로스트래티지, MSTR)의 주가와 비트코인 트레저리 현황입니다. 세계 최대 BTC 보유 기업이라 'BTC 레버리지 프록시'로 거래됩니다.",
    read: "주가는 BTC보다 변동성이 크게 움직이는 경향이 있습니다. 보유량 증가(추가 매수) 공시는 시장 수급에 직접 영향을 주는 이벤트입니다. 평단 대비 수익률로 회사의 BTC 포지션 건전성을 가늠할 수 있습니다.",
    method: "주가는 Yahoo Finance, 보유량·평단은 CoinGecko 기업 트레저리 공개 데이터를 사용하고, 보유량 변동은 KST 일 단위 기준값과 비교합니다.",
    update: "5분 캐시",
    sources: [
      { label: "Yahoo Finance MSTR", url: "https://finance.yahoo.com/quote/MSTR/" },
      {
        label: "코인게코 기업 BTC 보유 현황",
        url: "https://www.coingecko.com/en/public-companies-bitcoin",
      },
    ],
  },
  btcBreakeven: {
    short: "채굴 원가선 — 역사적 바닥 지지선 참고",
    what: "네트워크 해시레이트·전력 단가 기준으로 추정한 BTC 1개 평균 채굴 원가입니다. 현재가가 이 아래면 평균적인 채굴자는 손실 구간입니다.",
    read: "역사적으로 현재가가 채굴 원가 부근·이하로 내려간 구간은 중장기 바닥권과 겹치는 경우가 많았습니다. 다만 채굴 효율·전기료 가정에 따라 추정치가 달라지는 참고 지표입니다.",
    method: "blockchain.info 해시레이트를 기반으로 평균 채굴 효율·전력 단가를 가정해 6시간마다 자체 계산(크론)합니다.",
    update: "6시간 크론",
    sources: [
      {
        label: "Blockchain.com 해시레이트",
        url: "https://www.blockchain.com/explorer/charts/hash-rate",
      },
      {
        label: "MacroMicro 채굴 원가",
        url: "https://en.macromicro.me/charts/29435/bitcoin-production-total-cost",
      },
    ],
  },
  nasdaq: {
    short: "미국 기술주 지수 — 크립토와 동조성 높은 위험자산",
    what: "나스닥 종합지수입니다. 기술주 중심의 위험자산 선호도를 보여주며, 2020년 이후 BTC와의 상관관계가 높아졌습니다.",
    read: "나스닥 급락일에는 크립토도 위험 회피 매도가 나오는 경우가 많습니다. 대표 종목(코인베이스·엔비디아)은 크립토·AI 수급의 프록시로 함께 표시합니다.",
    method: "Yahoo Finance ^IXIC 일봉에서 현재가·전일 종가·최근 24일 추이를 추출합니다.",
    update: "5분 캐시",
    sources: [
      { label: "Yahoo Finance ^IXIC", url: "https://finance.yahoo.com/quote/%5EIXIC/" },
      { label: "코인베이스(COIN)", url: "https://finance.yahoo.com/quote/COIN/" },
    ],
  },
  kospi: {
    short: "한국 대형주 지수 — 국내 투자 심리",
    what: "코스피 지수입니다. 국내 주식시장 대형주의 흐름으로, 원화 자산 전반의 투자 심리를 보여줍니다.",
    read: "국내 증시가 약할 때 개인 자금이 크립토로 이동하는 경향이 관찰되기도 합니다. 삼성전자·SK하이닉스 등 대표 종목과 함께 보세요.",
    method: "Yahoo Finance ^KS11 일봉에서 현재가·전일 종가·최근 24일 추이를 추출합니다.",
    update: "5분 캐시",
    sources: [{ label: "Yahoo Finance ^KS11", url: "https://finance.yahoo.com/quote/%5EKS11/" }],
  },
  kosdaq: {
    short: "한국 성장주 지수 — 국내 위험 선호도",
    what: "코스닥 지수입니다. 중소형 성장주 중심이라 국내 개인 투자자의 위험 선호도를 민감하게 반영합니다.",
    read: "코스닥 강세는 국내 위험자산 선호(크립토에도 우호적), 급락은 위험 회피 신호로 참고할 수 있습니다.",
    method: "Yahoo Finance ^KQ11 일봉에서 현재가·전일 종가·최근 24일 추이를 추출합니다.",
    update: "5분 캐시",
    sources: [{ label: "Yahoo Finance ^KQ11", url: "https://finance.yahoo.com/quote/%5EKQ11/" }],
  },
  gold: {
    short: "전통 안전자산 — '디지털 금' 서사의 비교 대상",
    what: "금 선물(COMEX) 가격입니다. 인플레이션 헤지·안전자산 수요를 보여주며, BTC의 '디지털 금' 서사와 자주 비교됩니다.",
    read: "금과 BTC가 동반 강세면 법정화폐 약세(유동성 장세) 신호로, 금만 강세면 순수 위험 회피 국면으로 해석하는 시각이 많습니다.",
    method: "Yahoo Finance GC=F 일봉에서 현재가·전일 종가·최근 24일 추이를 추출합니다.",
    update: "5분 캐시",
    sources: [{ label: "Yahoo Finance 금 선물", url: "https://finance.yahoo.com/quote/GC=F/" }],
  },
};

// ── 카드 본문 — 타일 유형별 핵심 수치 (대시보드와 동일 데이터, 여백만 넉넉히) ──
function CardValue({ t }: { t: BarTile }) {
  if (t.fng) {
    const color = fngColor(t.fng.value);
    const pos = Math.min(100, Math.max(0, t.fng.value));
    return (
      <div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[22px] font-semibold leading-none tabular-nums" style={{ color }}>
            {t.fng.value}
          </span>
          <span className="text-[12px] font-semibold" style={{ color }}>
            {t.fng.label}
          </span>
        </div>
        <div
          className="relative mt-2 h-[7px] rounded-[4px]"
          style={{ background: "linear-gradient(90deg,var(--color-up),var(--color-warn),var(--color-good))" }}
        >
          <span
            className="absolute -top-1 h-[15px] w-[3px] -translate-x-1/2 rounded-[2px] bg-navy-900"
            style={{ left: `${pos}%` }}
          />
        </div>
      </div>
    );
  }
  if (t.usdt) {
    const km = dir(t.usdt.tetherKimchi);
    return (
      <div className="flex items-baseline gap-2">
        <span className={`font-mono text-[22px] font-semibold leading-none tabular-nums ${km.text}`}>
          {t.usdt.tetherKimchi != null ? formatPercent(t.usdt.tetherKimchi) : "-"}
        </span>
        <span className="font-mono text-[12px] font-medium tabular-nums text-navy-600">
          {t.usdt.tetherKrw != null ? `${Math.round(t.usdt.tetherKrw).toLocaleString("ko-KR")}원` : "-"}
        </span>
      </div>
    );
  }
  if (t.mining) {
    const loss = t.mining.pricePct != null && t.mining.pricePct < 0;
    const col =
      t.mining.pricePct == null ? "var(--color-neutral)" : loss ? "var(--color-up)" : "var(--color-good)";
    return (
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[22px] font-semibold leading-none tabular-nums text-navy-900">
          {t.value}
        </span>
        {t.mining.pricePct != null && (
          <span className="text-[12px] font-semibold whitespace-nowrap" style={{ color: col }}>
            {loss ? "채굴 손실" : "채굴 이익"} {formatPercent(t.mining.pricePct)}
          </span>
        )}
      </div>
    );
  }
  if (t.dom6) {
    const vals = t.dom6.map((d) => d.value);
    const last = vals.length ? vals[vals.length - 1] : null;
    const prev = vals.length >= 2 ? vals[vals.length - 2] : null;
    const deltaPp = last != null && prev != null ? last - prev : null;
    const d = dir(deltaPp);
    return (
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[22px] font-semibold leading-none tabular-nums text-navy-900">
          {t.value}
        </span>
        {deltaPp != null && (
          <span className={`font-mono text-[11.5px] font-medium tabular-nums ${d.text}`}>
            전일 {deltaPp > 0 ? "+" : ""}
            {deltaPp.toFixed(2)}%p
          </span>
        )}
      </div>
    );
  }
  const c = dir(t.changePct);
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-mono text-[22px] font-semibold leading-none tabular-nums text-navy-900">
        {t.value}
      </span>
      {t.changePct != null && (
        <span className={`font-mono text-[11.5px] font-medium tabular-nums ${c.text}`}>
          {formatPercent(t.changePct)}
        </span>
      )}
    </div>
  );
}

// 카드 우측 추이 — spark / dom6 / fng.history / kimchiSpark / fx6 중 있는 것 하나
// (구 형태 캐시 행에 spark가 없을 수 있어 옵셔널 접근 — 카드 하나 때문에 페이지가 죽지 않게)
function cardSeries(t: BarTile): { values: number[]; stroke: string; baseline?: number } | null {
  if ((t.spark?.length ?? 0) >= 2) return { values: t.spark, stroke: dir(t.changePct).stroke };
  if (t.dom6 && t.dom6.length >= 2) {
    const vals = t.dom6.map((d) => d.value);
    return { values: vals, stroke: dir(vals[vals.length - 1] - vals[vals.length - 2]).stroke };
  }
  if (t.fng && t.fng.history.length >= 2)
    return { values: [...t.fng.history.map((h) => h.value), t.fng.value], stroke: fngColor(t.fng.value) };
  if (t.usdt && t.usdt.kimchiSpark.length >= 2) {
    const vals = t.usdt.kimchiSpark;
    return { values: vals, stroke: dir(vals[vals.length - 1]).stroke, baseline: 0 };
  }
  if (t.fx && t.fx.fx6.length >= 2) {
    const vals = t.fx.fx6.map((d) => d.rate);
    return { values: vals, stroke: dir(vals[vals.length - 1] - vals[vals.length - 2]).stroke };
  }
  return null;
}

// ── 상세 모달 — 현재값 + 큰 추이 + 설명·해석·산출·출처 ──
function DetailModal({ t, onClose }: { t: BarTile; onClose: () => void }) {
  const meta = META[t.key];
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [chartW, setChartW] = useState(430);

  // 모달 동작 보장 — ESC 닫기 + 포커스 트랩(Tab 순환) + 열 때 진입/닫을 때 복귀 + 배경 스크롤 잠금
  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [onClose]);

  // 차트 폭 — 모달 실측(최대 430px). 고정폭이 좁은 화면에서 최근 값 쪽이 잘리던 문제 방지.
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const measure = () => setChartW(Math.max(200, Math.min(430, el.clientWidth - 56)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const series = cardSeries(t);

  // 날짜 라벨이 있는 최근 추이 목록 (있는 유형만)
  const rows: { date: string; text: string }[] = t.dom6
    ? t.dom6.map((d) => ({ date: d.date, text: `${d.value.toFixed(2)}%` }))
    : t.fng
      ? t.fng.history.map((h) => ({ date: h.date, text: String(h.value) }))
      : t.fx
        ? t.fx.fx6.map((d) => ({
            date: d.date,
            text: Math.round(d.rate).toLocaleString("ko-KR"),
          }))
        : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto border border-line bg-white sm:rounded-[6px]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t.label}
      >
        <header className="sticky top-0 flex items-center gap-2 border-b border-line bg-white px-5 py-3.5">
          <h3 className="text-[15px] font-bold text-navy-900">{t.label}</h3>
          {meta && <span className="hidden text-[10.5px] text-ink-400 sm:inline">{meta.update}</span>}
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="닫기"
            className="ml-auto grid h-6 w-6 place-items-center rounded text-[15px] leading-none text-ink-400 hover:bg-paper2 hover:text-navy-900"
          >
            ×
          </button>
        </header>

        <div className="flex flex-col gap-5 px-5 py-4">
          {/* 현재값 + 큰 추이 */}
          <div>
            <CardValue t={t} />
            {series && (
              <div className="mt-3 overflow-hidden rounded-[5px] border border-hairline bg-paper2/60 px-2 py-2">
                <Sparkline
                  values={series.values}
                  width={chartW}
                  height={64}
                  stroke={series.stroke}
                  baseline={series.baseline}
                />
              </div>
            )}
            {rows.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-ink-400">
                {rows.map((r) => (
                  <span key={r.date} className="flex items-baseline gap-1">
                    <span className="text-ink-300">{r.date}</span>
                    <b className="font-semibold tabular-nums text-navy-700">{r.text}</b>
                  </span>
                ))}
              </div>
            )}
            {/* MSTR 트레저리 상세 */}
            {t.treasury && (
              <dl className="mt-3 grid grid-cols-3 gap-x-3 gap-y-2 border-t border-hairline pt-3 text-center">
                <div>
                  <dt className="text-[10px] text-ink-500">보유 BTC</dt>
                  <dd className="mt-0.5 font-mono text-[12.5px] font-semibold tabular-nums text-navy-900">
                    {Math.round(t.treasury.holdings).toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] text-ink-500">평단가</dt>
                  <dd className="mt-0.5 font-mono text-[12.5px] font-semibold tabular-nums text-navy-900">
                    ${Math.round(t.treasury.avgPriceUsd).toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] text-ink-500">평단 대비</dt>
                  <dd
                    className={`mt-0.5 font-mono text-[12.5px] font-semibold tabular-nums ${dir(t.treasury.returnPct).text}`}
                  >
                    {formatPercent(t.treasury.returnPct)}
                  </dd>
                </div>
              </dl>
            )}
            {/* 대표 종목 (나스닥·코스피) */}
            {t.stocks && t.stocks.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-hairline pt-3 text-[11.5px] text-ink-500">
                {t.stocks.map((s, i) => (
                  <span key={i} className="flex items-baseline gap-1.5">
                    {s.label}
                    <b className="font-mono font-semibold tabular-nums text-navy-900">{s.value}</b>
                    {s.changePct != null && (
                      <span className={`font-mono font-semibold tabular-nums ${dir(s.changePct).text}`}>
                        {formatPercent(s.changePct)}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>

          {meta && (
            <>
              <div>
                <h4 className="text-[11px] font-bold tracking-wide text-navy-600">이 지표는?</h4>
                <p className="mt-1 text-[12.5px] leading-[1.65] text-ink-900">{meta.what}</p>
              </div>
              <div>
                <h4 className="text-[11px] font-bold tracking-wide text-navy-600">해석 가이드</h4>
                <p className="mt-1 text-[12.5px] leading-[1.65] text-ink-900">{meta.read}</p>
              </div>
              <div>
                <h4 className="text-[11px] font-bold tracking-wide text-navy-600">산출 방식</h4>
                <p className="mt-1 text-[12.5px] leading-[1.65] text-ink-500">
                  {meta.method} <span className="text-ink-400">(갱신: {meta.update})</span>
                </p>
              </div>
              <div>
                <h4 className="text-[11px] font-bold tracking-wide text-navy-600">출처·바로가기</h4>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {meta.sources.map((s) =>
                    s.url.startsWith("/") ? (
                      // 내부 링크는 next/link — 풀 리로드 없이 클라이언트 내비게이션
                      <Link
                        key={s.url}
                        href={s.url}
                        className="rounded-[5px] border border-line px-2.5 py-1 text-[11.5px] font-medium text-navy-900 hover:border-navy-900"
                      >
                        {s.label}
                      </Link>
                    ) : (
                      <a
                        key={s.url}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-[5px] border border-line px-2.5 py-1 text-[11.5px] font-medium text-navy-900 hover:border-navy-900"
                      >
                        {s.label} ↗
                      </a>
                    )
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 그리드 본체 ──
export default function IndicatorGrid({ tiles }: { tiles: BarTile[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const open = openKey ? tiles.find((t) => t.key === openKey) ?? null : null;

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map((t) => {
          const meta = META[t.key];
          if (t.placeholder) {
            return (
              <div
                key={t.key}
                className="rounded-[6px] border border-dashed border-line bg-white/60 px-4 py-4"
              >
                <div className="text-[12px] font-semibold text-navy-900">{t.label}</div>
                <div className="mt-3 text-[11px] text-ink-300">{t.note ?? "데이터 수집 중…"}</div>
              </div>
            );
          }
          const series = cardSeries(t);
          return (
            <button
              key={t.key}
              onClick={() => setOpenKey(t.key)}
              className="group rounded-[6px] border border-line bg-white px-4 py-3.5 text-left transition-colors hover:border-navy-900"
            >
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold text-navy-900">{t.label}</span>
                <span className="ml-auto shrink-0 text-[10px] text-ink-300 transition-colors group-hover:text-navy-600">
                  자세히 →
                </span>
              </div>
              <div className="mt-2.5 flex items-end justify-between gap-3">
                <CardValue t={t} />
                {series && !t.fng && (
                  <span className="shrink-0">
                    <Sparkline
                      values={series.values}
                      width={92}
                      height={30}
                      stroke={series.stroke}
                      baseline={series.baseline}
                    />
                  </span>
                )}
              </div>
              {meta && (
                <p className="mt-2.5 border-t border-hairline pt-2 text-[10.5px] leading-[1.5] text-ink-500">
                  {meta.short}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {open && <DetailModal t={open} onClose={() => setOpenKey(null)} />}
    </>
  );
}
