import { getMarketBar, type BarTile } from "@/lib/marketbar";
import { formatPercent } from "@/lib/format";
import Spinner from "@/components/Spinner";
import Sparkline from "@/components/Sparkline";
import LiveSparkline from "@/components/LiveSparkline";
import MarketStatus, { type Mkt } from "@/components/MarketStatus";

// 2a 파이낸스 그레이드 — 12개 지표 카드 공통 셸 (radius 14 · 보더 기반 · 그림자 없음)
const CARD = "rounded-[6px] border border-line bg-white px-3 py-2";
// 제목행 — 캘린더 칩 기준 11.5px semibold
const TITLE = "flex items-center gap-[7px] text-[11.5px] font-semibold text-navy-900";
// 값행 숫자 — mono 16px semibold 단일 스케일 (codex 교차검증 2026-07-14: 15/16 혼용은
// 같은 그리드에서 리듬만 깨고 의미 없음 → 16px 통일, 모노 숫자에 음수 자간 제거)
const VAL = "font-mono text-[16px] font-semibold leading-none tabular-nums text-navy-900";
const VAL_LG = "font-mono text-[16px] font-semibold leading-none tabular-nums";
// 변동률 — mono 11px
const CHG = "font-mono text-[11px] font-medium tabular-nums whitespace-nowrap";
// 서브행 — 상단 헤어라인 + 9.5px(9px는 가독 한계 아래, 10px는 대표종목 라벨이 잘림), 가로 1줄 고정
const SUB = "mt-1 flex flex-nowrap items-baseline justify-between gap-x-1.5 overflow-hidden border-t border-hairline pt-1 text-[9.5px] text-ink-500";

// 등락 색: 한국식 (상승=빨강, 하락=파랑). 스파크라인 stroke는 CSS 변수로 — 다크 모드 자동 전환
function dir(n: number | null): { text: string; stroke: string } {
  if (n != null && n > 0) return { text: "text-up", stroke: "var(--color-up)" }; // 상승 — 레드
  if (n != null && n < 0) return { text: "text-down", stroke: "var(--color-down)" }; // 하락 — 블루
  return { text: "text-neutral", stroke: "var(--color-neutral)" };
}

// 타일 키 → 시장 구분 (장중/장마감 판별용). 2행 타일은 tile.market을 우선 사용.
function marketOf(t: BarTile): Mkt | null {
  if (t.market) return t.market;
  if (t.key === "nasdaq") return "us";
  if (t.key === "kospi" || t.key === "kosdaq") return "kr";
  if (t.key === "gold") return "gold";
  return null;
}

// 공포·탐욕 지수 색 — 공포=레드, 중립=그레이, 탐욕=그린 (지수 시맨틱 스케일은 유지하되
// 토큰 참조로 바꿔 팔레트·다크 모드와 동기화)
function fngColor(v: number): string {
  if (v < 25) return "var(--color-up)"; // 극단적 공포 — 레드
  if (v < 45) return "var(--color-warn)"; // 공포 — 오커
  if (v < 55) return "var(--color-neutral)"; // 중립
  if (v < 75) return "var(--color-live)"; // 탐욕
  return "var(--color-good)"; // 극단적 탐욕
}

