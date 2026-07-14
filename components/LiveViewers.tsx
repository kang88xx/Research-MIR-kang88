"use client";

import { useEffect, useState } from "react";

// 동시접속자 표시 — 마운트 후 기준값 + 완만한 변동(±). 실제 프레즌스 연동은 추후.
export default function LiveViewers() {
  const [n, setN] = useState(0); // 0 = 서버/초기 렌더 (하이드레이션 안전)

  useEffect(() => {
    // 28~88 범위 내에서 랜덤 기준값 + 완만한 변동
    const rand = () => 28 + Math.floor(Math.random() * 61); // 28~88
    let base = rand();
    // 초기값은 다음 틱에 설정 (effect 본문 동기 setState 회피)
    const first = setTimeout(() => setN(base), 50);
    const id = setInterval(() => {
      base = Math.max(28, Math.min(88, base + (Math.floor(Math.random() * 7) - 3)));
      setN(base);
    }, 5000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  if (n === 0) return null;

  return (
    <span className="flex items-center gap-1.5 text-[11px] text-[#8b98a3]">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
      </span>
      동시접속 <span className="font-mono font-semibold text-[#e5e4e2]">{n.toLocaleString()}</span>
    </span>
  );
}
