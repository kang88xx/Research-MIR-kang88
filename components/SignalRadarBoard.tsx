"use client";

import { useState } from "react";
import type { Signal } from "@/lib/signals";
import { toneClass } from "@/lib/signals";
import { formatKrw, formatPercent } from "@/lib/format";
import CoinDrawer, { type DrawerCoin } from "@/components/CoinDrawer";
import EventIcon from "@/components/EventIcon";

function changeColor(n: number): string {
  if (n > 0) return "text-up";
  if (n < 0) return "text-down";
  return "text-ink-500";
}

// 행 그리드 — # / 종목 / 현재가 / 24H / 시그널 / 김프 (시그널·김프는 sm 미만에서 숨김)
const ROW_GRID =
  "grid grid-cols-[22px_minmax(0,1fr)_92px_62px] items-center gap-1 sm:grid-cols-[26px_minmax(0,1fr)_104px_68px_minmax(0,176px)_56px]";

// 실시간 시세 테이블 — 2a 파이낸스 그레이드 (좌측 메인 컬럼)
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
        <h2 className="text-[17px] font-extrabold tracking-[-0.3px] text-navy-900">실시간 시세</h2>
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
        <span className="hidden pl-4 sm:block">시그널</span>
        <span className="hidden text-right sm:block">김프</span>
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
                <span className="hidden min-w-0 flex-wrap gap-[5px] pl-4 sm:flex">
                  {chips.map((c, i) => (
                    <span
                      key={i}
                      className={`rounded-[5px] px-[7px] py-0.5 text-[10.5px] font-bold whitespace-nowrap ${toneClass(
                        c.tone
                      )}`}
                    >
                      {c.label}
                    </span>
                  ))}
                </span>
                <span className="hidden text-right font-mono text-xs font-medium tabular-nums sm:block">
                  {coin.kimchi != null ? (
                    <span className={changeColor(coin.kimchi)}>{formatPercent(coin.kimchi)}</span>
                  ) : (
                    <span className="text-ink-300">—</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="border-t border-[#f2f4f8] px-4 py-[11px] text-[11px] text-ink-400 sm:px-6">
        ※ 스테이블코인(USDT·USDC 등)은 시세 변동 신호 대상이 아니므로 표시하지 않습니다.
      </p>

      <CoinDrawer item={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
