import type { ReactNode } from "react";

// 페이지 타이틀 — 콘솔 시안: 모노 아이브로우(01 — SECTION 톤) + 34px 라이트 웨이트 타이틀.
// 배경 밴드 없이 페이퍼 위에 얹는 타이포그래피 중심 헤더.
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
    <div className="mb-5 flex items-end justify-between gap-4 border-b border-hairline pb-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="console-title mt-1.5">{title}</h1>
        {description && <p className="mt-1.5 text-xs text-ink-500">{description}</p>}
      </div>
      {actions && <div className="shrink-0 pb-1">{actions}</div>}
    </div>
  );
}
