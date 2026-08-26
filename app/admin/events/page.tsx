import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  publishCalendarEvent,
} from "@/lib/actions";
import { kstDay } from "@/lib/time";
import UnlockSyncButton from "@/components/UnlockSyncButton";

export const dynamic = "force-dynamic";

// 캘린더 이벤트 입력·검수 — docs/data-collection/templates/event-entry.md 양식 기반.
// 검수 큐(draft·pending_review)는 공개 캘린더에 노출되지 않으며, 발행 버튼으로 승격한다.

const inputCls =
  "w-full border border-line bg-white px-2 py-1.5 text-sm text-ink-900 focus:border-navy-700 focus:outline-none";
const labelCls = "mb-1 block text-[11px] font-medium text-ink-500";

const CATEGORIES = [
  { key: "important", label: "중요(파랑)" },
  { key: "good", label: "호재(초록)" },
  { key: "bad", label: "악재(빨강)" },
  { key: "neutral", label: "중립(회색)" },
];
const GROUPS = ["크립토", "주식", "매크로", "이벤트"];
// docs/data-collection/README.md §2 카테고리 매핑과 동일한 소분류 제안 목록
const GROUP_SUBS = [
  "언락", "TGE·상장", "상폐·리스크", "거래소", "파트너십", "프로젝트", "컨퍼런스",
  "실적·발표", "IPO", "지수", "규제·소송", "제품·출시", "서비스",
  "경제지표", "금리결정", "정치·정책", "지정학", "스포츠", "행사", "기타",
];
const DATE_STATUSES = [
  { key: "confirmed", label: "확정" },
  { key: "estimated", label: "추정" },
  { key: "tba", label: "TBA" },
  { key: "revised", label: "날짜 변경" },
  { key: "postponed", label: "연기" },
  { key: "cancelled", label: "취소" },
];
const REVIEW_STATUSES = [
  { key: "draft", label: "초안" },
  { key: "pending_review", label: "검수 대기" },
  { key: "published", label: "발행" },
  { key: "needs_recheck", label: "재확인 필요" },
  { key: "archived", label: "보관" },
];
const REVIEW_BADGE: Record<string, string> = {
  draft: "bg-paper2 text-ink-500",
  pending_review: "bg-amber-500/15 text-amber-700",
  published: "bg-emerald-500/15 text-emerald-700",
  needs_recheck: "bg-red-500/15 text-red-700",
  archived: "bg-paper2 text-ink-400",
};

type EventRow = {
  id: number;
  date: Date;
  isTba: boolean;
  ticker: string;
  title: string;
  description: string;
  category: string;
  groupMain: string;
  groupSub: string;
  sourceUrl: string | null;
  dateStatus: string;
  importance: number;
  sources: unknown;
  reviewStatus: string;
  nextCheck: Date | null;
};

type Src = { name?: string; url?: string; tier?: number; isOfficial?: boolean };
const srcList = (raw: unknown): Src[] => (Array.isArray(raw) ? (raw as Src[]) : []);

