"use client";

import { useState } from "react";
import type { Signal } from "@/lib/signals";
import { toneClass } from "@/lib/signals";
import { formatKrw, formatPercent, formatVolume } from "@/lib/format";
import CoinDrawer, { type DrawerCoin } from "@/components/CoinDrawer";
import EventIcon from "@/components/EventIcon";

function changeColor(n: number): string {
  if (n > 0) return "text-up";
  if (n < 0) return "text-down";
  return "text-ink-500";
}

// 행 그리드 — # / 종목 / 현재가 / 24H / 거래대금 (거래대금은 sm 미만에서 숨김)
// 시그널·김프 컬럼은 테이블에서 제거 — 종목 클릭 시 드로어(CoinDrawer)에서 상세로 노출한다.
const ROW_GRID =
  "grid grid-cols-[22px_minmax(0,1fr)_92px_62px] items-center gap-1 sm:grid-cols-[26px_minmax(0,1fr)_130px_76px_110px]";

// 지금 주목할 코인 — 어텐션 랭킹 테이블, 2a 파이낸스 그레이드 (좌측 메인 컬럼)
export default function SignalRadarBoard({
  items,
  breadth,
  freshness,
}: {
  items: DrawerCoin[];
  breadth: { upPct: number; signal: Signal } | null;
  freshness: string;
}) {
  const [selected, setSelected] = useState<DrawerCoin | null>(null);

  return (
    <section className="overflow-hidden rounded-[14px] border border-line bg-white">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 pt-4 pb-3 sm:px-6">
        <h2 className="text-[17px] font-extrabold tracking-[-0.3px] text-navy-900">지금 주목할 코인</h2>
        <span className="font-mono text-[11px] font-medium text-ink-400">{freshness}</span>
        {breadth && (
          <span
            className={`ml-auto rounded-[7px] px-2.5 py-1 text-[11.5px] font-bold ${toneClass(
              breadth.signal.tone
            )}`}
          >
            {breadth.signal.label} · 상승 {breadth.upPct.toFixed(0)}%
          </span>
        )}
      </header>

      {/* 컬럼 헤더 — mono 10.5px 대문자 스타일 */}
      <div
        className={`${ROW_GRID} border-y border-hairline bg-paper2 px-4 py-2 font-mono text-[10.5px] font-semibold tracking-[0.7px] text-ink-400 sm:px-6`}
      >
        <span>#</span>
        <span>종목</span>
        <span className="text-right">현재가</span>
        <span className="text-right">24H</span>
        <span className="hidden text-right sm:block">거래대금(24H)</span>
      </div>

      {items.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-ink-500">데이터를 불러오지 못했습니다.</p>
      ) : (
        <ul>
          {items.map(({ coin, chips }, idx) => (
            // 데이터 소스가 같은 심볼을 중복 반환할 수 있어 순번을 키에 포함한다
            <li key={`${coin.symbol}-${idx}`} className="border-b border-[#f2f4f8] last:border-b-0">
              <button
                onClick={() => setSelected({ coin, chips })}
                className={`${ROW_GRID} w-full px-4 py-[11px] text-left hover:bg-paper2 sm:px-6`}
              >
                <span className="font-mono text-xs font-medium text-ink-400">{idx + 1}</span>
                <span className="flex min-w-0 items-center gap-2.5">
                  <EventIcon ticker={coin.symbol} size={24} />
                  <b className="truncate text-[13.5px] font-bold text-navy-900">{coin.nameKo}</b>
                  <span className="hidden shrink-0 font-mono text-[11px] font-medium text-ink-400 md:inline">
                    {coin.symbol}
                  </span>
                </span>
                <span className="text-right font-mono text-[13.5px] font-semibold tabular-nums text-navy-900">
                  {formatKrw(coin.priceKrw)}
                </span>
                <span
                  className={`text-right font-mono text-[12.5px] font-semibold tabular-nums ${changeColor(
                    coin.change24h
                  )}`}
                >
                  {formatPercent(coin.change24h)}
                </span>
                <span className="hidden text-right font-mono text-xs font-medium tabular-nums text-ink-500 sm:block">
                  {formatVolume(coin.volumeKrw24h)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="border-t border-[#f2f4f8] px-4 py-[11px] text-[11px] text-ink-400 sm:px-6">
        ※ 등락률과 거래대금(규모·7일 평균 대비 급증) 기준 주목도순 선별입니다. 종목을 누르면 시그널·김프 상세와 업비트·바이낸스 링크가 열립니다. 스테이블코인·거래대금 10억원 미만은 제외.
      </p>

      <CoinDrawer item={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
