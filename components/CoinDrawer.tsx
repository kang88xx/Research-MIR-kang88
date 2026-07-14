"use client";

import Image from "next/image";
import { useEffect } from "react";
import EventIcon from "@/components/EventIcon";
import type { RadarCoin } from "@/lib/ticker";
import type { Signal } from "@/lib/signals";
import { toneClass } from "@/lib/signals";
import { formatKrw, formatPercent, formatVolume } from "@/lib/format";

function changeColor(n: number | null): string {
  if (n == null) return "text-ink-500";
  if (n > 0) return "text-red-600";
  if (n < 0) return "text-indigo-700";
  return "text-ink-500";
}

export type DrawerCoin = { coin: RadarCoin; chips: Signal[] };

export default function CoinDrawer({
  item,
  onClose,
}: {
  item: DrawerCoin | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (item) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [item, onClose]);

  if (!item) return null;
  const { coin, chips } = item;
  const upbitUrl = `https://upbit.com/exchange?code=CRIX.UPBIT.KRW-${coin.symbol}`;
  const binanceUrl = `https://www.binance.com/en/trade/${coin.symbol}_USDT`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md border border-line bg-white p-6 sm:rounded"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between">
          <h3 className="flex items-center gap-2 text-xl font-bold text-navy-900">
            <EventIcon ticker={coin.symbol} size={26} upbitLogo />
            {coin.nameKo}
            <span className="font-mono text-xs font-medium tracking-wide text-ink-400">{coin.symbol}</span>
          </h3>
          <span className="font-mono text-lg text-ink-900">{formatKrw(coin.priceKrw)}원</span>
        </div>

        {chips.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {chips.map((c, i) => (
              <span
                key={i}
                className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${toneClass(c.tone)}`}
              >
                {c.label}
              </span>
            ))}
          </div>
        )}

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4 text-sm">
          <div>
            <dt className="text-[11px] text-ink-500">24h 변동</dt>
            <dd className={`font-mono font-semibold ${changeColor(coin.change24h)}`}>
              {formatPercent(coin.change24h)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-ink-500">김치프리미엄</dt>
            <dd className={`font-mono font-semibold ${changeColor(coin.kimchi)}`}>
              {coin.kimchi != null ? formatPercent(coin.kimchi) : "–"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-ink-500">24h 거래대금</dt>
            <dd className="font-mono text-ink-900">{formatVolume(coin.volumeKrw24h)}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-ink-500">거래대금 순위</dt>
            <dd className="font-mono text-ink-900">{coin.volumeRank}위</dd>
          </div>
        </dl>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <a
            href={upbitUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 border border-navy-300 py-2 text-center text-sm font-medium text-navy-900 hover:border-navy-900"
          >
            <Image src="/upbit.png" alt="업비트" width={16} height={16} className="rounded-sm" />
            업비트에서 보기 ↗
          </a>
          <a
            href={binanceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 border border-navy-300 py-2 text-center text-sm font-medium text-navy-900 hover:border-navy-900"
          >
            <Image src="/binance.jpg" alt="바이낸스" width={16} height={16} className="rounded-sm" />
            바이낸스 ↗
          </a>
        </div>

        <button
          onClick={onClose}
          className="mt-3 w-full py-2 text-center text-sm text-ink-500 hover:text-navy-900"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
