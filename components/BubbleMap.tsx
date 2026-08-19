"use client";

// d3-force 시뮬레이션 + 캔버스 렌더러. SVG(노드별 DOM 리페인트)는 버블 100개에서
// 프레임 비용이 커서 랙이 났고, 캔버스 한 장에 매 틱 직접 그려 60fps 모션을 유지한다.
// React는 캔버스·오버레이(툴팁/카드) 구조만 렌더하고 그리기는 draw()가 전담한다.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  forceSimulation,
  forceCollide,
  forceX,
  forceY,
  type Simulation,
} from "d3-force";
import Spinner from "@/components/Spinner";
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

type CoinExchange = {
  name: string;
  identifier: string;
  url: string;
};

// 거래소 조회 결과 — failed는 "서버가 조회에 실패했다"는 뜻(상장 정보 없음과 구분)
type ExResult = { list: CoinExchange[]; failed: boolean };

// CoinGecko 거래소 id → 한글 라벨 (없으면 CoinGecko 표시명 그대로)
const EXCHANGE_KO: Record<string, string> = {
  upbit: "업비트",
  binance: "바이낸스",
  bithumb: "빗썸",
  coinone: "코인원",
  korbit: "코빗",
  gdax: "코인베이스",
  coinbase_international: "코인베이스",
  okex: "OKX",
  bybit_spot: "바이비트",
  kraken: "크라켄",
  kucoin: "쿠코인",
  gate: "게이트",
  mexc: "MEXC",
  huobi: "HTX",
  htx: "HTX",
  bitget: "비트겟",
  bitfinex: "비트파이넥스",
  crypto_com: "크립토닷컴",
  hyperliquid_spot: "하이퍼리퀴드",
  "hyperliquid-spot": "하이퍼리퀴드",
};

const exchangeLabel = (e: CoinExchange) => EXCHANGE_KO[e.identifier] ?? e.name;

// CoinGecko 거래소 id → 로컬 로고 (public/logos/exchanges/). 없는 거래소는 텍스트만.
const EXCHANGE_LOGO: Record<string, string> = {
  upbit: "Upbit",
  binance: "Binance",
  bithumb: "Bithumb",
  coinone: "Coinone",
  korbit: "Korbit",
  gdax: "Coinbase",
  coinbase_international: "Coinbase",
  okex: "OKX",
  bybit_spot: "Bybit",
  kraken: "Kraken",
  kucoin: "KuCoin",
  gate: "Gate",
  mexc: "MEXC",
  huobi: "HTX",
  htx: "HTX",
  bitget: "Bitget",
  bitfinex: "Bitfinex",
  crypto_com: "CryptoCom",
  hyperliquid_spot: "Hyperliquid",
  "hyperliquid-spot": "Hyperliquid",
};

