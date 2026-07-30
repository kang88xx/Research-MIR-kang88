"use client";

// d3-force 시뮬레이션이 노드 좌표를 직접 DOM(transform)에 쓰는 명령형 패턴.
// React는 구조(원/로고/텍스트)만 렌더하고, 매 틱의 위치·스케일 갱신은
// setAttribute로 처리해 리렌더 비용 없이 60fps 모션을 유지한다.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  forceSimulation,
  forceCollide,
  forceX,
  forceY,
  type Simulation,
} from "d3-force";
import GajaLoader from "@/components/GajaLoader";
import { formatRelativeTime } from "@/lib/format";

const EPOCH = new Date(0).toISOString();

type BubbleCoin = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  priceUsd: number | null;
  marketCap: number | null;
  marketCapRank: number | null;
  volume24h: number | null;
  change1h: number | null;
  change24h: number | null;
  change7d: number | null;
  change30d: number | null;
  change1y: number | null;
};

type Period = "1h" | "24h" | "7d" | "30d";
const PERIODS: { key: Period; label: string; field: keyof BubbleCoin }[] = [
  { key: "1h", label: "1H", field: "change1h" },
  { key: "24h", label: "24H", field: "change24h" },
  { key: "7d", label: "7D", field: "change7d" },
  { key: "30d", label: "1M", field: "change30d" },
];

type Node = {
  coin: BubbleCoin;
  change: number;
  r: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  // 유영 모션 — 노드별 위상·주기가 달라 서로 다른 궤적으로 천천히 떠다닌다
  wx: number;
  wy: number;
  w1: number;
  w2: number;
  // 등장 애니메이션 시작 시각(ms). -1이면 이미 등장 완료
  born: number;
  // 현재 표시 스케일 — 등장/기간 전환/호버를 하나의 값으로 부드럽게 보간
  scale: number;
};

const COUNT = 100; // 시총 상위 N개(스테이블코인 제외)
const FILL_RATIO = 0.52; // 박스 대비 버블 총면적 — 여유를 둬야 낑기지 않는다

// Cobak 관례: 상승=레드 / 하락=블루
function colorFor(change: number): string {
  if (change > 0.05) return "#e5443b"; // 상승: 레드(up)
  if (change < -0.05) return "#2e7ce6"; // 하락: 블루(down)
  return "#878e97"; // 보합: gray-500
}

// 텍스트는 살짝 어두운 톤 — 옅은 버블 위에서 가독성 확보
function textColorFor(change: number): string {
  if (change > 0.05) return "#c9362e";
  if (change < -0.05) return "#2565c4";
  return "#6b7280";
}

function gradFor(change: number): string {
  if (change > 0.05) return "bm-grad-up";
  if (change < -0.05) return "bm-grad-down";
  return "bm-grad-flat";
}

// 변동률 크기 → 색 강도(0~1). ±8% 이상이면 최대 강도
function intensityFor(change: number): number {
  return Math.min(1, Math.abs(change) / 8);
}

