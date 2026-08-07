import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createDailyPost } from "@/lib/actions";
import { buildDailyAuto, STANCES, ADVICE_POSITIONS, ADVICE_ACTIONS } from "@/lib/daily";
import { kstDay } from "@/lib/time";
import SubmitButton from "@/components/SubmitButton";
import PageTitle from "@/components/PageTitle";

export const dynamic = "force-dynamic";

const EDITOR_MIN_LEVEL = 10;

const INPUT_CLS =
  "border border-navy-300 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-navy-300 focus:border-navy-700 focus:outline-none";

export default async function DailyWritePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { level: true },
  });

  if ((me?.level ?? 0) < EDITOR_MIN_LEVEL) {
    return (
      <div className="mx-auto mt-10 max-w-md border border-line bg-white p-6 text-center">
        <p className="text-sm text-ink-900">시장 분석 글은 운영진만 작성할 수 있습니다.</p>
        <Link href="/analysis" className="mt-3 inline-block text-sm text-navy-700 underline-offset-2 hover:underline">
          분석 목록으로
        </Link>
      </div>
    );
  }

  // 자동 채움 미리보기 — 발행 시점에 다시 수집해 박제하므로 여기선 확인용
  const auto = await buildDailyAuto();
  const [, mm, dd] = kstDay().split("-");
  const dateLabel = `${parseInt(mm, 10)}/${parseInt(dd, 10)}`;

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle
        eyebrow={`Daily · ${dateLabel}`}
        title="데일리 시장분석 작성"
        description="시세·심리·일정은 발행 시점에 자동 수집되어 글에 박제됩니다. 스탠스·견해·자문만 작성하세요."
      />

      {/* ── 자동 채움 미리보기 ── */}
      <div className="mb-5 border border-line bg-white">
        <div className="flex items-center gap-2 border-b border-hairline px-4 py-2.5">
          <h2 className="flex-1 text-[13.5px] font-extrabold text-navy-900">자동 채움 미리보기</h2>
          <span className="bg-brand-weak px-2 text-[11px] font-semibold text-brand-ink">발행 시 최신값으로 갱신</span>
        </div>
        <div className="flex flex-wrap border-b border-hairline">
          {auto.stats.map((s) => (
            <div key={s.label} className="flex-1 basis-28 border-r border-hairline px-3.5 py-2 tabular-nums last:border-r-0">
              <span className="block text-[10.5px] text-ink-400">{s.label}</span>
              <span className="text-sm font-bold text-ink-900">{s.value}</span>
              {s.delta && <span className="ml-1 text-[11px] text-ink-500">{s.delta}</span>}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-hairline px-4 py-2 text-[12.5px] tabular-nums text-ink-500">
          <span>
            <b className="text-up">급등</b> {auto.moversUp || "—"}
          </span>
          <span>
            <b className="text-down">급락</b> {auto.moversDown || "—"}
          </span>
        </div>
        {auto.events.length === 0 ? (
          <p className="px-4 py-2.5 text-xs text-ink-400">향후 7일 내 매크로(중요도 2+)·언락 일정이 없습니다.</p>
        ) : (
          <ul className="px-4 py-2.5 text-[12.5px] leading-6 text-ink-700">
            {auto.events.map((e) => (
              <li key={`${e.date}-${e.title}`}>
                <span className="mr-1.5 font-mono text-[10px] text-ink-400">{e.dday}</span>
                {e.date} {e.title}
                {e.unlock && <span className="ml-1 text-[11px] text-ink-400">언락</span>}
                {e.importance >= 3 && <b className="ml-1 text-brand-ink">★★★</b>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <form action={createDailyPost} className="flex flex-col gap-5">
        {/* ── 제목 ── */}
        <input
          name="title"
          required
          maxLength={100}
          placeholder={`제목 (예: ${dateLabel} 고용보고서 확인 전엔 움직일 이유가 없다)`}
          className={INPUT_CLS}
        />

        {/* ── 스탠스 ── */}
        <fieldset className="border border-line bg-white p-4">
          <legend className="px-1 text-[13.5px] font-extrabold text-navy-900">오늘의 스탠스</legend>
          <div className="flex flex-wrap gap-2">
            {STANCES.map((s) => (
              <label
                key={s.key}
                className="flex cursor-pointer items-center gap-1.5 border border-line px-3 py-1.5 text-sm text-ink-700 has-[:checked]:border-brand has-[:checked]:bg-brand-weak has-[:checked]:font-bold has-[:checked]:text-brand-ink"
              >
                <input type="radio" name="stance" value={s.key} required defaultChecked={s.key === "wait"} className="accent-brand" />
                {s.label}
              </label>
            ))}
          </div>
          <input
            name="verdict"
            required
            maxLength={200}
            placeholder="판단 한 문장 — 글 상단에 크게 표시됩니다 (예: 오늘 밤 고용보고서가 방향을 정한다. 확인 후 대응으로 충분하다.)"
            className={`${INPUT_CLS} mt-3 w-full`}
          />
        </fieldset>

        {/* ── 견해 본문 ── */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="opinion" className="text-[13.5px] font-extrabold text-navy-900">
            운영진 견해 <span className="font-normal text-ink-400">— 빈 줄로 문단 구분, 2~3문단 권장</span>
          </label>
          <textarea
            id="opinion"
            name="opinion"
            required
            maxLength={10000}
            rows={12}
            placeholder="글의 심장입니다. 시장 상황에 대한 판단과 그 근거를 쓰세요."
            className={`${INPUT_CLS} resize-y leading-7`}
          />
        </div>

        {/* ── 포지션별 자문 ── */}
        <fieldset className="border border-line bg-white p-4">
          <legend className="px-1 text-[13.5px] font-extrabold text-navy-900">포지션별 자문</legend>
          <div className="flex flex-col gap-2.5">
            {ADVICE_POSITIONS.map((position, i) => (
              <div key={position} className="flex flex-wrap items-center gap-2">
                <span className="w-28 shrink-0 text-sm font-bold text-ink-900">{position}</span>
                <select name={`advice-action-${i}`} required className={INPUT_CLS}>
                  {ADVICE_ACTIONS.map((a) => (
                    <option key={a.key} value={a.key}>
                      {a.label}
                    </option>
                  ))}
                </select>
                <input
                  name={`advice-note-${i}`}
                  required
                  maxLength={300}
                  placeholder="한 줄 조언"
                  className={`${INPUT_CLS} min-w-40 flex-1`}
                />
              </div>
            ))}
          </div>
        </fieldset>

        {/* ── 전일 회고 ── */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="retro" className="text-[13.5px] font-extrabold text-navy-900">
            전일 회고 <span className="font-normal text-ink-400">— 선택, 어제 판단이 맞았는지 한 줄</span>
          </label>
          <input id="retro" name="retro" maxLength={300} placeholder="예: 이벤트 전 저변동 관망 유지 — BTC -0.6% 예상 범위 내 횡보. 판단 유지." className={INPUT_CLS} />
        </div>

        <div className="flex items-center justify-between">
          <Link
            href="/analysis/write"
            className="text-sm text-ink-500 underline-offset-2 hover:text-navy-900 hover:underline"
          >
            일반 분석 작성으로
          </Link>
          <SubmitButton />
        </div>
      </form>
    </div>
  );
}