// 버튼 앞 14px 거래소 로고 — 파일이 없으면 조용히 숨긴다(텍스트 버튼으로 폴백)
function ExchangeLogo({ src }: { src: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="h-3.5 w-3.5 shrink-0 rounded-full object-cover"
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  );
}

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
  const [selected, setSelected] = useState<string | null>(null);
  // 클릭 커서 위치 (컨테이너 기준) — PC(파인 포인터)에서 링크 카드를 커서 옆에 띄우는 앵커.
  // null이면(키보드 선택·모바일) 하단 중앙 폴백.
  const [selPos, setSelPos] = useState<{ x: number; y: number } | null>(null);
  const [renderNodes, setRenderNodes] = useState<Node[]>([]);
  // 첫 배치 수렴 완료 여부 — 정착 전에는 로딩을 유지해 초기 충돌 정렬(랙처럼 보임)을 숨긴다
  const [settled, setSettled] = useState(false);
  // 로고 프리로드 완료 여부 — 원격 로고 100장이 늦게 떠서 생기는 랙도 로딩 뒤로 숨긴다
  const [assetsReady, setAssetsReady] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const nodesRef = useRef<Node[]>([]);
  const simRef = useRef<Simulation<Node, undefined> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // 프리로드한 로고 이미지를 그대로 draw에 재사용 (재요청 0)
  const imgCache = useRef(new Map<string, HTMLImageElement>());
  // 시뮬레이션 정지 상태(모션 최소화)에서 호버 변화 시 수동 리드로용
  const drawRef = useRef<() => void>(() => {});
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
      const w = Math.round(width);
      const h = Math.round(height);
      // 반올림 결과가 같으면 이전 객체 유지 — 서브픽셀 리사이즈마다 시뮬레이션 전체가
      // 재구축(노드 scale·born 리셋)되던 문제 방지
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
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
    // 서버 캐시 TTL(5분)과 정렬 — 5분짜리 시총 데이터를 1분마다 폴링할 이유가 없음 (codex 교차검수)
    const t = setInterval(tick, 5 * 60_000);
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

  // 로고 프리로드 — 70% 이상 로드되거나 2.5초 상한이 지나면 공개 (실패 이미지도 카운트)
  useEffect(() => {
    if (coins.length === 0) return;
    let done = 0;
    let finished = false;
    const need = Math.ceil(coins.length * 0.7);
    const finish = () => {
      if (finished) return;
      finished = true;
      if (aliveRef.current) setAssetsReady(true);
    };
    const timeout = setTimeout(finish, 2500);
    coins.forEach((c) => {
      if (!c.image) {
        if (++done >= need) finish();
        return;
      }
      const cached = imgCache.current.get(c.image);
      if (cached?.complete) {
        if (++done >= need) finish();
        return;
      }
      // crossOrigin 미지정 — CDN 캐시에 CORS 헤더 없는 응답이 남아 있으면 anonymous 모드가
      // 차단돼 로고가 통째로 빠진다. 캔버스 픽셀을 읽지 않으므로(taint 무해) 일반 모드로 로드.
      const img = new Image();
      img.onload = () => {
        if (++done >= need) finish();
        // 공개 이후(특히 시뮬레이션 정지 상태) 늦게 도착한 로고도 그려지게 리드로
        requestAnimationFrame(() => drawRef.current());
      };
      img.onerror = () => {
        if (++done >= need) finish();
      };
      img.src = c.image;
      imgCache.current.set(c.image, img);
    });
    return () => clearTimeout(timeout);
  }, [coins]);

  const ready = settled && assetsReady;

  // 공개 시점에 등장 스태거를 다시 찍는다 — 오버레이 뒤에서 이미 끝나버린 팝인을 재생하기 위함
  const revealedRef = useRef(false);
  useEffect(() => {
    if (!ready || revealedRef.current) return;
    revealedRef.current = true;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    if (reduce) return;
    const t0 = performance.now();
    nodesRef.current.forEach((n, i) => {
      n.born = t0 + i * 12;
      n.scale = 0;
    });
  }, [ready]);

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

    // ── 캔버스 렌더러 — SVG(노드별 DOM 리페인트)의 프레임 비용이 랙의 주범이라
    // 한 장의 캔버스에 직접 그린다. 프레임당 2~5ms 수준으로 유영 모션이 60fps 유지.
    const rgba = (hex: string, a: number) => {
      const v = parseInt(hex.slice(1), 16);
      return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
    };
    // 캔버스는 CSS 변수를 못 읽으므로 텍스트 토큰을 1회 해석 (다크 모드 값 그대로)
    const cssVar = (name: string, fb: string) =>
      getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb;
    const TXT = {
      up: cssVar("--bm-text-up", "#8f1f1a"),
      down: cssVar("--bm-text-down", "#1d4f9c"),
      flat: cssVar("--bm-text-flat", "#4b5563"),
    };
    const txtFor = (c: number) => (c > 0.05 ? TXT.up : c < -0.05 ? TXT.down : TXT.flat);
    const FONT = `-apple-system, "Apple SD Gothic Neo", sans-serif`;

    const draw = () => {
      const cv = canvasRef.current;
      const ctx = cv?.getContext("2d");
      if (!cv || !ctx) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const pw = Math.round(W * dpr);
      if (cv.width !== pw || cv.height !== Math.round(H * dpr)) {
        cv.width = pw;
        cv.height = Math.round(H * dpr);
        cv.style.width = `${W}px`;
        cv.style.height = `${H}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const hoverId = hoverRef.current;

      for (const n of nodes) {
        const s = Math.max(0, n.scale);
        if (s < 0.02) continue;
        const r = n.r * s;
        const isHover = hoverId === n.coin.id;
        const it = intensityFor(n.change);
        const base = colorFor(n.change);
        const flat = !(n.change > 0.05 || n.change < -0.05);
        // SVG 라디얼 그라디언트와 동일 스탑 — 중심 옅고 가장자리 진한 유리구슬
        const stops: [number, number][] = flat
          ? [[0, 0.04], [0.6, 0.06], [0.86, 0.12], [1, 0.26]]
          : [[0, 0.05], [0.6, 0.08], [0.86, 0.16], [1, 0.34]];
        const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r);
        for (const [o, a] of stops) grad.addColorStop(o, rgba(base, a));
        const fillOp = 0.55 + 0.45 * it;
        ctx.globalAlpha = isHover ? Math.min(1, fillOp + 0.3) : fillOp;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.globalAlpha = isHover ? 0.85 : 0.28 + 0.34 * it;
        ctx.lineWidth = isHover ? 1.5 : 1;
        ctx.strokeStyle = base;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // 로고 — 흰 원 배경 + 원형 클리핑 (프리로드 캐시 재사용, 미로드 시 배경 원만)
        if (n.r > 16) {
          const lr = n.r * 0.36 * s;
          const lcy = n.y - n.r * 0.25 * s;
          ctx.beginPath();
          ctx.arc(n.x, lcy, lr, 0, Math.PI * 2);
          ctx.fillStyle = "#fff";
          ctx.fill();
          const img = n.coin.image ? imgCache.current.get(n.coin.image) : undefined;
          if (img?.complete && img.naturalWidth > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(n.x, lcy, lr, 0, Math.PI * 2);
            ctx.clip();
            const iw = img.naturalWidth;
            const ih = img.naturalHeight;
            const sq = Math.min(iw, ih); // preserveAspectRatio slice와 동일한 중앙 크롭
            ctx.drawImage(img, (iw - sq) / 2, (ih - sq) / 2, sq, sq, n.x - lr, lcy - lr, lr * 2, lr * 2);
            ctx.restore();
          }
          ctx.beginPath();
          ctx.arc(n.x, lcy, lr, 0, Math.PI * 2);
          ctx.lineWidth = 0.75;
          ctx.strokeStyle = "#ffffff";
          ctx.stroke();
        }

        // 텍스트 — 심볼(+큰 버블은 변동률). SVG의 baseline 오프셋 그대로.
        ctx.textAlign = "center";
        ctx.fillStyle = txtFor(n.change);
        ctx.font = `700 ${Math.max(7, n.r * 0.28) * s}px ${FONT}`;
        ctx.fillText(n.coin.symbol, n.x, n.y + (n.r > 16 ? n.r * 0.46 : 3) * s);
        if (n.r > 26) {
          ctx.font = `400 ${Math.max(6, n.r * 0.2) * s}px ${FONT}`;
          ctx.globalAlpha = 0.85;
          ctx.fillText(
            `${n.change > 0 ? "+" : ""}${n.change.toFixed(1)}%`,
            n.x,
            n.y + n.r * 0.73 * s
          );
          ctx.globalAlpha = 1;
        }
      }
    };
    drawRef.current = draw;

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
      .stop()
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
        }
        draw();
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

    // 사전 수렴 — 랜덤 산포/기간 전환의 충돌 정렬 과정을 화면에 보여주지 않고(랙처럼 보임)
    // 동기 tick으로 미리 풀어둔 뒤 렌더한다. tick()은 "tick" 이벤트를 쏘지 않아 그리기 비용 0.
    sim.tick(isRebuild ? 90 : 140);
    draw();
    sim.restart();
    setSettled(true);

    return () => {
      sim.stop();
    };
  }, [coins, field, size]);

  // 선택 카드 닫기 — ESC
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected]);

  // 선택 코인의 상장 거래소 상위 3곳 — 호버 시 선반입(prefetch) + 세션 내 캐시.
  // null = 로딩 중(거래소 버튼 자리 비움), [] = 상장 정보 없음(코인게코 버튼만).
  // exFailed = 서버가 조회 실패를 알린 상태(레이트리밋 등) — 캐시하지 않고 재선택 시 재시도.
  const [exchanges, setExchanges] = useState<CoinExchange[] | null>(null);
  const [exFailed, setExFailed] = useState(false);
  // 진행 중 요청(중복 발사 방지) / 완료된 결과(동기 조회로 스피너 깜빡임 제거)를 나눠 들고 있다
  const exInflightRef = useRef(new Map<string, Promise<ExResult>>());
  const exSettledRef = useRef(new Map<string, ExResult>());

  const loadExchanges = useCallback((id: string): Promise<ExResult> => {
    const settled = exSettledRef.current.get(id);
    if (settled) return Promise.resolve(settled);
    const running = exInflightRef.current.get(id);
    if (running) return running;

    const p = fetch(`/api/bubbles/tickers?id=${encodeURIComponent(id)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("non-ok"))))
      .then((json): ExResult => {
        const list: CoinExchange[] = Array.isArray(json.exchanges)
          ? json.exchanges.slice(0, 3)
          : [];
        // 서버 조회 실패 마커(updatedAt=epoch)는 캐시하지 않는다 — 다시 선택하면 재시도.
        const failed = json.updatedAt === EPOCH;
        const result = { list, failed };
        if (!failed) exSettledRef.current.set(id, result);
        return result;
      })
      // 네트워크 실패 — 코인게코 버튼만 노출, 캐시 안 함
      .catch((): ExResult => ({ list: [], failed: true }))
      .finally(() => exInflightRef.current.delete(id));

    exInflightRef.current.set(id, p);
    return p;
  }, []);

  // 호버 선반입 — 콜드 캐시일 때 서버가 레이트리밋 큐(코인당 2.2초)를 거치므로, 클릭을
  // 기다렸다 시작하면 카드가 몇 초간 비어 있다. 커서가 잠깐 머무는 동안 미리 받아두면
  // 대부분의 클릭이 이미 도착한 결과를 즉시 그린다. 180ms 디바운스로 버블 위를 훑고
  // 지나갈 때 100개를 무더기로 요청하는 것을 막는다(서버 큐 포화 방지).
  useEffect(() => {
    if (!hover) return;
    const t = setTimeout(() => void loadExchanges(hover), 180);
    return () => clearTimeout(t);
  }, [hover, loadExchanges]);

  useEffect(() => {
    if (!selected) return;
    // 선반입이 끝났으면 로딩 상태를 거치지 않고 바로 확정 — 스피너가 한 프레임 깜빡이지 않게
    const settled = exSettledRef.current.get(selected);
    if (settled) {
      setExchanges(settled.list);
      setExFailed(settled.failed);
      return;
    }
    setExchanges(null);
    setExFailed(false);
    let alive = true;
    loadExchanges(selected).then((r) => {
      if (!alive) return;
      setExchanges(r.list);
      setExFailed(r.failed);
    });
    return () => {
      alive = false;
    };
  }, [selected, loadExchanges]);

  const { w: W, h: H } = size;

  // 캔버스 히트 테스트 — 나중에 그린(배열 뒤쪽) 버블이 위에 있으므로 역순 탐색
  const hitTest = useCallback((x: number, y: number): Node | null => {
    const nodes = nodesRef.current;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const dr = n.r * Math.max(0.001, n.scale);
      const dx = x - n.x;
      const dy = y - n.y;
      if (dx * dx + dy * dy <= dr * dr) return n;
    }
    return null;
  }, []);

  // 시뮬레이션이 멈춘 상태(모션 최소화)에서도 호버 강조가 그려지게 수동 리드로
  useEffect(() => {
    const raf = requestAnimationFrame(() => drawRef.current());
    return () => cancelAnimationFrame(raf);
  }, [hover]);

  const hovered = hover
    ? renderNodes.find((n) => n.coin.id === hover) ?? null
    : null;
  const sel = selected
    ? renderNodes.find((n) => n.coin.id === selected) ?? null
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
            {formatRelativeTime(updatedAt)}
          </span>
        )}
      </div>

      <div
        ref={wrapRef}
        className="relative flex-1 overflow-hidden"
        onMouseLeave={() => setHover(null)}
      >
        {W > 0 && H > 0 && ready && (
          <canvas
            ref={canvasRef}
            className="reveal block"
            role="img"
            aria-label="시가총액 상위 100 버블맵 — 버블을 클릭하면 거래소 바로가기 카드가 열립니다"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const hit = hitTest(e.clientX - rect.left, e.clientY - rect.top);
              e.currentTarget.style.cursor = hit ? "pointer" : "default";
              setHover((h) => (hit ? (h === hit.coin.id ? h : hit.coin.id) : h === null ? h : null));
            }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;
              const hit = hitTest(x, y);
              if (!hit) {
                setSelected(null);
                return;
              }
              // PC(파인 포인터)는 커서 위치에 카드 앵커 — 모바일·터치는 하단 폴백
              const fine =
                typeof window !== "undefined" &&
                window.matchMedia?.("(pointer: fine)").matches === true;
              setSelPos(fine ? { x, y } : null);
              setSelected((s) => (s === hit.coin.id ? null : hit.coin.id));
            }}
          />
        )}

        {(!ready || renderNodes.length === 0) && !error && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-white text-xs text-ink-500">
            <Spinner size={16} />
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

        {hovered && hovered.coin.id !== selected && (
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

        {/* 클릭 선택 카드 — 코인게코·거래소 바로가기 (외부 링크만, 추가 API 호출 없음).
            PC는 클릭한 커서 옆에 앵커(컨테이너 밖으로 안 나가게 클램핑), 모바일·좁은 화면은 하단 중앙. */}
        {sel &&
          (() => {
            const CARD_W = 320;
            const CARD_H = 168; // 대략 높이(버튼 2행 기준) — 하단 클램핑용
            const anchored = selPos != null && W >= CARD_W + 16;
            const style = anchored
              ? {
                  left: Math.min(Math.max(8, selPos.x + 12), W - CARD_W - 8),
                  top: Math.min(Math.max(8, selPos.y + 12), Math.max(8, H - CARD_H - 8)),
                  width: CARD_W,
                }
              : undefined;
            return (
              <div
                className={`absolute z-20 rounded-[6px] border border-line bg-white p-3 shadow-pop ${
                  anchored
                    ? ""
                    : "bottom-2 left-1/2 w-[min(320px,calc(100%-16px))] -translate-x-1/2"
                }`}
                style={style}
                onClick={(e) => e.stopPropagation()}
              >
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sel.coin.image}
                alt=""
                width={22}
                height={22}
                className="rounded-full"
              />
              <b className="truncate text-[13px] font-bold text-navy-900">{sel.coin.name}</b>
              <span className="font-mono text-[11px] font-medium text-ink-400">{sel.coin.symbol}</span>
              <button
                onClick={() => setSelected(null)}
                aria-label="닫기"
                className="ml-auto grid h-5 w-5 shrink-0 place-items-center rounded text-[13px] leading-none text-ink-400 hover:bg-paper2 hover:text-navy-900"
              >
                ×
              </button>
            </div>
            <div className="mt-1.5 flex items-baseline gap-2 font-mono text-[11.5px] tabular-nums">
              <span className="font-semibold text-navy-900">
                ${sel.coin.priceUsd?.toLocaleString(undefined, { maximumFractionDigits: 6 }) ?? "-"}
              </span>
              <span style={{ color: sel.change >= 0 ? "var(--bm-text-up)" : "var(--bm-text-down)" }}>
                {PERIODS.find((p) => p.key === period)!.label} {sel.change > 0 ? "+" : ""}
                {sel.change.toFixed(2)}%
              </span>
              <span className="ml-auto text-[10.5px] text-ink-400">시총 #{sel.coin.marketCapRank ?? "-"}</span>
            </div>
            {/* 실제 상장된 거래소(거래대금 상위 최대 3곳) + 코인게코는 항상 마지막.
                심볼로 URL을 조립하던 방식은 미상장 코인에도 업비트 버튼이 뜨던 문제가 있어
                CoinGecko tickers 기반(/api/bubbles/tickers)으로 교체. */}
            {(() => {
              const exs = exchanges ?? [];
              const total = exs.length + 1; // + 코인게코
              const cols = total === 4 ? 2 : total;
              const btnCls =
                "flex items-center justify-center gap-1 rounded-[5px] border border-line px-1 py-1.5 text-navy-900 hover:border-navy-900";
              return (
                <>
                  <div
                    className="mt-2 grid gap-1.5 text-center text-[11px] font-semibold"
                    style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                  >
                    {exs.map((e) => (
                      <a
                        key={e.identifier}
                        href={e.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={btnCls}
                      >
                        {EXCHANGE_LOGO[e.identifier] && (
                          <ExchangeLogo src={`/logos/exchanges/${EXCHANGE_LOGO[e.identifier]}.png`} />
                        )}
                        <span className="truncate">{exchangeLabel(e)} ↗</span>
                      </a>
                    ))}
                    {/* 코인게코 한국어 URL은 경로 세그먼트도 번역됨 — /ko/coins/는 404, /ko/코인/이 정상 */}
                    <a
                      href={`https://www.coingecko.com/ko/코인/${encodeURIComponent(sel.coin.id)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={btnCls}
                    >
                      <ExchangeLogo src="/coingecko.png" />
                      <span className="truncate">코인게코 ↗</span>
                    </a>
                  </div>
                  {exchanges === null ? (
                    <p className="mt-1.5 flex items-center justify-center gap-1.5 text-center text-[10px] text-ink-400">
                      <Spinner size={11} />
                      상장 거래소 확인 중…
                    </p>
                  ) : exFailed ? (
                    <p className="mt-1.5 text-center text-[10px] text-ink-400">
                      거래소 정보를 못 불러왔어요 — 잠시 후 다시 선택해 주세요
                    </p>
                  ) : exs.length === 0 ? (
                    <p className="mt-1.5 text-center text-[10px] text-ink-400">
                      주요 거래소 상장 정보 없음
                    </p>
                  ) : null}
                </>
              );
            })()}
          </div>
            );
          })()}
      </div>
    </div>
  );
}
