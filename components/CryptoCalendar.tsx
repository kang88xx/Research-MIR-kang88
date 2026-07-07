"use client";

import { useEffect, useMemo, useState } from "react";
import EventIcon from "@/components/EventIcon";

type EventSource = {
  name: string;
  url: string;
  tier?: 1 | 2 | 3;
  isOfficial?: boolean;
};

type CalendarEvent = {
  id: number;
  date: string;
  isTba: boolean;
  ticker: string;
  title: string;
  description: string;
  category: string;
  groupMain: string;
  groupSub: string;
  sourceUrl: string | null;
  dateStatus?: string; // confirmed | estimated | tba | revised | postponed | cancelled
  importance?: number; // 1~3
  sources?: EventSource[]; // 수집된 모든 출처 (없으면 sourceUrl 폴백)
};

// 날짜 상태 뱃지 — confirmed(기본)는 표시하지 않음
const DATE_STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  estimated: { label: "추정", cls: "bg-amber-500/15 text-amber-700" },
  revised: { label: "날짜 변경", cls: "bg-amber-500/15 text-amber-700" },
  postponed: { label: "연기", cls: "bg-red-500/15 text-red-700" },
  cancelled: { label: "취소", cls: "bg-red-500/15 text-red-700" },
};

// 필터 탭 기본 분류 체계 (이벤트 데이터에 새 분류가 있으면 자동 추가됨)
const TAXONOMY: Record<string, string[]> = {
  크립토: ["언락", "TGE·상장", "상폐·리스크", "거래소", "파트너십", "프로젝트", "컨퍼런스"],
  주식: ["실적·발표", "IPO", "컨퍼런스", "지수"],
  매크로: ["경제지표", "금리결정", "정치·정책", "지정학"],
  이벤트: ["스포츠"],
};

const filterKey = (group: string, sub: string) => `${group}|${sub}`;

const CATEGORY_LABEL: Record<string, string> = {
  important: "중요",
  good: "호재",
  bad: "악재",
  neutral: "중립",
};

const BADGE_STYLE: Record<string, string> = {
  important: "bg-indigo-500/15 text-indigo-700",
  good: "bg-emerald-500/15 text-emerald-700",
  bad: "bg-red-500/15 text-red-700",
  neutral: "bg-paper2 text-ink-500",
};

// 그룹별 색상 — 필터 pill과 달력 이벤트 칩에 동일하게 적용되어 색 자체가 범례가 됨
type GroupStyle = { solid: string; text: string; dot: string; chip: string };
const GROUP_COLORS: Record<string, GroupStyle> = {
  크립토: {
    solid: "bg-indigo-500 text-white",
    text: "text-indigo-700",
    dot: "bg-indigo-500",
    chip: "border-indigo-500/40 bg-indigo-500/10 text-indigo-700",
  },
  주식: {
    solid: "bg-emerald-500 text-white",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
    chip: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
  },
  매크로: {
    solid: "bg-warn text-white",
    text: "text-warn",
    dot: "bg-warn",
    chip: "border-warn/40 bg-warn/10 text-warn",
  },
  이벤트: {
    solid: "bg-rose-500 text-white",
    text: "text-rose-700",
    dot: "bg-rose-500",
    chip: "border-rose-500/40 bg-rose-500/10 text-rose-700",
  },
};
const GROUP_FALLBACK: GroupStyle = {
  solid: "bg-navy-700 text-white",
  text: "text-navy-700",
  dot: "bg-navy-500",
  chip: "border-navy-300/50 bg-paper2 text-navy-700",
};
const groupColor = (g: string): GroupStyle => GROUP_COLORS[g] ?? GROUP_FALLBACK;

const KST_OFFSET = 9 * 3600_000;
const IMMINENT_MS = 12 * 3600_000; // 시작 12시간 전부터 강조