// 공포·탐욕 지수 — 큰 수치 + 등급(800) + 그라디언트 바(레드→오렌지→그린) 위 다크 마커
function FngTile({ t }: { t: BarTile }) {
  const f = t.fng!;
  const color = fngColor(f.value);
  const pos = Math.min(100, Math.max(0, f.value));
  return (
    <div className={CARD}>
      <div className={TITLE}>{t.label}</div>
      <div className="mt-1 flex items-baseline gap-[9px]">
        <span className={VAL_LG} style={{ color }}>
          {f.value}
        </span>
        <span className="text-[11.5px] font-semibold" style={{ color }}>
          {f.label}
        </span>
      </div>
      <div
        className="relative mt-[7px] h-[7px] rounded-[4px]"
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

// 테더(USDT) 김프 — 큰 %(음수=블루) + 원화 환산가
function UsdtTile({ t }: { t: BarTile }) {
  const u = t.usdt!;
  const km = dir(u.tetherKimchi);
  return (
    <div className={CARD}>
      <div className={TITLE}>{t.label}</div>
      <div className="mt-1 flex items-baseline gap-[9px]">
        <span className={`${VAL_LG} ${km.text}`}>
          {u.tetherKimchi != null ? formatPercent(u.tetherKimchi) : "-"}
        </span>
        <span className="font-mono text-[11.5px] font-medium tabular-nums whitespace-nowrap text-navy-600">
          {u.tetherKrw != null ? `${Math.round(u.tetherKrw).toLocaleString("ko-KR")}원` : "-"}
        </span>
      </div>
    </div>
  );
}

// BTC 도미넌스 — 큰 값 + 전일 대비 등락(%p, 색상) + 우측 최근 6일 추이 스파크라인 (다른 카드와 동일한 문법)
function DomTile({ t }: { t: BarTile }) {
  const dom6 = t.dom6 ?? [];
  const vals = dom6.map((d) => d.value);
  const last = vals.length ? vals[vals.length - 1] : null;
  const prev = vals.length >= 2 ? vals[vals.length - 2] : null;
  const deltaPp = last != null && prev != null ? last - prev : null;
  const d = dir(deltaPp);
  return (
    <div className={CARD}>
      <div className="flex gap-2.5">
        <div className="min-w-0 flex-1">
          <div className={TITLE}>{t.label}</div>
          <div className="mt-1 flex items-baseline gap-[9px]">
            <span className={`${VAL_LG} text-navy-900`}>{t.value}</span>
            {deltaPp != null && (
              <span className={`${CHG} ${d.text}`}>
                전일 {deltaPp > 0 ? "+" : ""}
                {deltaPp.toFixed(2)}%p
              </span>
            )}
          </div>
        </div>
        {vals.length >= 2 && (
          <span
            className="shrink-0 pt-0.5"
            title={dom6.map((x) => `${x.date} ${x.value.toFixed(2)}%`).join(" · ")}
          >
            <Sparkline values={vals} width={76} height={26} stroke={d.stroke} />
          </span>
        )}
      </div>
    </div>
  );
}

// 비트코인 채굴 손익분기점 — 우상단 업데이트 캡션 + 값·손익 라벨 + 손익분기 대비 현재가
function MiningTile({ t }: { t: BarTile }) {
  const m = t.mining!;
  const loss = m.pricePct != null && m.pricePct < 0;
  const col =
    m.pricePct == null ? "var(--color-neutral)" : loss ? "var(--color-up)" : "var(--color-good)";
  return (
    <div className={CARD}>
      <div className="flex items-baseline text-[11.5px] font-semibold text-navy-900">
        <span className="min-w-0 truncate">{t.label}</span>
        {/* 업데이트 타임스탬프 — 비필수 마이크로카피만 9px 유지 (codex 합의) */}
        {t.sub && (
          <span className="ml-auto shrink-0 pl-2 font-mono text-[9px] font-medium text-ink-500">
            {t.sub}
          </span>
        )}
      </div>
      <div className="mt-1 flex items-baseline gap-[9px]">
        <span className={`${VAL_LG} text-navy-900`}>{t.value}</span>
        {m.pricePct != null && (
          <span className="ml-auto text-[11.5px] font-semibold whitespace-nowrap" style={{ color: col }}>
            {loss ? "채굴 손실" : "채굴 이익"}
          </span>
        )}
      </div>
      <div className="mt-1 flex items-baseline border-t border-hairline pt-1 text-[9.5px] text-ink-500">
        손익분기 대비 현재가
        <b className="ml-auto font-mono text-[9.5px] font-semibold tabular-nums" style={{ color: col }}>
          {m.pricePct != null ? formatPercent(m.pricePct) : "-"}
        </b>
      </div>
    </div>
  );
}

// 환율 USD/KRW — 값(+변동) + 최근 영업일 "nD+값" 한 줄 (그래프 없음, 실제 날짜는 툴팁)
function FxTile({ t }: { t: BarTile }) {
  const f = t.fx!;
  const c = dir(t.changePct);
  const fx6 = f.fx6 ?? [];
  return (
    <div className={CARD}>
      <div className={TITLE}>{t.label}</div>
      <div className="mt-1 flex items-baseline gap-[9px]">
        <span className={VAL}>{t.value}</span>
        {t.changePct != null && <span className={`${CHG} ${c.text}`}>{formatPercent(t.changePct)}</span>}
      </div>
      {/* 최근 영업일 — "1D(1일 전)·2D…" 상대 날짜 + 값, 들어가는 만큼(최신 5일)만 한 줄 */}
      {fx6.length > 1 && (
        <div className="mt-1 flex flex-nowrap justify-between gap-x-1 overflow-hidden border-t border-hairline pt-1 font-mono text-[9.5px] font-medium text-ink-400">
          {fx6
            .map((d, i) => {
              const prev = i > 0 ? fx6[i - 1].rate : null;
              const diff = prev != null ? d.rate - prev : 0;
              return { ...d, diff, daysAgo: fx6.length - i };
            })
            .slice(-5)
            .reverse()
            .map((d) => (
              <span key={d.daysAgo} title={d.date} className="flex shrink-0 items-baseline gap-[3px]">
                <span className="text-ink-300">{d.daysAgo}D</span>
                <b
                  className="font-semibold tabular-nums"
                  style={{
                    color:
                      d.diff > 0
                        ? "var(--color-up)"
                        : d.diff < 0
                          ? "var(--color-down)"
                          : "var(--color-navy-600)",
                  }}
                >
                  {Math.round(d.rate).toLocaleString("ko-KR")}
                </b>
              </span>
            ))}
        </div>
      )}
    </div>
  );
}

// 단일 카드 렌더 — 지수·코인·MSTR 공통 (제목+장상태 / 값+변동 / 서브행 / 우측 스파크라인)
function Tile({ t }: { t: BarTile }) {
  // 자리표시자(데이터 미수신) — 특수 타일보다 먼저 판별해 빈 값 대신 안내를 노출
  if (t.placeholder) {
    return (
      <div className={`${CARD} border-dashed bg-white/60`}>
        {t.label && <div className={TITLE}>{t.label}</div>}
        <div className="flex min-h-12 items-center justify-center gap-1.5 text-[11px] text-ink-300">
          <Spinner size={14} />
          {t.note ?? "데이터 수집 중…"}
        </div>
      </div>
    );
  }

  // 전용 렌더러 타일
  if (t.fng) return <FngTile t={t} />;
  if (t.usdt) return <UsdtTile t={t} />;
  if (t.fx) return <FxTile t={t} />;
  if (t.mining) return <MiningTile t={t} />;
  if (t.dom6 || t.barPct != null) return <DomTile t={t} />;

  const c = dir(t.changePct);
  const mkt = marketOf(t);
  const spark = t.spark ?? [];
  return (
    <div className={CARD}>
      <div className="flex gap-2.5">
        <div className="min-w-0 flex-1">
          <div className={TITLE}>
            <span className="min-w-0 truncate">{t.label}</span>
            {mkt && <MarketStatus market={mkt} />}
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={VAL}>{t.value}</span>
            {t.changePct != null && <span className={`${CHG} ${c.text}`}>{formatPercent(t.changePct)}</span>}
          </div>
        </div>

        {/* MSTR(트레저리 카드)은 그래프 없이 수치만 — 카드 높이 절감 */}
        {spark.length >= 2 && !t.treasury && (
          <span className="shrink-0 pt-0.5">
            {mkt ? (
              <LiveSparkline market={mkt} values={spark} width={76} height={26} stroke={c.stroke} />
            ) : (
              <Sparkline values={spark} width={76} height={26} stroke={c.stroke} />
            )}
          </span>
        )}
      </div>

      {/* 대표 종목 (나스닥·코스피) — 이름 + 시세 + 변동률, 가로 1줄에 2종목 (라벨만 말줄임) */}
      {t.stocks && t.stocks.length > 0 && (
        <div className={SUB}>
          {t.stocks.map((s, i) => {
            const sc = dir(s.changePct);
            return (
              <span key={i} className="flex min-w-0 items-baseline gap-[3px]">
                <span className="truncate">{s.label}</span>
                <b className="shrink-0 font-mono text-[9.5px] font-semibold tabular-nums text-navy-900">{s.value}</b>
                {s.changePct != null && (
                  <span className={`shrink-0 font-mono text-[9.5px] font-semibold tabular-nums ${sc.text}`}>
                    {formatPercent(s.changePct)}
                  </span>
                )}
              </span>
            );
          })}
        </div>
      )}

      {/* MSTR 비트코인 트레저리 — 보유 / 변동(전일) / 평단(수익률), 가로 1줄 */}
      {t.treasury && (
        <div className={SUB}>
          <span className="flex shrink-0 items-baseline gap-[3px]">
            보유
            <b className="font-mono text-[9.5px] font-semibold tabular-nums text-navy-900">
              {Math.round(t.treasury.holdings).toLocaleString()} BTC
            </b>
          </span>
          <span className="flex min-w-0 items-baseline gap-[3px]">
            변동
            <b
              className={`truncate font-mono text-[9.5px] font-semibold tabular-nums ${
                t.treasury.holdingsDelta !== 0 ? dir(t.treasury.holdingsDelta).text : "text-ink-400"
              }`}
            >
              {t.treasury.holdingsDelta !== 0
                ? `${t.treasury.holdingsDelta > 0 ? "+" : ""}${Math.round(
                    t.treasury.holdingsDelta
                  ).toLocaleString()} BTC`
                : "±0"}
            </b>
          </span>
          <span className="flex shrink-0 items-baseline gap-[3px]">
            평단
            <b className="font-mono text-[9.5px] font-semibold tabular-nums text-navy-900">
              ${Math.round(t.treasury.avgPriceUsd).toLocaleString()}
            </b>
            <span className={`font-mono text-[9.5px] font-semibold tabular-nums ${dir(t.treasury.returnPct).text}`}>
              {formatPercent(t.treasury.returnPct)}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

// 12개 시장 지표 카드 — 4×3 그리드, 크립토 커뮤니티 우선 배치:
// 1행 크립토 핵심(BTC·ETH·도미넌스·공포탐욕) → 2행 크립토 파생(김프·환율·MSTR·채굴) → 3행 전통시장(나스닥·코스피·코스닥·금)
const TILE_ORDER = [
  "btc",
  "eth",
  "btcDom",
  "fng",
  "usdtKimchi",
  "fx",
  "mstr",
  "btcBreakeven",
  "nasdaq",
  "kospi",
  "kosdaq",
  "gold",
];

export default async function MarketBar() {
  const { tiles: rawTiles } = await getMarketBar();
  const tiles = [...rawTiles].sort((a, b) => {
    const ia = TILE_ORDER.indexOf(a.key);
    const ib = TILE_ORDER.indexOf(b.key);
    return (ia === -1 ? TILE_ORDER.length : ia) - (ib === -1 ? TILE_ORDER.length : ib);
  });

  // 홈 본문(main px-5) 안에서 렌더링되므로 자체 패딩 없이 그리드만 출력한다.
  return (
    <div>
      {tiles.length === 0 ? (
        <p className="rail flex items-center justify-center gap-2 py-2 text-center">
          <Spinner size={15} />
          마켓 데이터 불러오는 중…
        </p>
      ) : (
        <div className="grid auto-rows-fr grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {tiles.map((t) => (
            <Tile key={t.key} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}
