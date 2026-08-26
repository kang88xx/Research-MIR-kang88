// 언락 일정 수동 동기화 CLI — 어드민 버튼과 동일한 로직(lib/unlocks.ts)을 로컬에서 실행.
// 실행: npx tsx scripts/sync-unlocks.ts
// 필요 env: DATABASE_URL, COINDAR_ACCESS_TOKEN (.env / .env.local에서 읽는다)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Next.js 밖에서 실행되므로 .env/.env.local을 직접 읽는다 (.env.local이 우선, 기존 env는 보존)
for (const file of [".env", ".env.local"]) {
  try {
    const text = readFileSync(resolve(process.cwd(), file), "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const val = m[2].replace(/^(['"])(.*)\1$/, "$2");
      if (file === ".env.local" || !(m[1] in process.env)) process.env[m[1]] = val;
    }
  } catch {
    // 파일 없으면 무시
  }
}

async function main() {
  // env 세팅 후에 로드해야 하므로 동적 import (lib/prisma가 임포트 시점에 클라이언트를 만든다)
  const { syncUnlockEvents } = await import("../lib/unlocks");
  try {
    const r = await syncUnlockEvents();
    console.log(r.message);
    for (const it of r.createdItems) console.log(`  [신규] ${it.date} ${it.ticker} ${it.title}`);
    for (const it of r.updatedItems) console.log(`  [날짜변경] ${it.ticker} ${it.title}: ${it.oldDate} → ${it.newDate}`);
    if (r.unmatched.length > 0) console.log(`미매칭 심볼(${r.unmatched.length}): ${r.unmatched.join(", ")}`);
    console.log("검수 큐 확인: /admin/events (pending_review → 공식 원문 확인 후 발행)");
    process.exit(0);
  } catch (err) {
    console.error("언락 동기화 실패:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