// 확정 시각이 있는 이벤트만 Date 반환 (00:00:00 UTC = 시각 미지정 → null)
// KST 09:00(=UTC 00:00)은 어드민 저장 시 초=1 마커가 붙으므로 초까지 확인한다 (lib/actions parseEventInput)
function eventTime(ev: CalendarEvent): Date | null {
  if (ev.isTba) return null;
  const d = new Date(ev.date);
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) return null;
  return d;
}

// KST HH:mm
function kstHm(d: Date): string {
  const k = new Date(d.getTime() + KST_OFFSET);
  return `${String(k.getUTCHours()).padStart(2, "0")}:${String(k.getUTCMinutes()).padStart(2, "0")}`;
}

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

export default function CryptoCalendar({
  initialYear,
  initialMonth,
  initialEvents,
}: {
  initialYear: number;
  initialMonth: number; // 1-12
  initialEvents?: CalendarEvent[]; // 홈 SSR이 넘기는 현재 달 이벤트(초기 스피너·재요청 방지)
}) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents ?? []);
  // SSR로 받은 달은 이미 로드된 것으로 표시해 마운트 직후 재요청·스피너를 없앤다.
  const [loadedKey, setLoadedKey] = useState<string | null>(
    initialEvents ? `${initialYear}-${initialMonth}` : null
  );
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const monthKey = `${year}-${month}`;
  const loading = loadedKey !== monthKey;
  const [excluded, setExcluded] = useState<Set<string>>(new Set()); // 체크 해제된 소분류
  const [now, setNow] = useState(0); // 임박 판정용 — 마운트 후 설정(하이드레이션 안전)

  const LS_KEY = "cryptalk:calendar:excluded";

  // 마운트 시 localStorage 에서 복원 — SSR 에서는 실행되지 않으므로 하이드레이션 안전.
  // 동기 setState 회피(react-hooks/set-state-in-effect)를 위해 다음 틱에 적용 — 위 now 패턴과 동일.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(LS_KEY);
    } catch {
      return; // 접근 불가(개인정보 모드 등) — 기본값 유지
    }
    if (!raw) return;
    const t = setTimeout(() => {
      try {
        setExcluded(new Set(JSON.parse(raw) as string[]));
      } catch {
        // 파싱 실패 시 기본값(빈 Set) 유지
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // excluded 변경 시 localStorage 에 동기화.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify([...excluded]));
    } catch {
      // 저장 실패(개인정보 모드 등)는 무시
    }
  }, [excluded]);

  useEffect(() => {
    // 초기값은 다음 틱에 설정 (effect 본문 동기 setState 회피 — 하이드레이션 안전)
    const first = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const [g, subs] of Object.entries(TAXONOMY)) map.set(g, [...subs]);
    for (const ev of events) {
      if (!map.has(ev.groupMain)) map.set(ev.groupMain, []);
      const list = map.get(ev.groupMain)!;
      if (!list.includes(ev.groupSub)) list.push(ev.groupSub);
    }
    return map;
  }, [events]);

  const isGroupOn = (g: string) =>
    (groups.get(g) ?? []).some((s) => !excluded.has(filterKey(g, s)));

  const toggleGroup = (g: string) => {
    const subs = groups.get(g) ?? [];
    const turnOff = isGroupOn(g);
    setExcluded((prev) => {
      const next = new Set(prev);
      subs.forEach((s) => (turnOff ? next.add(filterKey(g, s)) : next.delete(filterKey(g, s))));
      return next;
    });
  };

  const toggleSub = (g: string, s: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      const k = filterKey(g, s);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const visibleEvents = events.filter(
    (ev) => !excluded.has(filterKey(ev.groupMain, ev.groupSub))
  );

  useEffect(() => {
    const key = `${year}-${month}`;
    if (key === loadedKey) return; // 이미 로드된 달(SSR 초기 데이터 포함) — 재요청 안 함
    let alive = true;
    // 에러 상태는 비동기 응답 분기에서만 갱신한다(effect 본문 동기 setState는 cascading render 유발).
    // 로딩 중(loadedKey !== monthKey)에는 에러 UI가 가려지므로 직전 에러가 남아도 화면엔 영향 없음.
    fetch(`/api/events?year=${year}&month=${month}`)
      .then((res) => {
        if (!res.ok) throw new Error(`events ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!alive) return;
        setError(false);
        setEvents(data.events ?? []);
        setLoadedKey(key);
      })
      .catch(() => {
        if (!alive) return;
        setError(true);
        setEvents([]);
        setLoadedKey(key); // 스피너 해제 → 에러 UI로 전환
      });
    return () => {
      alive = false;
    };
  }, [year, month, loadedKey]);

  // 모달 ESC 닫기 (접근성)
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const moveMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  };

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7; // 월요일 시작

  // 이벤트는 통상(UTC) 날짜로 배치 — FOMC 등 미국 매크로의 통상 날짜 = UTC 날짜.
  // 한국시간은 시각 라벨/모달에 "익일"로 보조 표기해 홈 위젯과 동일 기준을 쓴다.
  const byDay = new Map<number, CalendarEvent[]>();
  const tbaEvents: CalendarEvent[] = [];
  for (const ev of visibleEvents) {
    if (ev.isTba) {
      tbaEvents.push(ev);
      continue;
    }
    const day = new Date(ev.date).getUTCDate();
    const list = byDay.get(day) ?? [];
    list.push(ev);
    byDay.set(day, list);
  }

  // 오늘 강조도 UTC 기준 — 마운트 후 설정되는 now 상태 사용(하이드레이션 안전 + 렌더 순수성)
  const nowUtc = now > 0 ? new Date(now) : null;
  const isThisMonth =
    !!nowUtc && nowUtc.getUTCFullYear() === year && nowUtc.getUTCMonth() + 1 === month;
  const todayDay = nowUtc ? nowUtc.getUTCDate() : -1;

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-white shadow-card transition-shadow hover:shadow-pop">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="text-base font-semibold tracking-tight text-navy-900">크립토 캘린더</h2>
          <span className="eyebrow hidden sm:inline">Crypto Calendar</span>
        </div>
        <div className="flex shrink-0 items-center border border-line bg-white text-sm">
          <button
            onClick={() => moveMonth(-1)}
            className="px-3 py-1.5 text-ink-500 hover:bg-paper2 hover:text-navy-900"
            aria-label="이전 달"
          >
            ‹
          </button>
          <span className="w-24 border-x border-line py-1.5 text-center font-semibold text-navy-900 tabular-nums">
            {year}년 {month}월
          </span>
          <button
            onClick={() => moveMonth(1)}
            className="px-3 py-1.5 text-ink-500 hover:bg-paper2 hover:text-navy-900"
            aria-label="다음 달"
          >
            ›
          </button>
        </div>
      </header>

      {/* 툴바 — 그룹 필터(eyebrow 타입: 배경 없이 색점 + 대문자 레터스페이싱 텍스트) */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-line px-4 py-2.5">
        <button
          onClick={() => setExcluded(new Set())}
          aria-pressed={excluded.size === 0}
          className={`flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.1em] transition-colors ${
            excluded.size === 0
              ? "text-navy-900"
              : "text-navy-300 hover:text-ink-500"
          }`}
        >
          <span className={`h-1.5 w-1.5 ${excluded.size === 0 ? "bg-navy-900" : "bg-navy-300"}`} />
          전체
        </button>
        {[...groups.keys()].map((g) => {
          const on = isGroupOn(g);
          const c = groupColor(g);
          const count = events.filter((e) => e.groupMain === g).length;
          return (
            <button
              key={g}
              onClick={() => toggleGroup(g)}
              aria-pressed={on}
              className={`flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.1em] transition-colors ${
                on ? c.text : "text-navy-300 hover:text-ink-500"
              }`}
            >
              <span className={`h-1.5 w-1.5 ${on ? c.dot : "bg-navy-300"}`} />
              {g}
              <span className="tabular-nums tracking-normal opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {/* 소분류 필터 — 보조 위계, 활성 그룹만 노출 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-2">
        {[...groups.entries()]
          .filter(([g]) => isGroupOn(g))
          .map(([g, subs]) => {
            const c = groupColor(g);
            return (
              <span key={g} className="flex flex-wrap items-center gap-1.5">
                <span className={`font-mono text-[10px] tracking-wider uppercase ${c.text}`}>{g}</span>
                {subs.map((s) => {
                  const off = excluded.has(filterKey(g, s));
                  return (
                    <button
                      key={filterKey(g, s)}
                      onClick={() => toggleSub(g, s)}
                      aria-pressed={!off}
                      className={`rounded border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                        off
                          ? "border-transparent bg-paper2 text-navy-300 line-through hover:text-ink-500"
                          : c.chip
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </span>
            );
          })}
      </div>

      <div className="grid grid-cols-7 border-b border-line bg-paper2 text-center text-[11px] text-navy-500">
        {WEEKDAYS.map((d, i) => (
          <div
            key={d}
            className={`py-1.5 font-medium ${i === 5 ? "text-indigo-700/80" : ""} ${i === 6 ? "text-red-600/80" : ""}`}
          >
            {d}
          </div>
        ))}
      </div>

      {loading ? (
        <p className="py-16 text-center text-sm text-ink-500">캘린더 불러오는 중...</p>
      ) : error ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <p className="text-sm text-ink-500">일정을 불러오지 못했습니다.</p>
          <button
            onClick={() => setLoadedKey(null)}
            className="rounded border border-navy-300 px-3 py-1 text-xs text-ink-600 hover:border-navy-900 hover:text-navy-900"
          >
            다시 시도
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const isToday = day != null && isThisMonth && day === todayDay;
            return (
            <div
              key={i}
              className={`relative min-h-16 border-b border-r border-line p-1 sm:min-h-20 [&:nth-child(7n)]:border-r-0 ${
                day == null ? "bg-paper" : ""
              } ${isToday ? "z-10 ring-2 ring-inset ring-red-500" : ""}`}
            >
              {day != null && (
                <>
                  <div className="mb-1 text-right font-mono text-[11px]">
                    {isToday ? (
                      <span className="inline-block bg-red-500 px-1 font-semibold text-white">
                        {day}
                      </span>
                    ) : (
                      <span className="text-navy-300">{day}</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {(byDay.get(day) ?? []).map((ev) => {
                      const t = eventTime(ev);
                      const imminent =
                        t != null && now > 0 && t.getTime() - now >= 0 && t.getTime() - now <= IMMINENT_MS;
                      return (
                      <button
                        key={ev.id}
                        onClick={() => setSelected(ev)}
                        className={`flex items-center gap-1 border px-1 py-0.5 text-left text-[10px] leading-tight hover:brightness-95 ${
                          groupColor(ev.groupMain).chip
                        } ${imminent ? "event-imminent" : ""}`}
                        title={`${ev.ticker} ${ev.title}${t ? ` · ${kstHm(t)} KST` : ""}`}
                      >
                        <EventIcon ticker={ev.ticker} size={13} />
                        <span className="min-w-0 flex-1 truncate">
                          <b>{ev.ticker}</b>{" "}
                          {t && <span className="font-mono font-semibold">{kstHm(t)}</span>}{" "}
                          {ev.title}
                        </span>
                      </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            );
          })}
        </div>
      )}

      {tbaEvents.length > 0 && (
        <div className="border-t border-line px-4 py-2.5">
          <p className="eyebrow mb-1.5">TBA — {month}월 중 일정 미정</p>
          <div className="flex flex-wrap gap-1">
            {tbaEvents.map((ev) => (
              <button
                key={ev.id}
                onClick={() => setSelected(ev)}
                className={`flex items-center gap-1 border px-1.5 py-0.5 text-[10px] hover:brightness-95 ${
                  groupColor(ev.groupMain).chip
                }`}
              >
                <EventIcon ticker={ev.ticker} size={13} />
                <span>
                  <b>{ev.ticker}</b> {ev.title}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center border-t border-line px-4 py-2">
        <span className="rail">
          Showing {visibleEvents.length} / {events.length} events
        </span>
        <span className="ml-auto text-[10px] text-navy-300">
          이벤트를 누르면 개별 출처를 확인할 수 있습니다
        </span>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/40 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${selected.ticker} ${selected.title}`}
            className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-xl border border-line bg-white p-6 shadow-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center gap-2">
              <span className={`px-1.5 py-0.5 text-[11px] font-bold ${BADGE_STYLE[selected.category] ?? BADGE_STYLE.neutral}`}>
                {CATEGORY_LABEL[selected.category] ?? "중립"}
              </span>
              <span className="bg-paper2 px-1.5 py-0.5 text-[11px] text-navy-500">
                {selected.groupMain} · {selected.groupSub}
              </span>
              {selected.dateStatus && DATE_STATUS_BADGE[selected.dateStatus] && (
                <span
                  className={`px-1.5 py-0.5 text-[11px] font-bold ${DATE_STATUS_BADGE[selected.dateStatus].cls}`}
                >
                  {DATE_STATUS_BADGE[selected.dateStatus].label}
                </span>
              )}
              <span className="font-mono text-xs text-ink-500">
                {selected.isTba
                  ? `${month}월 중 (TBA)`
                  : (() => {
                      const t = eventTime(selected);
                      const ko = new Date(selected.date).toLocaleDateString("ko-KR", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        timeZone: "UTC",
                      });
                      const nextDay = t != null && t.getUTCHours() >= 15; // KST로는 다음날
                      return t ? `${ko} · ${nextDay ? "익일 " : ""}${kstHm(t)} KST` : ko;
                    })()}
              </span>
            </div>
            <h3 className="flex items-center gap-2 text-lg font-semibold text-navy-900">
              <EventIcon ticker={selected.ticker} size={20} />
              <span>
                {selected.ticker}{" "}
                <span className="font-medium text-ink-900">{selected.title}</span>
              </span>
            </h3>
            <p className="mt-3 border-t border-line pt-3 text-sm leading-6 text-ink-900">
              {selected.description}
            </p>
            {/* 개별 출처 — 수집된 모든 출처를 티어 뱃지와 함께 나열 (docs/data-collection 소스 보존 규칙) */}
            {selected.sources && selected.sources.length > 0 && (
              <div className="mt-4 border-t border-line pt-3">
                <span className="text-[11px] font-semibold text-navy-400">개별 출처</span>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {selected.sources.map((s, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-xs">
                      {s.tier && (
                        <span className="shrink-0 bg-paper2 px-1 py-px font-mono text-[10px] text-navy-500">
                          T{s.tier}
                        </span>
                      )}
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-navy-700 underline-offset-2 hover:underline"
                      >
                        {s.name} ↗
                      </a>
                      {s.isOfficial && (
                        <span className="shrink-0 text-[10px] text-emerald-700">공식</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-5 flex items-center justify-between">
              {/* 다중 출처가 없을 때만 단일 출처 링크 폴백 (구 데이터) */}
              {selected.sourceUrl && !(selected.sources && selected.sources.length > 0) ? (
                <a
                  href={selected.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-navy-700 underline-offset-2 hover:underline"
                >
                  출처 보기 ↗
                </a>
              ) : (
                <span />
              )}
              <button
                autoFocus
                onClick={() => setSelected(null)}
                className="border border-navy-300 px-3 py-1 text-sm text-ink-500 hover:border-navy-900 hover:text-navy-900"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
