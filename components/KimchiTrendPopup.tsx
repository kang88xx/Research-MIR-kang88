"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { KimchiDay, KimchiHistory, KimchiHistoryDay } from "@/lib/kimchi";
import Spinner from "@/components/Spinner";

// 김프 추이 위젯 + 레이어 팝업 — 히어로의 7일 미니 차트를 누르면
// 장기 히스토리(/api/kimchi/history)를 일간·주간·월간으로 전환해 보여준다.

type Range = "daily" | "weekly" | "monthly";

const RANGES: { key: Range; label: string }[] = [
  { key: "daily", label: "일간" },
  { key: "weekly", label: "주간" },
  { key: "monthly", label: "월간" },
];

function pctText(n: number, digits = 2): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

// "YYYY-MM-DD" → 해당 주 월요일 날짜 문자열 (주간 집계 키)
function weekStartOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const offset = (d.getUTCDay() + 6) % 7; // 월=0 … 일=6
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

function shortLabel(date: string): string {
  const [, mm, dd] = date.split("-");
  return `${Number(mm)}/${Number(dd)}`;
}

type Bar = { label: string; full: string; value: number };

// 일간 30개 / 주간 26개(주 평균) / 월간 전체(월 평균) 시리즈로 변환
function toSeries(days: KimchiHistoryDay[], range: Range): Bar[] {
  if (range === "daily") {
    return days.slice(-30).map((d) => ({
      label: shortLabel(d.date),
      full: `${d.date} · ${pctText(d.value)}`,
      value: d.value,
    }));
  }
  const keyOf = range === "weekly" ? weekStartOf : (date: string) => date.slice(0, 7);
  const groups = new Map<string, number[]>();
  for (const d of days) {
    const k = keyOf(d.date);
    const arr = groups.get(k);
    if (arr) arr.push(d.value);
    else groups.set(k, [d.value]);
  }
  const bars = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, values]) => {
      const avg = values.reduce((s, v) => s + v, 0) / values.length;
      return range === "weekly"
        ? { label: shortLabel(k), full: `${k} 주 평균 · ${pctText(avg)}`, value: avg }
        : {
            label: `${Number(k.slice(5))}월`,
            full: `${k.replace("-", ".")} 월 평균 · ${pctText(avg)}`,
            value: avg,
          };
    });
  return range === "weekly" ? bars.slice(-26) : bars;
}