// 저장된 UTC 시각 → KST "HH:MM" 폼 기본값 ((kstH+15)%24 저장 규칙의 역변환)
// 00:00:00 = 시각 미지정 센티널. KST 09:00은 00:00:01(초 마커)로 저장되므로 초까지 확인한다.
function kstTimeValue(d: Date): string {
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) return "";
  const h = (d.getUTCHours() + 9) % 24;
  return `${String(h).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

// 이벤트 입력 필드 세트 — 신규(기본값 없음)와 수정(기존 값) 공용
function EventFields({ e }: { e?: EventRow }) {
  let sources = e ? srcList(e.sources) : [];
  // 구 데이터(sources 없이 sourceUrl만) — 출처 1행에 미리 채워 수정 시 출처가 유실되지 않게 한다
  if (e && sources.length === 0 && e.sourceUrl) {
    sources = [{ name: "출처", url: e.sourceUrl, tier: 2, isOfficial: false }];
  }
  return (
    <>
      <div>
        <label className={labelCls}>날짜 (KST) *</label>
        <input name="date" type="date" required defaultValue={e ? e.date.toISOString().slice(0, 10) : ""} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>시각 (KST, 선택)</label>
        <input name="time" type="time" defaultValue={e ? kstTimeValue(e.date) : ""} className={inputCls} />
        <p className="mt-0.5 text-[10px] text-ink-400">00:00~08:59 입력 = 셀 날짜의 익일 새벽 발표</p>
      </div>
      <div>
        <label className={labelCls}>티커 *</label>
        <input name="ticker" required maxLength={20} defaultValue={e?.ticker ?? ""} className={inputCls} placeholder="예: WLD, AAPL, KR" />
      </div>
      <div className="flex items-end gap-3 pb-1">
        <label className="flex items-center gap-1.5 text-sm text-ink-900">
          <input type="checkbox" name="isTba" defaultChecked={e?.isTba ?? false} className="h-4 w-4" />
          TBA (월만 확정 — 날짜는 그 달 1일로)
        </label>
      </div>
      <div className="col-span-2 sm:col-span-4">
        <label className={labelCls}>제목 (80자 이내) *</label>
        <input name="title" required maxLength={80} defaultValue={e?.title ?? ""} className={inputCls} placeholder="캘린더 셀에 표시될 한국어 제목" />
      </div>
      <div className="col-span-2 sm:col-span-4">
        <label className={labelCls}>상세 설명 (2~3문장, 왜 중요한지 포함)</label>
        <textarea name="description" rows={2} maxLength={2000} defaultValue={e?.description ?? ""} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>색상(성격)</label>
        <select name="category" defaultValue={e?.category ?? "neutral"} className={inputCls}>
          {CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>대분류</label>
        <select name="groupMain" defaultValue={e?.groupMain ?? "크립토"} className={inputCls}>
          {GROUPS.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>소분류</label>
        <input name="groupSub" list="group-subs" maxLength={20} defaultValue={e?.groupSub ?? ""} className={inputCls} placeholder="기타" />
      </div>
      <div>
        <label className={labelCls}>중요도 (3=시장 전체)</label>
        <select name="importance" defaultValue={String(e?.importance ?? 1)} className={inputCls}>
          <option value="3">3 — 시장 전체</option>
          <option value="2">2 — 섹터·종목 중대</option>
          <option value="1">1 — 참고</option>
        </select>
      </div>
      <div>
        <label className={labelCls}>날짜 상태</label>
        <select name="dateStatus" defaultValue={e?.dateStatus ?? "confirmed"} className={inputCls}>
          {DATE_STATUSES.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>검수 상태</label>
        <select name="reviewStatus" defaultValue={e?.reviewStatus ?? "draft"} className={inputCls}>
          {REVIEW_STATUSES.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>다음 재확인일 (언락·실적·규제=D-7·D-1)</label>
        <input name="nextCheck" type="date" defaultValue={e?.nextCheck ? e.nextCheck.toISOString().slice(0, 10) : ""} className={inputCls} />
      </div>
      {/* 출처 — 전부 보존. T3(SNS·뉴스) 발견 건은 공식 원문 포함 2개 이상 */}
      {[1, 2, 3].map((i) => {
        const s = sources[i - 1];
        return (
          <div key={i} className="col-span-2 grid grid-cols-[1fr_2fr_auto_auto] items-end gap-2 sm:col-span-4">
            <div>
              <label className={labelCls}>출처 {i} 이름{i === 1 ? " (대표)" : ""}</label>
              <input name={`srcName${i}`} defaultValue={s?.name ?? ""} className={inputCls} placeholder={i === 1 ? "예: 한국은행" : "선택"} />
            </div>
            <div>
              <label className={labelCls}>URL</label>
              <input name={`srcUrl${i}`} defaultValue={s?.url ?? ""} className={inputCls} placeholder="https://…" />
            </div>
            <div>
              <label className={labelCls}>티어</label>
              <select name={`srcTier${i}`} defaultValue={String(s?.tier ?? 3)} className={inputCls}>
                <option value="1">T1 공식</option>
                <option value="2">T2 집계</option>
                <option value="3">T3 SNS</option>
              </select>
            </div>
            <label className="flex items-center gap-1.5 pb-2 text-sm text-ink-900">
              <input type="checkbox" name={`srcOfficial${i}`} defaultChecked={s?.isOfficial ?? false} className="h-4 w-4" />
              공식
            </label>
          </div>
        );
      })}
    </>
  );
}

// 목록 행 — 요약 + 발행/삭제 + 펼쳐서 수정
function EventItem({ e }: { e: EventRow }) {
  const sources = srcList(e.sources);
  const review = REVIEW_STATUSES.find((s) => s.key === e.reviewStatus)?.label ?? e.reviewStatus;
  return (
    <li className="p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-mono text-xs text-ink-500">
          {e.date.toISOString().slice(0, 10)}
          {e.isTba && " (TBA)"}
        </span>
        <b className="text-navy-900">{e.ticker}</b>
        <span className="min-w-0 flex-1 truncate text-ink-900">{e.title}</span>
        <span className="text-[11px] text-ink-500">{e.groupMain}·{e.groupSub}</span>
        <span className={`px-1.5 py-0.5 text-[11px] font-medium ${REVIEW_BADGE[e.reviewStatus] ?? REVIEW_BADGE.draft}`}>
          {review}
        </span>
      </div>
      {sources.length > 0 && (
        <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-ink-500">
          {sources.map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
              [T{s.tier ?? 3}] {s.name} ↗
            </a>
          ))}
        </p>
      )}
      <div className="mt-2 flex items-center gap-3">
        {e.reviewStatus !== "published" && (
          <form action={publishCalendarEvent.bind(null, e.id)}>
            <button className="border border-emerald-600 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">
              발행
            </button>
          </form>
        )}
        <form action={deleteCalendarEvent.bind(null, e.id)}>
          <button className="text-xs text-red-600 underline-offset-2 hover:underline">삭제</button>
        </form>
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-navy-700">수정</summary>
        <form action={updateCalendarEvent.bind(null, e.id)} className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3 sm:grid-cols-4">
          <EventFields e={e} />
          <div className="col-span-2 text-right sm:col-span-4">
            <button className="border border-navy-300 px-4 py-1.5 text-sm font-medium text-navy-700 hover:border-navy-900 hover:text-navy-900">
              저장
            </button>
          </div>
        </form>
      </details>
    </li>
  );
}

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string }>;
}) {
  const sp = await searchParams;
  const today = kstDay(); // "YYYY-MM-DD"
  const ymMatch = sp.ym?.match(/^(\d{4})-(\d{2})$/);
  const year = ymMatch ? Number(ymMatch[1]) : Number(today.slice(0, 4));
  const month = ymMatch ? Number(ymMatch[2]) : Number(today.slice(5, 7));
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const prevYm = `${month === 1 ? year - 1 : year}-${String(month === 1 ? 12 : month - 1).padStart(2, "0")}`;
  const nextYm = `${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, "0")}`;

  const [queue, monthEvents] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: { reviewStatus: { in: ["draft", "pending_review", "needs_recheck"] } },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    }),
    prisma.calendarEvent.findMany({
      where: { date: { gte: start, lt: end } },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    }),
  ]);

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-navy-900">캘린더 이벤트 관리</h1>
      <p className="mb-4 text-xs text-ink-500">
        수집·검증 규칙은 <code>docs/data-collection/README.md</code> 참조. T3(SNS·뉴스) 발견 건은 공식
        원문 확인 후 발행하세요. 초안·검수 대기 이벤트는 공개 캘린더에 노출되지 않습니다.
      </p>
      <datalist id="group-subs">
        {GROUP_SUBS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      {/* 검수 큐 — 텔레그램 자동 포착(상장·상폐 후보) + 수기 초안 */}
      <section className="mb-6 border border-line bg-white">
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <h2 className="shrink-0 text-sm font-semibold text-navy-900">검수 큐 ({queue.length})</h2>
          {/* 버블맵 100종목 기준 Coindar 언락 수집 — 결과는 이 큐에 pending_review로 쌓인다 */}
          <UnlockSyncButton />
        </header>
        {queue.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-ink-500">검수 대기 이벤트가 없습니다.</p>
        ) : (
          <ul className="divide-y divide-line">
            {queue.map((e) => (
              <EventItem key={e.id} e={e} />
            ))}
          </ul>
        )}
      </section>

      {/* 신규 입력 */}
      <section className="mb-6 border border-line bg-white">
        <header className="border-b border-line px-4 py-2.5">
          <h2 className="text-sm font-semibold text-navy-900">이벤트 입력</h2>
        </header>
        <form action={createCalendarEvent} className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          <EventFields />
          <div className="col-span-2 text-right sm:col-span-4">
            <button className="bg-navy-900 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-700">
              + 등록
            </button>
          </div>
        </form>
      </section>

      {/* 월별 전체 목록 */}
      <section className="border border-line bg-white">
        <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <h2 className="text-sm font-semibold text-navy-900">
            {year}년 {month}월 ({monthEvents.length})
          </h2>
          <span className="flex items-center gap-2 text-sm">
            <Link href={`/admin/events?ym=${prevYm}`} className="text-navy-700 hover:underline">← 이전</Link>
            <Link href={`/admin/events?ym=${nextYm}`} className="text-navy-700 hover:underline">다음 →</Link>
          </span>
        </header>
        {monthEvents.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-ink-500">이 달에 등록된 이벤트가 없습니다.</p>
        ) : (
          <ul className="divide-y divide-line">
            {monthEvents.map((e) => (
              <EventItem key={e.id} e={e} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
