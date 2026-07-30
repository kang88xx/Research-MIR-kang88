import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.board.upsert({
    where: { slug: "analysis" },
    update: {},
    create: { slug: "analysis", name: "시장 분석", type: "info", sortOrder: 2 },
  });
  console.log("Seeded: 시장 분석 (analysis)");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
