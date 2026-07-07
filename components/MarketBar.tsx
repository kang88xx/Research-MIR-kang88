import { getMarketBar, type BarTile } from "@/lib/marketbar";
import { formatPercent } from "@/lib/format";
import Sparkline from "@/components/Sparkline";
import LiveSparkline from "@/components/LiveSparkline";
import MarketStatus, { type Mkt } from "@/components/MarketStatus";

// 모든 타일은 동일한 고정 크기 — 272×72 (px). 내용은 세로 중앙·넘침 숨김으로 맞춤.
const TILE = "h-[72px] w-[272px] shrink-0 overflow-hidden";
// 헤드라인 수치 공통 스타일 — 모든 타일에서 크기·굵기·자릿수 정렬을 통일
const VAL = "font-mono text-[15px] font-semibold tabular-nums whitespace-nowrap";
// 등락률 공통 스타일 (색상 클래스는 호출부에서 덧붙임)
const CHG = "font-mono text-[11px] tabular-nums whitespace-nowrap";

// 등락 색: 한국식 (상승=빨강, 하락=파랑)
function dir(n: number | null): { text: string; stroke: string } {
  if (n != null && n > 0) return { text: "text-up", stroke: "#e5443b" }; // 상승 — 레드
  if (n != null && n < 0) return { text: "text-down", stroke: "#2e7ce6" }; // 하락 — 블루
  return { text: "text-neutral", stroke: "#7d858f" };
}

// 타일 키 → 시장 구분 (장중/장마감 판별용). 2행 타일은 tile.market을 우선 사용.
function marketOf(t: BarTile): Mkt | null {
  if (t.market) return t.market;
  if (t.key === "nasdaq") return "us";
  if (t.key === "kospi" || t.key === "kosdaq") return "kr";
  if (t.key === "gold") return "gold";
  return null;
}

// 공포·탐욕 지수 색 — 공포=레드, 중립=그레이, 탐욕=그린 (alternative.me 게이지 관례)
function fngColor(v: number): string {
  if (v < 25) return "#e5443b"; // 극단적 공포
  if (v < 45) return "#f5871f"; // 공포
  if (v < 55) return "#7d858f"; // 중립
  if (v < 75) return "#3aa76d"; // 탐욕
  return "#1e9e5a"; // 극단적 탐욕
}

// 6일 라벨+값 열 (환율·도미넌스·공포탐욕 공통) — 날짜(상) + 값(하)
function DayCol({ date, value, color }: { date: string; value: string; color?: string }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col items-center leading-tight">
      <span className="text-[8px] text-navy-300">{date}</span>
      <span className={`font-mono text-[10px] tabular-nums whitespace-nowrap ${color ? "" : "text-navy-900"}`} style={color ? { color } : undefined}>
        {value}
      </span>
    </span>
  );
}

// 공포·탐욕 지수 타일 — 현재값 + 0~100 게이지 + 6일 추이(스파크라인·값)
function FngTile({ t }: { t: BarTile }) {
  const f = t.fng!;
  const history = f.history ?? [];
  const color = fngColor(f.value);
  const pos = Math.min(100, Math.max(0, f.value));
  const series = [...history.map((d) => d.value), f.value];
  return (
    <div className={`${TILE} flex flex-col justify-center gap-0.5 border border-line bg-white px-3 py-1`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] whitespace-nowrap text-navy-400">{t.label}</span>
        <span className="text-[9px] tracking-wider text-navy-300">DAILY</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-baseline gap-1.5">
          <span className="font-mono text-[16px] font-bold leading-none tabular-nums" style={{ color }}>
            {f.value}
          </span>
          <span className="text-[11px] font-medium" style={{ color }}>
            {f.label}
          </span>
        </span>
        {/* 6일 추이 스파크라인 — 지수 상승(탐욕)=그린 / 하락(공포)=레드 */}
        {series.length >= 2 && (
          <span className="shrink-0">
            <Sparkline
              values={series}
              width={52}
              height={16}
              stroke={series[series.length - 1] - series[0] >= 0 ? "#1e9e5a" : "#e5443b"}
            />
          </span>
        )}
      </div>
      {/* 0~100 그라데이션 게이지 + 현재 위치 마커 */}
      <div
        className="relative h-1.5 w-full rounded-full"
        style={{ background: "linear-gradient(90deg,#e5443b,#f5871f,#d9dde2,#3aa76d,#1e9e5a)" }}
      >
        <span
          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-navy-900 shadow"
          style={{ left: `${pos}%` }}
        />
      </div>
      {/* 최근 6일 — 날짜 + 값(레벨 색) */}
      {history.length > 0 && (
        <div className="flex items-stretch justify-between gap-0.5 border-t border-line pt-1">
          {history.map((d) => (
            <DayCol key={d.date} date={d.date} value={String(d.value)} color={fngColor(d.value)} />
          ))}
        </div>
      )}
    </div>
  );
}

