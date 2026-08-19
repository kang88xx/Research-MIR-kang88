import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

// 구글 가입자 닉네임 자동 생성 (중복 시 숫자 접미사)
async function uniqueNickname(base: string): Promise<string> {
  const trimmed = base.replace(/\s+/g, "").slice(0, 10) || "구글유저";
  let nickname = trimmed;
  for (let i = 0; i < 10; i++) {
    const exists = await prisma.user.findUnique({ where: { nickname } });
    if (!exists) return nickname;
    nickname = `${trimmed.slice(0, 7)}${Math.floor(1000 + Math.random() * 9000)}`;
  }
  return `user${Date.now().toString(36)}`;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  // 가입·로그인은 구글 OAuth 단일 경로 — 이메일/비밀번호(Credentials)는 폐지
  providers: [Google],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        const email = user.email?.toLowerCase();
        if (!email) return false;
        // 미검증 이메일로 기존 계정에 연결되는 것을 차단 (계정 탈취 방지)
        if (profile && profile.email_verified === false) return false;

        let dbUser = await prisma.user.findUnique({ where: { email } });
        if (!dbUser) {
          const nickname = await uniqueNickname(user.name ?? email.split("@")[0]);
          // 자동 생성 닉 — 미확정 상태로 두어 최초 1회 본인 닉 설정을 무료로 허용
          dbUser = await prisma.user.create({ data: { email, nickname, nicknameConfirmed: false } });
        }
        // JWT에 우리 DB의 사용자 ID/닉네임을 싣는다
        user.id = dbUser.id;
        user.name = dbUser.nickname;
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.id = token.id as string;
      return session;
    },
  },
});
