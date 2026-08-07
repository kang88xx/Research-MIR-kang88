// 데일리 시장분석 본문 — 판단(스탠스)이 먼저, 데이터는 압축 스트립으로.
// 훅 없는 순수 서버 컴포넌트. 데이터는 발행 시점에 박제된 DailyData를 그대로 그린다.
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

function Stat({ s }: { s: DailyStat }) {
  return (
    <div className="flex-1 basis-28 border-r border-hairline px-3.5 py-2.5 tabular-nums last:border-r-0">
      <span className="block text-[10.5px] text-ink-400">{s.label}</span>
      <span className={`text-sm font-extrabold ${s.tone ? TONE_TEXT[s.tone] : "text-ink-900"}`}>
        {s.value}
      </span>
      {s.delta && (
        <span className={`ml-1 text-[11.5px] font-bold ${s.tone ? TONE_TEXT[s.tone] : "text-ink-500"}`}>
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
    <div className="flex flex-col gap-4 px-5 py-5">
      {/* ── 오늘의 판단 (히어로) ── */}
      <section className="border border-brand">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 pt-4 pb-3">
          <div>
            <p className="eyebrow">Today’s Stance</p>
            <p className="text-3xl font-black leading-tight tracking-tight text-brand-ink">
              {stanceLabel(data.stance)}
            </p>
          </div>
          <div className="min-w-[220px] flex-1">
            <div className="flex gap-[3px]" aria-label={`스탠스 5단계 중 ${stanceIdx + 1}단계`}>
              {STANCES.map((s, i) => (
                <i key={s.key} className={`h-2 flex-1 ${i === stanceIdx ? "bg-brand" : "bg-paper2"}`} />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10.5px] text-ink-400">
              {STANCES.map((s, i) => (
                <span key={s.key} className={i === stanceIdx ? "font-extrabold text-brand-ink" : ""}>
                  {s.label}
                </span>
              ))}
            </div>
          </div>
        </div>
        <p className="px-5 pb-4 text-[16.5px] font-bold leading-relaxed tracking-tight text-ink-900">
          {data.verdict}
        </p>
      </section>

      {/* ── 운영진 견해 ── */}
      <section className="border border-line">
        <h2 className="border-b border-hairline px-4 py-2.5 text-[13.5px] font-extrabold text-navy-900">
          운영진 견해
        </h2>
        <div className="px-5 py-4 text-[15.5px] leading-[1.85] text-ink-900">
          {paragraphs.map((p, i) => (
            <p key={i} className={i > 0 ? "mt-3.5" : ""}>
              {p}
            </p>
          ))}
        </div>
      </section>

      {/* ── 포지션별 자문 ── */}
      <section className="border border-line">
        <h2 className="border-b border-hairline px-4 py-2.5 text-[13.5px] font-extrabold text-navy-900">
          포지션별 자문
        </h2>
        <table className="w-full text-sm">
          <tbody>
            {data.advice.map((a, i) => (
              <tr key={a.position} className={i > 0 ? "border-t border-hairline" : ""}>
                <td className="whitespace-nowrap px-4 py-2.5 align-top font-extrabold text-ink-900">
                  {a.position}
                </td>
                <td className="w-full px-3 py-2.5 leading-relaxed text-ink-700">
                  <span
                    className={`mr-2 inline-block whitespace-nowrap px-2 text-[11px] font-extrabold ${
                      ACTION_STYLE[a.action] ?? "bg-paper2 text-ink-500"
                    }`}
                  >
                    {adviceActionLabel(a.action)}
                  </span>
                  {a.note}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ── 시장 현황 (압축 스트립) ── */}
      <section className="border border-line">
        <h2 className="border-b border-hairline px-4 py-2.5 text-[13.5px] font-extrabold text-navy-900">
          시장 현황
        </h2>
        <div className="flex flex-wrap border-b border-hairline">
          {data.auto.stats.map((s) => (
            <Stat key={s.label} s={s} />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2.5 text-[12.5px] tabular-nums text-ink-500">
          <span>
            <b className="text-up">급등</b> {data.auto.moversUp || "—"}
          </span>
          <span>
            <b className="text-down">급락</b> {data.auto.moversDown || "—"}
          </span>
        </div>
      </section>

      {/* ── 앞으로의 일정 ── */}
      {data.auto.events.length > 0 && (
        <section className="border border-line">
          <h2 className="border-b border-hairline px-4 py-2.5 text-[13.5px] font-extrabold text-navy-900">
            앞으로의 일정 — 매크로 · 언락
          </h2>
          <table className="w-full text-[13px] tabular-nums">
            <tbody>
              {[...macroEvents, ...unlockEvents].map((e, i) => (
                <tr
                  key={`${e.date}-${e.title}`}
                  className={`${i > 0 ? "border-t border-hairline" : ""} ${
                    e.importance >= 3 ? "bg-brand-weak shadow-[inset_3px_0_0_var(--color-brand)]" : ""
                  }`}
                >
                  <td className="whitespace-nowrap px-4 py-2">
                    <span
                      className={`mr-2 inline-block px-1.5 font-mono text-[10px] font-bold ${
                        e.importance >= 3 ? "bg-brand text-on-brand" : "bg-paper2 text-ink-500"
                      }`}
                    >
                      {e.dday}
                    </span>
                    {e.date}
                  </td>
                  <td className={`w-full px-2 py-2 ${e.importance >= 3 ? "font-bold" : ""}`}>
                    {e.title}
                    {e.unlock && <span className="ml-1.5 text-[11px] text-ink-400">언락</span>}
                    {e.estimated && <span className="ml-1.5 text-[11px] text-ink-400">추정</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right text-[11px] tracking-widest text-ink-300">
                    <span className="text-brand-ink">{"★".repeat(e.importance)}</span>
                    {"★".repeat(Math.max(0, 3 - e.importance))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-2 text-xs text-ink-400">
            중요도 ★★★ = 시장 전체 영향 · 향후 7일의 매크로(중요도 2+)·언락 일정만 표시, 전체는 캘린더 참고
          </p>
        </section>
      )}

      {/* ── 전일 회고 ── */}
      {data.retro && (
        <section className="border border-line">
          <h2 className="border-b border-hairline px-4 py-2.5 text-[13.5px] font-extrabold text-navy-900">
            전일 회고
          </h2>
          <p className="px-5 py-3.5 text-[13.5px] leading-relaxed text-ink-500">{data.retro}</p>
        </section>
      )}

      <p className="text-center text-xs text-ink-400">
        시세·심리·일정은 발행 시점 기준이며 투자 판단의 책임은 본인에게 있습니다
      </p>
    </div>
  );
}