// 테더(USDT) 김프 타일 — 테더 시세(헤드라인) + 김프% + 6일 김프 스파크라인 + 환율·변동폭
function UsdtTile({ t }: { t: BarTile }) {
  const u = t.usdt!;
  const km = dir(u.tetherKimchi);
  const spark = u.kimchiSpark ?? [];
  const range = spark.length >= 2 ? { min: Math.min(...spark), max: Math.max(...spark) } : null;
  return (
    <div className={`${TILE} flex flex-col justify-center gap-0.5 border border-line bg-white px-3 py-1`}>
      {/* 라벨 + 6일 김프 추이 스파크라인 */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] whitespace-nowrap text-navy-400">{t.label}</span>
        {spark.length >= 2 && (
          <span className="shrink-0">
            <Sparkline values={spark} width={52} height={16} stroke={km.stroke} />
          </span>
        )}
      </div>

      {/* 테더 시세(헤드라인) + 김프 % */}
      <div className="flex items-baseline justify-between gap-1.5">
        <span className={`${VAL} text-navy-900`}>
          {u.tetherKrw != null ? `${Math.round(u.tetherKrw).toLocaleString("ko-KR")}원` : "-"}
        </span>
        <span className={`font-mono text-[13px] font-semibold tabular-nums whitespace-nowrap ${km.text}`}>
          김프 {u.tetherKimchi != null ? formatPercent(u.tetherKimchi) : "-"}
        </span>
      </div>

      {/* 환율(+변동) + 6일 김프 변동폭 */}
      <div className="flex items-baseline justify-between gap-1 border-t border-line pt-1 text-[9px] leading-tight text-navy-400">
        <span className="min-w-0 truncate">
          환율{" "}
          <span className="font-mono tabular-nums text-navy-900">
            {u.usdKrw != null ? u.usdKrw.toLocaleString("ko-KR", { maximumFractionDigits: 2 }) : "-"}
          </span>
          <span className={`ml-1 font-mono tabular-nums ${dir(u.fxChangePct).text}`}>{formatPercent(u.fxChangePct)}</span>
        </span>
        <span className="shrink-0 whitespace-nowrap">
          6일{" "}
          <span className="font-mono tabular-nums text-navy-900">
            {range ? `${formatPercent(range.min)}~${formatPercent(range.max)}` : "-"}
          </span>
        </span>
      </div>
    </div>
  );
}

