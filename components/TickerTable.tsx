"use client";

import { useEffect, useState } from "react";
import type { TickerSnapshot } from "@/lib/ticker";
import { formatKrw, formatPercent, formatVolume } from "@/lib/format";
import GajaLoader from "@/components/GajaLoader";

function changeColor(n: number | null): string {
  if (n == null) return "text-ink-500";
  if (n > 0) return "text-red-600";
  if (n < 0) return "text-indigo-700";
  return "text-ink-500";
}

export default function TickerTable() {
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
        if (alive) setError(true); // 재시도 버튼 표시
      }
    };
    load();
    const id = setInterval(load, 60_000);
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

  return (
    <section className="rounded-xl border border-line bg-white shadow-card overflow-hidden transition-shadow hover:shadow-pop">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-white px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900"><span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />실시간 시세</h2>
        <span className="font-mono text-[10px] tracking-[0.12em] text-ink-500 uppercase">
          UPBIT · USD/KRW {snapshot ? snapshot.usdKrw.toLocaleString() : "–"}
        </span>
      </header>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-paper2 font-medium text-ink-700">
            <th className="px-4 py-2 text-left font-normal text-ink-700">코인</th>
            <th className="px-2 py-2 text-right font-normal text-ink-700">시세(원)</th>
            <th className="px-2 py-2 text-right font-normal text-ink-700">24H</th>
            <th className="px-4 py-2 text-right font-normal text-ink-500">김프</th>
          </tr>
        </thead>
        <tbody>
          {error ? (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center">
                <span className="text-xs text-ink-500">시세를 불러오지 못했어요</span>
                <button
                  onClick={() => {
                    setError(false);
                    void fetch("/api/ticker")
                      .then(async (res) => {
                        if (!res.ok) throw new Error("non-ok");
                        const data = (await res.json()) as TickerSnapshot;
                        setSnapshot(data);
                        setError(false);
                      })
                      .catch(() => setError(true));
                  }}
                  className="ml-2 rounded bg-navy-900 px-2 py-0.5 text-[11px] text-white hover:bg-navy-700"
                >
                  다시 시도
                </button>
              </td>
            </tr>
          ) : snapshot == null ? (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-ink-500">
                <span className="inline-flex items-center gap-2">
                  <GajaLoader size={15} />
                  시세 불러오는 중…
                </span>
              </td>
            </tr>
          ) : (
            snapshot.tickers.map((t) => (
              <tr key={t.symbol} className="border-t border-line">
                <td className="px-4 py-2">
                  <span className="font-semibold text-navy-900">{t.symbol}</span>
                </td>
                <td
                  className="px-2 py-2 text-right font-mono text-ink-900"
                  title={`거래대금 ${formatVolume(t.volumeKrw24h)}`}
                >
                  {formatKrw(t.priceKrw)}
                </td>
                <td className={`px-2 py-2 text-right font-mono ${changeColor(t.change24h)}`}>
                  {formatPercent(t.change24h)}
                </td>
                <td className="px-4 py-2 text-right">
                  <span
                    className={`inline-block px-1.5 py-0.5 font-mono ${
                      t.kimchiPremium != null && t.kimchiPremium > 0
                        ? "bg-amber-300/50 text-navy-900"
                        : "text-ink-500"
                    }`}
                  >
                    {formatPercent(t.kimchiPremium)}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