export default function BubbleMap() {
  const [coins, setCoins] = useState<BubbleCoin[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [period, setPeriod] = useState<Period>("24h");
  const [hover, setHover] = useState<string | null>(null);
  const [renderNodes, setRenderNodes] = useState<Node[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const nodesRef = useRef<Node[]>([]);
  const simRef = useRef<Simulation<Node, undefined> | null>(null);
  const gEls = useRef(new Map<string, SVGGElement>());
  const tipRef = useRef<HTMLDivElement | null>(null);
  const hoverRef = useRef<string | null>(null);

  useEffect(() => {
    hoverRef.current = hover;
  }, [hover]);

  // 컨테이너 실제 크기 측정 → 좌표계를 박스에 맞춰 버블이 꽉 차게
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 언마운트 후 setState 방지 플래그
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // 버블 데이터 로드 — 폴링·재시도 공용 (프론트는 내 API만 본다)
  const loadBubbles = useCallback(async () => {
    try {
      const res = await fetch("/api/bubbles");
      if (!res.ok) throw new Error("non-ok");
      const json = await res.json();
      if (!aliveRef.current) return;
      if (Array.isArray(json.coins)) {
        setCoins(json.coins.slice(0, COUNT));
        if (typeof json.updatedAt === "string") setUpdatedAt(json.updatedAt);
        setError(false);
      }
    } catch {
      if (aliveRef.current) setError(true); // 재시도 버튼 표시
    }
  }, []);

  useEffect(() => {
    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return; // 백그라운드 탭은 폴링 정지
      loadBubbles();
    };
    tick();
    const t = setInterval(tick, 60_000);
    const onVisible = () => {
      if (!document.hidden) loadBubbles();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadBubbles]);

  const field = useMemo(
    () => PERIODS.find((p) => p.key === period)!.field,
    [period]
  );

  // 노드 구성 + 은은하게 떠다니는 force 시뮬레이션
  useEffect(() => {
    const { w: W, h: H } = size;
    if (coins.length === 0 || W === 0 || H === 0) return;
    // 모션 최소화 선호 시: 유영 없이 자연 감쇠로 정착시킨다(영구 애니메이션 비활성).
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

    const valid = coins
      .map((c) => ({ c, change: (c[field] as number | null) ?? null }))
      .filter((x): x is { c: BubbleCoin; change: number } => x.change != null);
    if (valid.length === 0) return;

    // 박스 채움 비율에 맞춰 반지름 스케일을 동적으로 계산
    const weights = valid.map((v) => Math.sqrt(Math.abs(v.change) + 0.4));
    const sumW2 = weights.reduce((s, wt) => s + wt * wt, 0);
    const targetArea = FILL_RATIO * W * H;
    const k = Math.sqrt(targetArea / (Math.PI * sumW2));
    const MAX_R = Math.min(W, H) * 0.24;
    const MIN_R = Math.max(9, Math.min(W, H) * 0.035);

    const prev = new Map(nodesRef.current.map((n) => [n.coin.id, n]));
    const isRebuild = prev.size > 0;
    const now = performance.now();
    const nodes: Node[] = valid.map(({ c, change }, i) => {
      const r = Math.max(MIN_R, Math.min(MAX_R, k * weights[i]));
      const old = prev.get(c.id);
      return {
        coin: c,
        change,
        r,
        x: old?.x ?? W * (0.12 + 0.76 * Math.random()),
        y: old?.y ?? H * (0.12 + 0.76 * Math.random()),
        vx: old?.vx ?? 0,
        vy: old?.vy ?? 0,
        wx: old?.wx ?? Math.random() * Math.PI * 2,
        wy: old?.wy ?? Math.random() * Math.PI * 2,
        w1: old?.w1 ?? 0.0003 + Math.random() * 0.0005,
        w2: old?.w2 ?? 0.0003 + Math.random() * 0.0005,
        born: reduceMotion || old ? -1 : now + i * 14, // 순차 등장(스태거)
        // 기간 전환 시 이전 표시 크기에서 새 크기로 스케일 모프
        scale: old
          ? Math.min(2.5, Math.max(0.3, (old.r * old.scale) / r))
          : reduceMotion
            ? 1
            : 0,
      };
    });
    nodesRef.current = nodes;
    setRenderNodes(nodes);

    simRef.current?.stop();
    const sim = forceSimulation(nodes)
      .velocityDecay(0.22)
      .force("x", forceX(W / 2).strength(0.01))
      .force("y", forceY(H / 2).strength(0.01))
      .force(
        "collide",
        forceCollide<Node>()
          .radius((d) => d.r + Math.max(1.5, d.r * 0.05))
          .strength(0.8)
          .iterations(2)
      )
      // 첫 배치는 큰 알파로 정렬하고, 이후 알파 타깃(0.06)으로 수렴시켜
      // 강한 재배치 없이 은은한 흐름만 남긴다. 모션 최소화 시엔 0으로 정지.
      .alpha(isRebuild ? 0.4 : 0.9)
      .alphaDecay(0.028)
      .alphaTarget(reduceMotion ? 0 : 0.06)
      .on("tick", () => {
        const t = performance.now();
        const hoverId = hoverRef.current;
        for (const n of nodes) {
          // 유영 모션: 노드별 사인파 힘 — 랜덤 지터 없이 매끄러운 궤적.
          // 큰 버블일수록 진폭을 줄여 묵직하게 움직인다.
          if (!reduceMotion) {
            const amp = 0.085 * Math.min(1, 20 / n.r);
            n.vx += amp * Math.sin(t * n.w1 + n.wx);
            n.vy += amp * Math.cos(t * n.w2 + n.wy);
          }
          // 소프트 경계: 벽 근처에서 스프링 힘으로 되밀기 (하드 반사 없음)
          const m = 3;
          if (n.x < n.r + m) n.vx += (n.r + m - n.x) * 0.035;
          else if (n.x > W - n.r - m) n.vx -= (n.x - (W - n.r - m)) * 0.035;
          if (n.y < n.r + m) n.vy += (n.r + m - n.y) * 0.035;
          else if (n.y > H - n.r - m) n.vy -= (n.y - (H - n.r - m)) * 0.035;
          // 탈출 방지 클램프 (속도는 건드리지 않는다 — 스프링이 회수)
          n.x = Math.max(n.r, Math.min(W - n.r, n.x));
          n.y = Math.max(n.r, Math.min(H - n.r, n.y));

          // 표시 스케일: 등장(ease-out) × 호버 확대를 지수 보간으로 부드럽게
          let base = 1;
          if (n.born >= 0) {
            const p = Math.min(1, Math.max(0, (t - n.born) / 450));
            base = 1 - Math.pow(1 - p, 3);
            if (p >= 1) n.born = -1;
          }
          const desired = base * (hoverId === n.coin.id ? 1.06 : 1);
          n.scale += (desired - n.scale) * 0.16;

          const g = gEls.current.get(n.coin.id);
          if (g)
            g.setAttribute(
              "transform",
              `translate(${n.x},${n.y}) scale(${Math.max(0.001, n.scale)})`
            );
        }
        // 툴팁이 호버 중인 버블을 따라가게
        if (hoverId && tipRef.current) {
          const n = nodes.find((nn) => nn.coin.id === hoverId);
          if (n) {
            tipRef.current.style.left = `${Math.min(Math.max(6, n.x + 14), Math.max(6, W - 150))}px`;
            tipRef.current.style.top = `${Math.min(Math.max(6, n.y + 14), Math.max(6, H - 74))}px`;
          }
        }
      });
    simRef.current = sim;

    return () => {
      sim.stop();
    };
  }, [coins, field, size]);

  const { w: W, h: H } = size;
  const hovered = hover
    ? renderNodes.find((n) => n.coin.id === hover) ?? null
    : null;

  return (
    <div className="flex h-full flex-col">
      {/* 기간 토글 — 버블 크기·색의 "기준" */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                period === p.key
                  ? "bg-navy-900 text-white"
                  : "bg-paper2 text-navy-500 hover:bg-navy-100"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {updatedAt && updatedAt !== EPOCH && (
          <span className="shrink-0 text-[10px] text-ink-400">
            {formatRelativeTime(updatedAt)} · CoinGecko
          </span>
        )}
      </div>

      <div
        ref={wrapRef}
        className="relative flex-1 overflow-hidden"
        onMouseLeave={() => setHover(null)}
      >
        {W > 0 && H > 0 && (
          <svg width={W} height={H} className="block">
            <defs>
              {/* 중심은 옅고 가장자리로 갈수록 진해지는 라디얼 — 유리구슬 느낌 */}
              <radialGradient id="bm-grad-up">
                <stop offset="0%" stopColor="#e5443b" stopOpacity={0.05} />
                <stop offset="60%" stopColor="#e5443b" stopOpacity={0.08} />
                <stop offset="86%" stopColor="#e5443b" stopOpacity={0.16} />
                <stop offset="100%" stopColor="#e5443b" stopOpacity={0.34} />
              </radialGradient>
              <radialGradient id="bm-grad-down">
                <stop offset="0%" stopColor="#2e7ce6" stopOpacity={0.05} />
                <stop offset="60%" stopColor="#2e7ce6" stopOpacity={0.08} />
                <stop offset="86%" stopColor="#2e7ce6" stopOpacity={0.16} />
                <stop offset="100%" stopColor="#2e7ce6" stopOpacity={0.34} />
              </radialGradient>
              <radialGradient id="bm-grad-flat">
                <stop offset="0%" stopColor="#878e97" stopOpacity={0.04} />
                <stop offset="60%" stopColor="#878e97" stopOpacity={0.06} />
                <stop offset="86%" stopColor="#878e97" stopOpacity={0.12} />
                <stop offset="100%" stopColor="#878e97" stopOpacity={0.26} />
              </radialGradient>
            </defs>
            {renderNodes.map((n) => {
              const it = intensityFor(n.change);
              const isHover = hover === n.coin.id;
              const fillOp = 0.55 + 0.45 * it;
              return (
                <g
                  key={n.coin.id}
                  ref={(el) => {
                    if (el) gEls.current.set(n.coin.id, el);
                    else gEls.current.delete(n.coin.id);
                  }}
                  transform={`translate(${n.x},${n.y}) scale(${Math.max(0.001, n.scale)})`}
                  className="cursor-pointer focus:outline-none"
                  role="button"
                  tabIndex={0}
                  aria-label={`${n.coin.name} (${n.coin.symbol}) ${n.change > 0 ? "+" : ""}${n.change.toFixed(1)}%`}
                  onMouseEnter={() => setHover(n.coin.id)}
                  onFocus={() => setHover(n.coin.id)}
                  onClick={() => setHover((h) => (h === n.coin.id ? null : n.coin.id))}
                >
                  <circle
                    r={n.r}
                    fill={`url(#${gradFor(n.change)})`}
                    fillOpacity={isHover ? Math.min(1, fillOp + 0.3) : fillOp}
                    stroke={colorFor(n.change)}
                    strokeOpacity={isHover ? 0.85 : 0.28 + 0.34 * it}
                    strokeWidth={isHover ? 1.5 : 1}
                  />
                  {n.r > 16 &&
                    (() => {
                      const lr = n.r * 0.36; // 로고 반지름 (텍스트와 겹치지 않게 축소)
                      const lcy = -n.r * 0.25; // 로고 중심 y — 심볼 텍스트와 간격 30% 좁힘
                      const clipId = `logo-clip-${n.coin.id}`;
                      return (
                        <>
                          <clipPath id={clipId}>
                            <circle cx={0} cy={lcy} r={lr} />
                          </clipPath>
                          {/* 흰 배경 원 — 사각/투명 로고도 원형으로 보이게 */}
                          <circle cx={0} cy={lcy} r={lr} fill="#fff" />
                          <image
                            href={n.coin.image}
                            x={-lr}
                            y={lcy - lr}
                            width={lr * 2}
                            height={lr * 2}
                            clipPath={`url(#${clipId})`}
                            preserveAspectRatio="xMidYMid slice"
                          />
                          {/* 얇은 테두리로 원형 경계 또렷하게 */}
                          <circle
                            cx={0}
                            cy={lcy}
                            r={lr}
                            fill="none"
                            stroke="#ffffff"
                            strokeWidth={0.75}
                          />
                        </>
                      );
                    })()}
                  <text
                    textAnchor="middle"
                    y={n.r > 16 ? n.r * 0.46 : 3}
                    fontSize={Math.max(7, n.r * 0.28)}
                    fontWeight={700}
                    fill={textColorFor(n.change)}
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {n.coin.symbol}
                  </text>
                  {n.r > 26 && (
                    <text
                      textAnchor="middle"
                      y={n.r * 0.73}
                      fontSize={Math.max(6, n.r * 0.2)}
                      fill={textColorFor(n.change)}
                      fillOpacity={0.85}
                      style={{ pointerEvents: "none", userSelect: "none" }}
                    >
                      {n.change > 0 ? "+" : ""}
                      {n.change.toFixed(1)}%
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}

        {renderNodes.length === 0 && !error && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-xs text-ink-500">
            <GajaLoader size={16} />
            버블맵 로딩 중…
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <span className="text-xs text-ink-500">데이터를 불러오지 못했어요</span>
            <button
              onClick={() => {
                setError(false);
                void loadBubbles();
              }}
              className="rounded bg-navy-900 px-3 py-1 text-[11px] text-white hover:bg-navy-700"
            >
              다시 시도
            </button>
          </div>
        )}

        {hovered && (
          <div
            ref={tipRef}
            className="pointer-events-none absolute z-10 rounded-[5px] bg-navy-950/90 px-2 py-1.5 text-[11px] text-white shadow-pop"
            style={{
              // 호버한 버블 근처에 띄우되 컨테이너 밖으로 안 나가게 클램핑
              // (이후에는 시뮬레이션 틱이 버블을 따라 위치를 갱신)
              left: Math.min(Math.max(6, hovered.x + 14), Math.max(6, W - 150)),
              top: Math.min(Math.max(6, hovered.y + 14), Math.max(6, H - 74)),
            }}
          >
            <div className="font-semibold">
              {hovered.coin.name} ({hovered.coin.symbol})
            </div>
            <div className="text-navy-100">시총 #{hovered.coin.marketCapRank ?? "-"}</div>
            <div className="text-navy-100">
              ${hovered.coin.priceUsd?.toLocaleString(undefined, { maximumFractionDigits: 6 }) ?? "-"}
            </div>
            <div style={{ color: hovered.change >= 0 ? "#fca5a5" : "#a3a8ea" }}>
              {PERIODS.find((p) => p.key === period)!.label}{" "}
              {hovered.change > 0 ? "+" : ""}
              {hovered.change.toFixed(2)}%
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
