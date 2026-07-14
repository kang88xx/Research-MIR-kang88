import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPost } from "@/lib/actions";
import SubmitButton from "@/components/SubmitButton";
import PageTitle from "@/components/PageTitle";

const EDITOR_MIN_LEVEL = 10;
const SYMBOLS = ["BTC", "ETH", "XRP", "SOL", "TRX"];

export default async function AnalysisWritePage() {
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

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle
        eyebrow="Write"
        title="분석 작성 — 시장 분석"
        description="등록 시 선택한 코인의 현재가가 자동 기록되며, 이후 실제 가격과 비교되어 표시됩니다."
      />
      <form action={createPost} className="flex flex-col gap-3">
        <input type="hidden" name="board" value="analysis" />
        <div className="flex gap-3">
          <select
            name="symbol"
            className="border border-navy-300 bg-white px-3 py-2 text-sm text-ink-900 focus:border-navy-700 focus:outline-none"
          >
            {SYMBOLS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            name="title"
            required
            maxLength={100}
            placeholder="제목 (예: 6월 둘째 주 BTC 주간 브리핑)"
            className="flex-1 border border-navy-300 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-navy-300 focus:border-navy-700 focus:outline-none"
          />
        </div>
        <textarea
          name="content"
          required
          maxLength={20000}
          rows={16}
          placeholder="분석 내용을 입력하세요. 출처 표기를 권장합니다."
          className="resize-y border border-navy-300 bg-white px-3 py-2 text-sm leading-6 text-ink-900 placeholder:text-navy-300 focus:border-navy-700 focus:outline-none"
        />
        <div className="flex justify-end">
          <SubmitButton />
        </div>
      </form>
    </div>
  );
}
