import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 운영자 계정 시드 — 가입·로그인이 구글 OAuth 전용이라 비밀번호 없이
// 구글 이메일 기준으로 Lv10 승격만 보장한다 (구글 signIn 콜백이 email로 기존 계정을 찾음).
async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || !adminEmail.includes("@")) {
    throw new Error(
      "ADMIN_EMAIL 환경변수(운영자 구글 이메일)가 필요합니다. 예: ADMIN_EMAIL=me@gmail.com npx tsx prisma/seed-welcome.ts"
    );
  }
  await prisma.user.upsert({
    where: { email: adminEmail.toLowerCase() },
    update: { level: 10, approved: true, approvedAt: new Date() },
    create: {
      email: adminEmail.toLowerCase(),
      nickname: "운영자",
      level: 10,
      approved: true,
      approvedAt: new Date(),
    },
  });
  console.log(`Admin account ready: ${adminEmail}`);
}

main().then(() => prisma.$disconnect());
