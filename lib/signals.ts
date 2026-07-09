// 지표 → "한 줄 해석" 룰 엔진 (카드별 수기 문자열 대신 한 곳에서 관리)
// tone은 가격 색(빨강=상승, 파랑=하락)과 구분되는 "주의 단계" 체계:
//   calm(정상) → note(참고) → caution(주의) → alert(경계)
// 색이 가격 등락을 의미하지 않으므로 매수/매도 신호로 오해되지 않는다.

export type SignalTone = "calm" | "note" | "caution" | "alert";
export type Signal = { label: string; tone: SignalTone };

export function toneClass(tone: SignalTone): string {
  switch (tone) {
    case "alert":
      return "bg-up-bg text-up"; // 경계 — 레드 틴트
    case "caution":
      return "bg-warn-bg text-warn"; // 주의 — 앰버 틴트
    case "note":
      return "bg-info-bg text-info"; // 참고 — 블루 틴트
    default:
      return "bg-navy-100 text-ink-500"; // 정상 — 그레이
  }
}

// 김치프리미엄 — 전통 김프(국내 BTC / 해외 BTC×환율). 환율오차·USDT베이시스가 섞여
// 정밀 신호는 아니므로 라벨도 "주의" 톤에서 단정적이지 않게 표현.
export function kimchiSignal(v: number | null): Signal | null {
  if (v == null) return null;
  if (v < -1) return { label: "역프 · 국내 약세", tone: "note" };
  if (v < 1) return { label: "정상 범위", tone: "calm" };
  if (v < 3) return { label: "국내 수요 우위", tone: "note" };
  if (v < 5) return { label: "과열 주의", tone: "caution" };
  return { label: "추격매수 위험", tone: "alert" };
}

// USDT/KRW 베이시스 — 원화 자금 압력 (김프와 별개로 분해해서 노출)
export function usdtBasisSignal(v: number | null): Signal | null {
  if (v == null) return null;
  if (v < -0.5) return { label: "원화 유동성 완화", tone: "note" };
  if (v < 0.5) return { label: "정상 범위", tone: "calm" };
  if (v < 1.5) return { label: "원화 매수압력", tone: "note" };
  if (v < 3) return { label: "강한 대기수요", tone: "caution" };
  return { label: "입출금/환율 왜곡 경계", tone: "alert" };
}

// 시장 폭(breadth) — 유동성 필터 후 상승종목 비율(%). 양 극단(약세/과열)을 주의로.
export function breadthSignal(upRatio: number | null): Signal | null {
  if (upRatio == null) return null;
  const pct = upRatio * 100;
  if (pct < 30) return { label: "약세장", tone: "caution" };
  if (pct < 45) return { label: "부진", tone: "note" };
  if (pct < 55) return { label: "중립", tone: "calm" };
  if (pct < 70) return { label: "강세", tone: "note" };
  return { label: "전면 강세 · 단기 과열", tone: "caution" };
}

// 시그널 레이더 reason chip — 코인별 "지금 주목할 이유"를 한 곳에서 생성.
// listing: 오늘 상장 칩(거래소·유형별로 호출부에서 라벨/톤을 만들어 전달).
// fxEstimated: 환율이 추정치(fallback)면 김프 칩은 가짜 신호가 되므로 표시하지 않는다.
export function radarChips(
  c: { volumeRank: number; change24h: number; kimchi: number | null },
  opts: {
    event?: boolean;
    listing?: Signal;
    trend?: string;
    listingPotential?: string;
    fxEstimated?: boolean;
  } = {}
): Signal[] {
  const chips: Signal[] = [];
  if (c.volumeRank <= 3) chips.push({ label: `거래대금 ${c.volumeRank}위`, tone: "note" });
  if (opts.trend) {
    const tone: SignalTone = opts.trend === "과매수" ? "caution" : "note";
    chips.push({ label: opts.trend, tone });
  }
  if (c.change24h >= 10) chips.push({ label: `급등 +${c.change24h.toFixed(1)}%`, tone: "caution" });
  else if (c.change24h >= 5) chips.push({ label: `상승 +${c.change24h.toFixed(1)}%`, tone: "note" });
  else if (c.change24h <= -10) chips.push({ label: `급락 ${c.change24h.toFixed(1)}%`, tone: "caution" });
  else if (c.change24h <= -5) chips.push({ label: `하락 ${c.change24h.toFixed(1)}%`, tone: "note" });
  if (c.kimchi != null && !opts.fxEstimated) {
    if (c.kimchi >= 3) chips.push({ label: `김프 과열 +${c.kimchi.toFixed(1)}%`, tone: "caution" });
    else if (c.kimchi <= -1) chips.push({ label: `역프 ${c.kimchi.toFixed(1)}%`, tone: "note" });
  }
  if (opts.listing) chips.push(opts.listing);
  // 교차상장 신호 — 여러 거래소에 상장됐는데 빠진 곳이 있으면 "○○ 상장 후보"(공지 근거 아닌 휴리스틱이라 단정 표현 회피)
  if (opts.listingPotential) chips.push({ label: `${opts.listingPotential} 상장 후보`, tone: "note" });
  if (opts.event) chips.push({ label: "오늘 일정", tone: "note" });
  return chips;
}

// 공포탐욕 — 커스텀 구간 대신 제공자(alternative.me) 분류 라벨에 해석만 매핑
export function fngSignal(classification: string): Signal {
  switch (classification) {
    case "Extreme Fear":
      return { label: "분할 관심 구간", tone: "note" };
    case "Fear":
      return { label: "리스크 관찰", tone: "note" };
    case "Neutral":
      return { label: "방향성 탐색", tone: "calm" };
    case "Greed":
      return { label: "추격 주의", tone: "caution" };
    case "Extreme Greed":
      return { label: "과열 경계", tone: "alert" };
    default:
      return { label: "—", tone: "calm" };
  }
}
