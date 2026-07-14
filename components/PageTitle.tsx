import type { ReactNode } from "react";

// 페이지 타이틀 히어로 — 옵시디언 크롬 그라데이션(오닉스→블루슬레이트) 배너.
// 팔레트 원본 컬러칩의 그라데이션을 그대로 살린 다크 배너라 라이트/다크 모드
// 공통으로 고정 색을 쓰고, 알라바스터 타이틀이 페이지 첫 시선을 잡는다.
export default function PageTitle({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="title-band mb-4 flex items-center justify-between gap-4 border px-5 py-4">
      <div>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#93a5b2]">
          {eyebrow}
        </p>
        <h1 className="mt-0.5 text-lg font-semibold text-[#e5e4e2]">{title}</h1>
        {description && <p className="mt-1 text-xs text-[#aeb9c2]">{description}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}
