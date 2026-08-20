import { cache } from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 현재 로그인 유저의 표시 정보 — 요청(렌더) 단위 메모이제이션.
// ConsoleSidebar(데스크톱)와 Header(모바일)가 CSS로만 분기되어 매 렌더 둘 다 실행되므로,
// 같은 쿼리가 페이지당 2회 나가던 것을 React cache()로 1회로 합친다.
export type CurrentUser = {
  id: string;
  nickname: string;
  level: number;
  nicknameConfirmed: boolean;
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const me = await prisma.user.findUnique({
    where: { id },
    select: { level: true, nickname: true, nicknameConfirmed: true },
  });
  if (!me) return null;
  return { id, ...me };
});
