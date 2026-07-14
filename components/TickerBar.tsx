"use client";

import { useEffect, useState } from "react";
import type { TickerSnapshot } from "@/lib/ticker";
import { formatKrw, formatPercent } from "@/lib/format";
import GajaLoader from "@/components/GajaLoader";

function changeColor(n: number | null): string {
  if (n == null) return "text-ink-300";
  if (n > 0) return "text-up";
  if (n < 0) return "text-down";
  return "text-ink-300";
}

export default function TickerBar() {
  const [snapshot, setSnapshot] = useState<TickerSnapshot | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (typeof document !== "undefined" && document.hidden) return; // 백그라운드 탭은 폴링 정지
      try {
        const res = await fetch("/api/ticker");
        if (!res.ok) throw new Error("non-ok");
        const data = (await res.json()) as TickerSnapshot;
        if (alive) {
          setSnapshot(data);
          setError(false);
        }
      } catch {
        if (alive) setError(true); // 인라인 오류 표시
      }
    };
    load();
    const id = setInterval(load, 60_000); // 캐시 TTL과 균형 — 호출 비용 절감
    const onVisible = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const items = snapshot?.tickers.filter((t) => t.priceKrw != null) ?? [];

  return (
    // 티커 테이프 — 36px 화이트 바, mono 12px.
    // 무한 루프: 동일한 복사본 2개를 나란히 두고 트랙을 -50% 이동 — 복사본 폭(pr 포함)만큼
    // 정확히 이동한 시점에 처음과 같은 화면이 되어 끊김 없이 반복된다.
    <div className="flex h-9 items-center border-b border-line bg-white">
      <div className="min-w-0 flex-1 overflow-hidden">
        {error ? (
          <span className="px-4 font-mono text-xs font-medium text-up">시세 불러오기 실패</span>
        ) : items.length === 0 ? (
          <span className="flex items-center gap-2 px-4 font-mono text-xs font-medium text-ink-400">
            <GajaLoader size={14} />
            마켓 데이터 불러오는 중…
          </span>
        ) : (
          <div className="ticker-track flex w-max">
            {[0, 1].map((copy) => (
              <div
                key={copy}
                aria-hidden={copy === 1}
                className="flex items-center gap-10 pr-10 font-mono text-xs font-medium whitespace-nowrap text-navy-600"
              >
                {items.map((t) => (
                  <span key={t.symbol} className="flex items-center gap-1.5">
                    <span>{t.symbol}</span>
                    <span className="font-semibold text-navy-900">{formatKrw(t.priceKrw)}</span>
                    <span className={changeColor(t.change24h)}>{formatPercent(t.change24h)}</span>
                    {t.kimchiPremium != null && (
                      <span className="text-ink-400">김프 {formatPercent(t.kimchiPremium)}</span>
                    )}
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