// 0% 기준 상하 막대 차트 — 히어로 미니 차트와 같은 문법(레드=프리미엄/블루=역프)
function BarChart({ bars, height, labelEvery }: { bars: Bar[]; height: number; labelEvery: number }) {
  const maxAbs = Math.max(0.5, ...bars.map((b) => Math.abs(b.value)));
  return (
    <div>
      <div className="flex items-stretch gap-[3px]" style={{ height }}>
        {bars.map((b, i) => {
          const up = b.value >= 0;
          const hPct = Math.max(2, (Math.abs(b.value) / maxAbs) * 48);
          return (
            <div key={i} className="group relative min-w-0 flex-1" title={b.full}>
              <span className="absolute left-0 right-0 top-1/2 h-px bg-line" />
              <span
                className="absolute left-1/2 w-[70%] max-w-[22px] -translate-x-1/2 rounded-[2px] group-hover:opacity-100"
                style={{
                  height: `${hPct}%`,
                  ...(up ? { bottom: "50%" } : { top: "50%" }),
                  background: up ? "var(--color-up)" : "var(--color-down)",
                  opacity: 0.4 + 0.55 * Math.min(1, Math.abs(b.value) / maxAbs),
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-[3px]">
        {bars.map((b, i) => (
          <span
            key={i}
            className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center font-mono text-[9px] text-ink-400"
          >
            {i % labelEvery === labelEvery - 1 || bars.length <= 8 ? b.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function KimchiTrendPopup({ history }: { history: KimchiDay[] }) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<Range>("daily");
  const [data, setData] = useState<KimchiHistory | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    fetch("/api/kimchi/history")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((d: KimchiHistory) => {
        if (d.days.length === 0) setError(true);
        else setData(d);
      })
      .catch(() => setError(true));
  }, []);

  // 팝업 열기 — 첫 열기에만 로드 (30분 서버 캐시라 재열기 시 재요청 없음)
  const openPopup = useCallback(() => {
    setOpen(true);
    if (!data) load();
  }, [data, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // 인라인 라인 차트 좌표 — 0% 기준선을 항상 포함하는 y 도메인 (E7B/K2 확정안)
  const chart = useMemo(() => {
    if (history.length === 0) return null;
    const vals = history.map((d) => d.value);
    const lo = Math.min(0, ...vals);
    const hi = Math.max(0, ...vals);
    const pad = Math.max(0.15, (hi - lo) * 0.2);
    const yMin = lo - pad;
    const yMax = hi + pad;
    const W = 350;
    const H = 76;
    const XPAD = 10;
    const x = (i: number) => XPAD + (i * (W - 2 * XPAD)) / Math.max(1, history.length - 1);
    const y = (v: number) => ((yMax - v) / (yMax - yMin)) * H;
    const points = history.map((d, i) => ({ x: x(i), y: y(d.value) }));
    const last = history[history.length - 1].value;
    const stroke =
      last >= 0.05 ? "var(--color-up)" : last <= -0.05 ? "var(--color-down)" : "var(--color-neutral)";
    return { W, H, points, zeroY: y(0), stroke };
  }, [history]);

  const series = useMemo(() => (data ? toSeries(data.days, range) : []), [data, range]);
  const stats = useMemo(() => {
    if (series.length === 0) return null;
    const values = series.map((b) => b.value);
    return {
      last: values[values.length - 1],
      avg: values.reduce((s, v) => s + v, 0) / values.length,
      max: Math.max(...values),
      min: Math.min(...values),
    };
  }, [series]);

  return (
    <>
      {/* 인라인 위젯 — 히어로 ③ 최근 7일 추이 (클릭 → 팝업) */}
      <button
        type="button"
        onClick={openPopup}
        className="group block w-full cursor-pointer text-left"
        aria-haspopup="dialog"
        title="일간·주간·월간 추이 크게 보기"
      >
        <p className="flex items-baseline text-[11px] font-medium text-ink-500">
          7일 추이 · 7D TREND
          <span className="ml-auto text-[10px] text-ink-400 underline-offset-2 group-hover:text-navy-900 group-hover:underline">
            일간·주간·월간 ↗
          </span>
        </p>
        {history.length === 0 || !chart ? (
          <p className="mt-4 text-[11.5px] text-ink-400">추이 데이터를 불러오지 못했습니다.</p>
        ) : (
          <div className="mt-2">
            {/* 라인+영역 차트 — 각 포인트가 아래 날짜 라벨 열과 같은 x 위치에 놓인다 */}
            <svg
              viewBox={`0 0 ${chart.W} ${chart.H}`}
              className="block h-[72px] w-full"
              preserveAspectRatio="none"
              aria-hidden
            >
              <defs>
                <linearGradient id="kimchi-trend-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chart.stroke} stopOpacity="0.16" />
                  <stop offset="100%" stopColor={chart.stroke} stopOpacity="0" />
                </linearGradient>
              </defs>
              <line
                x1="0"
                y1={chart.zeroY}
                x2={chart.W}
                y2={chart.zeroY}
                stroke="var(--color-hairline)"
                strokeDasharray="3 3"
              />
              <polygon
                points={`${chart.points.map((p) => `${p.x},${p.y}`).join(" ")} ${
                  chart.points[chart.points.length - 1].x
                },${chart.H} ${chart.points[0].x},${chart.H}`}
                fill="url(#kimchi-trend-fill)"
              />
              <polyline
                points={chart.points.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke={chart.stroke}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {chart.points.map((p, i) =>
                i === chart.points.length - 1 ? (
                  <circle key={i} cx={p.x} cy={p.y} r="4" fill={chart.stroke} />
                ) : (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r="2.5"
                    fill="var(--color-surface)"
                    stroke={chart.stroke}
                    strokeWidth="1.5"
                  />
                ),
              )}
            </svg>
            {/* 날짜·수치 라벨 — 포인트와 동일한 균등 분할, 격일 수치 표기·오늘 강조 */}
            <div className="mt-1 flex">
              {history.map((d, i) => {
                const isLast = i === history.length - 1;
                const showValue = (history.length - 1 - i) % 2 === 0;
                return (
                  <span
                    key={d.date}
                    className={`min-w-0 flex-1 text-center font-mono text-[9px] leading-[1.5] ${
                      isLast ? "font-bold" : "text-ink-400"
                    }`}
                    style={isLast ? { color: chart.stroke } : undefined}
                    title={`${d.date} · ${pctText(d.value)}`}
                  >
                    {isLast ? "오늘" : d.date}
                    {showValue && (
                      <>
                        <br />
                        {pctText(d.value)}
                      </>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </button>

      {/* 레이어 팝업 — 일간·주간·월간 전환 */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 p-0 sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="테더 김치프리미엄 추이"
        >
          <div
            className="w-full max-w-2xl border border-line bg-white p-6 sm:rounded"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-base font-bold text-navy-900">테더(USDT) 김프 추이</h3>
              <div className="flex overflow-hidden rounded border border-line" role="tablist">
                {RANGES.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    role="tab"
                    aria-selected={range === r.key}
                    onClick={() => setRange(r.key)}
                    className={`px-3 py-1 text-[12px] font-semibold ${
                      range === r.key
                        ? "bg-navy-900 text-white"
                        : "bg-white text-ink-500 hover:text-navy-900"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="ml-auto -mr-1 px-1 text-[18px] leading-none text-ink-400 hover:text-navy-900"
                aria-label="닫기"
              >
                ×
              </button>
            </div>

            <div className="mt-5 min-h-[210px]">
              {error ? (
                <div className="flex h-[200px] flex-col items-center justify-center gap-3 text-[12px] text-ink-500">
                  추이 데이터를 불러오지 못했습니다.
                  <button
                    type="button"
                    onClick={load}
                    className="border border-navy-300 px-3 py-1.5 text-[12px] font-medium text-navy-900 hover:border-navy-900"
                  >
                    다시 시도
                  </button>
                </div>
              ) : !data ? (
                <div className="flex h-[200px] items-center justify-center">
                  <Spinner size={20} />
                </div>
              ) : (
                <>
                  <BarChart
                    bars={series}
                    height={170}
                    labelEvery={range === "daily" ? 5 : range === "weekly" ? 4 : 1}
                  />
                  {stats && (
                    <dl className="mt-4 grid grid-cols-4 gap-2 border-t border-line pt-3">
                      {(
                        [
                          ["현재", stats.last],
                          ["기간 평균", stats.avg],
                          ["최고", stats.max],
                          ["최저", stats.min],
                        ] as const
                      ).map(([label, v]) => (
                        <div key={label} className="min-w-0">
                          <dt className="text-[10.5px] text-ink-500">{label}</dt>
                          <dd
                            className="mt-0.5 font-mono text-[14px] font-semibold tabular-nums"
                            style={{
                              color:
                                v >= 0.05
                                  ? "var(--color-up)"
                                  : v <= -0.05
                                    ? "var(--color-down)"
                                    : "var(--color-neutral)",
                            }}
                          >
                            {pctText(v)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  <p className="mt-3">
                    <span className="rail">
                      {range === "daily"
                        ? "최근 30일 · 업비트 KRW-USDT 일봉 종가 ÷ 당일 환율"
                        : range === "weekly"
                          ? "주별 평균 (월요일 시작) · 최근 26주"
                          : "월별 평균 · 업비트 일봉 제공 범위(최근 200일) 기준"}
                    </span>
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
