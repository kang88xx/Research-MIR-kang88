// 데일리 시장분석 본문 — E7B 확정안: 카드 박스 대신 좌측 라벨 그리드,
// 음영 없는 헤어라인 구분. 훅 없는 순수 서버 컴포넌트.
// 데이터는 발행 시점에 박제된 DailyData를 그대로 그린다.
import Link from "next/link";
import {
  STANCES,
  stanceLabel,
  adviceActionLabel,
  type DailyData,
  type DailyStat,
} from "@/lib/daily";

const TONE_TEXT = { up: "text-up", down: "text-down", flat: "text-ink-500" } as const;

const ACTION_STYLE: Record<string, string> = {
  hold: "bg-brand-weak text-brand-ink",
  add: "bg-brand text-on-brand",
  wait: "bg-paper2 text-ink-500",
  avoid: "border border-up text-up",
  cut: "border border-up text-up",
};

// 좌측 라벨 + 우측 콘텐츠 행 — 섹션 사이는 헤어라인 한 줄로만 구분
function SectionRow({
  label,
  en,
  children,
}: {
  label: string;
  en?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-x-6 gap-y-2 border-t border-hairline px-5 py-4 sm:grid-cols-[116px_minmax(0,1fr)]">
      <h2 className="pt-0.5 text-xs font-bold tracking-wider text-ink-500">
        {label}
        {en && (
          <span className="mt-1 block text-[9.5px] font-medium tracking-widest text-ink-300">
            {en}
          </span>
        )}
      </h2>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function Stat({ s }: { s: DailyStat }) {
  // 세로 헤어라인: 데스크톱 5열(5n번째 제거), 모바일 2열(2n번째 제거)
  // 가로 헤어라인: 두 번째 줄부터(데스크톱 6번째~, 모바일 3번째~)
  return (
    <div className="border-r border-hairline px-3.5 py-2.5 tabular-nums max-sm:[&:nth-child(2n)]:border-r-0 max-sm:[&:nth-child(n+3)]:border-t sm:[&:nth-child(5n)]:border-r-0 sm:[&:nth-child(n+6)]:border-t">
      <span className="block text-[10.5px] text-ink-400">{s.label}</span>
      <span className={`text-sm font-bold ${s.tone ? TONE_TEXT[s.tone] : "text-ink-900"}`}>
        {s.value}
      </span>
      {s.delta && (
        <span className={`ml-1 text-[11px] font-semibold ${s.tone ? TONE_TEXT[s.tone] : "text-ink-500"}`}>
          {s.delta}
        </span>
      )}
    </div>
  );
}

export default function DailyPostBody({ data }: { data: DailyData }) {
  const stanceIdx = STANCES.findIndex((s) => s.key === data.stance);
  const paragraphs = data.opinion.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const macroEvents = data.auto.events.filter((e) => !e.unlock);
  const unlockEvents = data.auto.events.filter((e) => e.unlock);

  return (
    <div className="pb-1">
      {/* ── 오늘의 판정 — 게이지가 곧 판정 표시(중복 텍스트 없음) ── */}
      <SectionRow label="오늘의 판정" en="TODAY'S STANCE">
        <div className="flex gap-[3px]" aria-label={`스탠스 5단계 중 ${stanceIdx + 1}단계: ${stanceLabel(data.stance)}`}>
          {STANCES.map((s, i) => (
            <i key={s.key} className={`h-[7px] flex-1 rounded-sm ${i === stanceIdx ? "bg-brand" : "bg-paper2"}`} />
          ))}
        </div>
        {/* 라벨은 각 세그먼트와 같은 flex-1 폭을 차지해 그 아래 가운데 정렬된다 */}
        <div className="mt-1.5 flex gap-[3px] text-[10.5px] text-ink-400">
          {STANCES.map((s, i) => (
            <span
              key={s.key}
              className={`flex-1 text-center ${
                i === stanceIdx ? "text-[12.5px] font-bold text-brand-ink" : ""
              }`}
            >
              {s.label}
            </span>
          ))}
        </div>
        <p className="mt-2.5 text-[13.5px] font-medium leading-[1.75] text-ink-900">
          {data.verdict}
        </p>
      </SectionRow>

      {/* ── 운영진 견해 ── */}
      <SectionRow label="운영진 견해" en="ANALYSIS">
        <div className="text-[13.5px] leading-[1.8] text-ink-700">
          {paragraphs.map((p, i) => (
            <p key={i} className={i > 0 ? "mt-2.5" : ""}>
              {p}
            </p>
          ))}
        </div>
      </SectionRow>

      {/* ── 포지션별 자문 ── */}
      <SectionRow label="포지션별 자문" en="ADVISORY">
        <div>
          {data.advice.map((a, i) => (
            <div
              key={a.position}
              className={`flex items-baseline gap-2.5 py-1.5 ${i > 0 ? "border-t border-hairline" : ""}`}
            >
              <span className="w-[84px] shrink-0 text-[13px] font-semibold text-ink-900">
                {a.position}
              </span>
              <span
                className={`inline-block shrink-0 whitespace-nowrap rounded-full px-2.5 py-px text-[11px] font-bold ${
                  ACTION_STYLE[a.action] ?? "bg-paper2 text-ink-500"
                }`}
              >
                {adviceActionLabel(a.action)}
              </span>
              <span className="text-[12.5px] leading-relaxed text-ink-700">{a.note}</span>
            </div>
          ))}
        </div>
      </SectionRow>

      {/* ── 시장 현황 — 음영 없는 괘선 그리드 ── */}
      <SectionRow label="시장 현황" en="MARKET">
        <div className="grid grid-cols-2 sm:grid-cols-5">
          {data.auto.stats.map((s) => (
            <Stat key={s.label} s={s} />
          ))}
        </div>
        <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] tabular-nums text-ink-500">
          <span>
            <b className="text-up">급등</b> {data.auto.moversUp || "—"}
          </span>
          <span>
            <b className="text-down">급락</b> {data.auto.moversDown || "—"}
          </span>
        </div>
      </SectionRow>

      {/* ── 앞으로의 일정 ── */}
      {data.auto.events.length > 0 && (
        <SectionRow label="앞으로의 일정" en="MACRO · UNLOCK">
          <div className="text-[13px] tabular-nums">
            {[...macroEvents, ...unlockEvents].map((e, i) => (
              <Link
                key={`${e.date}-${e.title}`}
                href="/calendar"
                className={`flex items-center gap-2 py-1.5 transition-colors hover:bg-paper2 ${
                  i > 0 ? "border-t border-hairline" : ""
                }`}
              >
                <span className="flex shrink-0 items-center whitespace-nowrap">
                  <span
                    className={`mr-2 inline-block rounded-full px-2 font-mono text-[10px] font-bold ${
                      e.importance >= 3 ? "bg-brand text-on-brand" : "bg-brand-weak text-brand-ink"
                    }`}
                  >
                    {e.dday}
                  </span>
                  <span className="text-ink-400">{e.date}</span>
                </span>
                <span className={`min-w-0 flex-1 truncate ${e.importance >= 3 ? "font-bold" : ""}`}>
                  {e.title}
                  {e.unlock && <span className="ml-1.5 text-[11px] font-normal text-ink-400">언락</span>}
                  {e.estimated && <span className="ml-1.5 text-[11px] font-normal text-ink-400">추정</span>}
                </span>
                <span className="shrink-0 whitespace-nowrap text-right text-[11px] tracking-widest text-ink-300">
                  <span className="text-brand-ink">{"★".repeat(e.importance)}</span>
                  {"★".repeat(Math.max(0, 3 - e.importance))}
                </span>
              </Link>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-ink-400">
            중요도 ★★★ = 시장 전체 영향 · 향후 7일의 매크로(중요도 2+)·언락 일정만 표시, 전체는 캘린더 참고
          </p>
        </SectionRow>
      )}

      {/* ── 전일 회고 ── */}
      {data.retro && (
        <SectionRow label="전일 회고" en="RETRO">
          <p className="text-[13px] leading-relaxed text-ink-500">{data.retro}</p>
        </SectionRow>
      )}

      <p className="border-t border-hairline px-5 py-3 text-center text-xs text-ink-400">
        시세·심리·일정은 발행 시점 기준이며 투자 판단의 책임은 본인에게 있습니다
      </p>
    </div>
  );
}
