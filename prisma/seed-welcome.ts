import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // 운영자 초기 비밀번호는 환경변수로만 주입 (하드코딩 금지 — 계정 탈취 방지)
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;
  if (!adminPassword || adminPassword.length < 12) {
    throw new Error(
      "ADMIN_INITIAL_PASSWORD 환경변수(12자 이상)가 필요합니다. 예: ADMIN_INITIAL_PASSWORD=... npx tsx prisma/seed-welcome.ts"
    );
  }
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@cryptalk.local";
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash }, // 기존 계정도 새 비번으로 회전 (과거 약한 비번 무효화)
    create: { email: adminEmail, nickname: "운영자", passwordHash, level: 10 },
  });
  console.log("Admin account ready");
}

main().then(() => prisma.$disconnect());
