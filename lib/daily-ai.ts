// ── 데일리 시장분석 — AI 판단 작성 ──
// 크론 자동 발행 경로 전용. buildDailyAuto()가 수집한 데이터를 Claude에 넘겨
// 스탠스·판단·견해·포지션별 자문을 생성한다. 숫자는 여전히 서버 수집분을 박제하고,
// AI는 "해석" 층만 담당 — 수기 발행(/analysis/write/daily) 경로는 건드리지 않는다.
import Anthropic from "@anthropic-ai/sdk";
import {
  STANCES,
  ADVICE_POSITIONS,
  ADVICE_ACTIONS,
  type DailyData,
  type DailyAdvice,
  type StanceKey,
  type AdviceActionKey,
} from "@/lib/daily";

export type DailyJudgment = {
  headline: string; // 제목용 헤드라인 (날짜 접두어 제외)
  stance: StanceKey;
  verdict: string;
  opinion: string;
  advice: DailyAdvice[];
};

const STANCE_KEYS = STANCES.map((s) => s.key);
const ACTION_KEYS = ADVICE_ACTIONS.map((a) => a.key);

// 구조화 출력 스키마 — 스탠스·액션은 enum으로 강제. 배열 길이 제약은 스키마가
// 지원하지 않으므로 프롬프트로 지시하고 코드에서 검증한다.
const JUDGMENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "stance", "verdict", "opinion", "advice"],
  properties: {
    headline: {
      type: "string",
      description: "글 제목용 헤드라인 한 문장. 날짜 없이 판단만. 40자 이내.",
    },
    stance: { type: "string", enum: STANCE_KEYS },
    verdict: {
      type: "string",
      description: "오늘의 판단 한 문장. 200자 이내.",
    },
    opinion: {
      type: "string",
      description: "견해 본문. 문단은 빈 줄로 구분. 3~5문단.",
    },
    advice: {
      type: "array",
      description:
        "포지션별 자문 정확히 3개. 순서 고정: 현물 보유, 신규 진입, 단기 트레이딩.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["action", "note"],
        properties: {
          action: { type: "string", enum: ACTION_KEYS },
          note: { type: "string", description: "한 줄 조언. 300자 이내." },
        },
      },
    },
  },
} as const;

const SYSTEM_PROMPT = `당신은 KMIR(Kang Market Intelligence & Research)의 데일리 시장분석 작성자다. 매일 아침 9시(KST), 서버가 수집한 당일 시장 데이터를 근거로 판단 중심의 짧은 분석을 발행한다.

원칙:
- 데이터에 없는 수치를 지어내지 않는다. 제공된 시세·김프·공포탐욕·급등락·일정만 근거로 쓴다.
- 판단이 핵심이다. 데이터 나열이 아니라 "그래서 오늘 어떻게 볼 것인가"를 말한다. 근거가 애매한 날은 애매하다고 말하고 관망을 택한다.
- 문체는 "~다"로 끝나는 단정한 분석체. 이모지·과장·호들갑 금지.
- 스탠스 5단계: reduce(축소) / conservative(보수) / wait(관망) / selective(선별 매수) / expand(확대). 판단·견해·자문의 톤은 선택한 스탠스와 일관되어야 한다.
- 견해(opinion)는 3~5문단, 문단 사이는 빈 줄 하나. 첫 문단은 시장 상황 요약, 이후 문단은 판단의 근거와 리스크, 마지막 문단은 오늘 지켜볼 것.
- 자문(advice)은 정확히 3개, 순서 고정: ①현물 보유 ②신규 진입 ③단기 트레이딩. 각각 액션(hold/add/wait/avoid/cut)과 한 줄 조언.
- 일정에 D-DAY 매크로 이벤트가 있으면 판단에 반드시 반영한다.`;

function buildUserPrompt(auto: DailyData["auto"], dateLabel: string): string {
  return `오늘은 ${dateLabel}(KST)이다. 아래는 방금 수집한 시장 데이터다.

## 주요 지표
${auto.stats.map((s) => `- ${s.label}: ${s.value}${s.delta ? ` (${s.delta})` : ""}`).join("\n")}

## 24h 급등 상위
${auto.moversUp || "(없음)"}

## 24h 급락 상위
${auto.moversDown || "(없음)"}

## 향후 7일 일정 (매크로 중요도 2+ / 언락)
${
  auto.events.length
    ? auto.events
        .map(
          (e) =>
            `- ${e.dday} ${e.date} ${e.title} (중요도 ${e.importance}${e.unlock ? ", 언락" : ""}${e.estimated ? ", 날짜 미확정" : ""})`
        )
        .join("\n")
    : "(수집된 일정 없음)"
}

이 데이터만 근거로 오늘의 데일리 시장분석을 작성하라.`;
}

// AI 응답 검증 — enum·개수·길이가 어긋나면 발행하지 않고 실패시킨다(반쪽 글 방지)
function validateJudgment(raw: unknown): DailyJudgment {
  const j = raw as DailyJudgment;
  if (!j || typeof j !== "object") throw new Error("AI 응답이 객체가 아닙니다.");
  if (!j.headline?.trim()) throw new Error("headline이 비어 있습니다.");
  if (!STANCE_KEYS.includes(j.stance)) throw new Error(`잘못된 stance: ${j.stance}`);
  if (!j.verdict?.trim() || j.verdict.length > 200)
    throw new Error("verdict가 비었거나 200자를 초과합니다.");
  if (!j.opinion?.trim() || j.opinion.length > 10000)
    throw new Error("opinion이 비었거나 10000자를 초과합니다.");
  if (!Array.isArray(j.advice) || j.advice.length !== 3)
    throw new Error(`advice는 정확히 3개여야 합니다 (현재 ${j.advice?.length ?? 0}개).`);
  const advice = j.advice.map((a, i) => {
    if (!ACTION_KEYS.includes(a.action)) throw new Error(`잘못된 advice action: ${a.action}`);
    if (!a.note?.trim() || a.note.length > 300)
      throw new Error(`${ADVICE_POSITIONS[i]} 자문이 비었거나 300자를 초과합니다.`);
    return {
      position: ADVICE_POSITIONS[i],
      action: a.action as AdviceActionKey,
      note: a.note.trim(),
    };
  });
  return {
    headline: j.headline.trim().slice(0, 60),
    stance: j.stance,
    verdict: j.verdict.trim(),
    opinion: j.opinion.trim(),
    advice,
  };
}

export async function generateDailyJudgment(
  auto: DailyData["auto"],
  dateLabel: string
): Promise<DailyJudgment> {
  const client = new Anthropic(); // ANTHROPIC_API_KEY 환경변수 사용

  // 안전 분류기 오탐으로 거부될 경우 서버가 자동으로 대체 모델(Opus 4.8)로 재시도.
  // fallbacks: "default"는 SDK 타입에 아직 없어 캐스팅으로 전달(서버는 정식 지원).
  const params = {
    model: "claude-opus-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM_PROMPT,
    output_config: { format: { type: "json_schema", schema: JUDGMENT_SCHEMA } },
    messages: [{ role: "user", content: buildUserPrompt(auto, dateLabel) }],
  };
  const response = await client.beta.messages.create(
    params as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming
  );

  if (response.stop_reason === "refusal") {
    throw new Error("AI가 요청을 거부했습니다 (stop_reason: refusal).");
  }

  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("AI 응답에 텍스트 블록이 없습니다.");

  return validateJudgment(JSON.parse(text));
}