// 환율 USD/KRW 타일 — 현재값(+변동) + 6일 추이(스파크라인·값)
function FxTile({ t }: { t: BarTile }) {
  const f = t.fx!;
  const c = dir(t.changePct);
  const fx6 = f.fx6 ?? [];
  const rates = fx6.map((d) => d.rate);
  return (
    <div className={`${TILE} flex flex-col justify-center gap-0.5 border border-line bg-white px-3 py-1`}>
      {/* 현재값(+변동) + 6일 추이 스파크라인 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="text-[10px] whitespace-nowrap text-navy-400">{t.label}</span>
          <span className="flex items-baseline gap-1">
            <span className={`${VAL} text-navy-900`}>{t.value}</span>
            {t.changePct != null && <span className={`${CHG} ${c.text}`}>{formatPercent(t.changePct)}</span>}
          </span>
        </div>
        {rates.length >= 2 && (
          <span className="shrink-0">
            <Sparkline values={rates} width={52} height={22} stroke={c.stroke} />
          </span>
        )}
      </div>

      {/* 환율 USD/KRW 최근 6일 — 전일 대비 상승=레드 / 하락=블루 */}
      {fx6.length > 0 && (
        <div className="flex items-stretch justify-between gap-0.5 border-t border-line pt-1">
          {fx6.map((d, i) => {
            const prev = i > 0 ? fx6[i - 1].rate : null;
            const diff = prev != null ? d.rate - prev : 0;
            return (
              <DayCol
                key={i}
                date={d.date}
                value={Math.round(d.rate).toLocaleString("ko-KR")}
                color={diff > 0 ? "#e5443b" : diff < 0 ? "#2e7ce6" : undefined}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// BTC 도미넌스 타일 — 현재값(+전일 대비 %p) + 6일 추이(스파크라인·값)
function DomTile({ t }: { t: BarTile }) {
  const dom6 = t.dom6 ?? [];
  const vals = dom6.map((d) => d.value);
  const last = vals.length ? vals[vals.length - 1] : null;
  const prev = vals.length >= 2 ? vals[vals.length - 2] : null;
  // 0.1%p 단위로 반올림 — -0.04 같은 값이 "-0.0%p"로 보이지 않도록
  const raw = last != null && prev != null ? last - prev : null;
  const deltaPp = raw == null ? null : Math.round(raw * 10) / 10;
  const d = dir(deltaPp);
  return (
    <div className={`${TILE} flex flex-col justify-center gap-0.5 border border-line bg-white px-3 py-1`}>
      {/* 라벨 + 6일 추이 스파크라인 */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] whitespace-nowrap text-navy-400">{t.label}</span>
        {vals.length >= 2 && (
          <span className="shrink-0">
            <Sparkline values={vals} width={52} height={16} stroke={d.stroke} />
          </span>
        )}
      </div>

      {/* 현재값(헤드라인) + 전일 대비 %p */}
      <div className="flex items-baseline gap-1.5">
        <span className={`${VAL} text-navy-900`}>{t.value}</span>
        {deltaPp != null && (
          <span className={`${CHG} ${d.text}`}>
            {deltaPp > 0 ? "+" : ""}
            {deltaPp.toFixed(1)}%p
          </span>
        )}
      </div>

      {/* 최근 6일 — 전일 대비 상승=레드 / 하락=블루 */}
      {dom6.length > 0 ? (
        <div className="flex items-stretch justify-between gap-0.5 border-t border-line pt-1">
          {dom6.map((x, i) => {
            const p = i > 0 ? dom6[i - 1].value : null;
            const diff = p != null ? x.value - p : 0;
            return (
              <DayCol
                key={i}
                date={x.date}
                value={x.value.toFixed(1)}
                color={diff > 0 ? "#e5443b" : diff < 0 ? "#2e7ce6" : undefined}
              />
            );
          })}
        </div>
      ) : (
        t.barPct != null && (
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-navy-400"
              style={{ width: `${Math.min(100, Math.max(0, t.barPct))}%` }}
            />
          </div>
        )
      )}
    </div>
  );
}

// 비트코인 채굴 손익분기점 타일 — 손익분기가(헤드라인) + 채굴 손익 라벨 + 손익분기 대비 현재가%
function MiningTile({ t }: { t: BarTile }) {
  const m = t.mining!;
  const loss = m.pricePct != null && m.pricePct < 0;
  const col = m.pricePct == null ? "#7d858f" : loss ? "#e5443b" : "#1e9e5a";
  return (
    <div className={`${TILE} flex flex-col justify-center gap-0.5 border border-line bg-white px-3 py-1`}>
      {/* 라벨 + 업데이트 날짜 */}
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[10px] text-navy-400">{t.label}</span>
        {t.sub && <span className="shrink-0 text-[8px] whitespace-nowrap text-navy-300">{t.sub}</span>}
      </div>
      {/* 손익분기가(헤드라인) + 채굴 손익 라벨 */}
      <div className="flex items-baseline justify-between gap-1.5">
        <span className={`${VAL} text-navy-900`}>{t.value}</span>
        {m.pricePct != null && (
          <span className="text-[11px] font-semibold whitespace-nowrap" style={{ color: col }}>
            {loss ? "채굴 손실" : "채굴 이익"}
          </span>
        )}
      </div>
      {/* 손익분기 대비 현재가 등락 */}
      <div className="flex items-baseline justify-between gap-1 border-t border-line pt-1 text-[9px] leading-tight">
        <span className="whitespace-nowrap text-navy-400">손익분기 대비 현재가</span>
        <span className="font-mono tabular-nums whitespace-nowrap" style={{ color: col }}>
          {m.pricePct != null ? formatPercent(m.pricePct) : "-"}
        </span>
      </div>
    </div>
  );
}

// 단일 타일 렌더 — 지수·코인·MSTR 공통
function Tile({ t }: { t: BarTile }) {
  // 자리표시자(데이터 미수신) — 특수 타일보다 먼저 판별해 빈 값 대신 안내를 노출
  if (t.placeholder) {
    return (
      <div className={`${TILE} flex flex-col justify-center border border-dashed border-line bg-white/60 px-3 py-1`}>
        {t.label && <span className="text-[10px] whitespace-nowrap text-navy-400">{t.label}</span>}
        <span className="flex flex-1 items-center justify-center text-[11px] text-navy-300">
          {t.note ?? "고민중…"}
        </span>
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
    <div className={`${TILE} flex flex-col justify-center gap-0.5 border border-line bg-white px-3 py-1`}>
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[10px] text-navy-400">{t.label}</span>
            {mkt && <MarketStatus market={mkt} />}
          </span>
          <span className="flex items-baseline gap-1">
            <span className={`${VAL} text-navy-900`}>{t.value}</span>
            {t.changePct != null && <span className={`${CHG} ${c.text}`}>{formatPercent(t.changePct)}</span>}
          </span>
        </div>
        {spark.length >= 2 && (
          <span className="shrink-0">
            {mkt ? (
              <LiveSparkline market={mkt} values={spark} width={56} height={26} stroke={c.stroke} />
            ) : (
              <Sparkline values={spark} width={56} height={26} stroke={c.stroke} />
            )}
          </span>
        )}
      </div>

      {/* 대표 종목 2개 — 좌우 2열 그리드 (나스닥·코스피) */}
      {t.stocks && t.stocks.length > 0 && (
        <div className="grid grid-cols-2 gap-2 border-t border-line pt-1">
          {t.stocks.map((s, i) => {
            const sc = dir(s.changePct);
            return (
              <span
                key={i}
                className={`flex min-w-0 items-baseline gap-1 overflow-hidden ${i === 1 ? "justify-end" : ""}`}
              >
                <span className="truncate text-[9px] text-navy-400">{s.label}</span>
                <span className="shrink-0 font-mono text-[10px] tabular-nums whitespace-nowrap text-navy-900">
                  {s.value}
                </span>
                {s.changePct != null && (
                  <span className={`shrink-0 font-mono text-[9px] tabular-nums whitespace-nowrap ${sc.text}`}>
                    {formatPercent(s.changePct)}
                  </span>
                )}
              </span>
            );
          })}
        </div>
      )}

      {/* MSTR 비트코인 트레저리 — 좌: 보유량·평단(수익률) / 우: 전일 대비 보유량 변동폭 */}
      {t.treasury && (
        <div className="flex items-center justify-between gap-2 border-t border-line pt-1 text-[9px] leading-tight">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="flex items-baseline gap-1">
              <span className="text-navy-400">보유 BTC</span>
              <span className="font-mono tabular-nums whitespace-nowrap text-navy-900">
                {Math.round(t.treasury.holdings).toLocaleString()}
              </span>
            </span>
            <span className="flex items-baseline gap-1">
              <span className="whitespace-nowrap text-navy-400">
                평단 ${Math.round(t.treasury.avgPriceUsd).toLocaleString()}
              </span>
              <span className={`font-mono tabular-nums whitespace-nowrap ${dir(t.treasury.returnPct).text}`}>
                {formatPercent(t.treasury.returnPct)}
              </span>
            </span>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <span className="whitespace-nowrap text-navy-400">변동(전일)</span>
            <span
              className={`font-mono tabular-nums whitespace-nowrap ${
                t.treasury.holdingsDelta !== 0 ? dir(t.treasury.holdingsDelta).text : "text-navy-300"
              }`}
            >
              {t.treasury.holdingsDelta !== 0
                ? `${t.treasury.holdingsDelta > 0 ? "+" : ""}${Math.round(
                    t.treasury.holdingsDelta
                  ).toLocaleString()} BTC`
                : "±0 BTC"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// 상단 마켓바 — 1행: 지수·금 / 2행: 코인·MSTR·공포탐욕 / 3행: 도미넌스 등
export default async function MarketBar() {
  const { tiles } = await getMarketBar();
  // 그룹별 행 (순서 고정) — 각 행은 고정 크기 타일을 균등 분배해 열이 정렬됨
  const rows = [
    tiles.filter((t) => t.group !== "crypto" && t.group !== "macro"), // index
    tiles.filter((t) => t.group === "crypto"),
    tiles.filter((t) => t.group === "macro"),
  ].filter((row) => row.length > 0);

  return (
    <div className="border-b border-line bg-paper">
      <div className="mx-auto flex max-w-6xl items-stretch gap-3 px-4">
        <div className="flex flex-1 flex-col gap-2 py-2">
          {tiles.length === 0 ? (
            <span className="rail self-center">마켓 데이터 불러오는 중…</span>
          ) : (
            // 고정 크기(272×72) 타일을 행마다 균등 분배 — 모든 행의 열이 항상 정렬됨
            rows.map((row, i) => (
              <div key={i} className="flex flex-wrap justify-between gap-y-2">
                {row.map((t) => (
                  <Tile key={t.key} t={t} />
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
