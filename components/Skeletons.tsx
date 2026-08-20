// 홈 스트리밍용 스켈레톤 모음.
// 각 비동기 섹션이 로딩되는 동안 "실제 컴포넌트와 같은 크기"의 자리표시를 보여
// 정적 셸이 즉시 그려지게 하고(스트리밍), 콘텐츠 교체 시 레이아웃 밀림(CLS)을 막는다.

// 공통 — 펄스 막대
function Bar({ className = "" }: { className?: string }) {
  return <div className={`rounded bg-paper2 ${className}`} />;
}

// 섹션 공통 셸(라이트 헤더 + 흰 본문) — HomeBoards 등 섹션 스켈레톤 공용
function SectionShell({ minBody }: { minBody: string }) {
  return (
    <section className="rounded-[6px] border border-line bg-white shadow-card overflow-hidden">
      <header className="flex items-center justify-between border-b border-line bg-white px-4 py-3">
        <div className="h-4 w-32 rounded bg-line" />
        <div className="h-3 w-16 rounded bg-line" />
      </header>
      <div className={`animate-pulse p-4 ${minBody}`}>
        <div className="flex flex-col gap-2.5">
          <Bar className="h-4 w-2/3" />
          <Bar className="h-4 w-1/2" />
          <Bar className="h-4 w-3/4" />
          <Bar className="h-4 w-2/5" />
        </div>
      </div>
    </section>
  );
}

// ── 레이아웃: 모바일 헤더 (콘솔 라이트, lg 미만) ──
export function HeaderSkeleton() {
  return (
    <header className="border-b border-hairline bg-surface lg:hidden">
      <div className="flex h-[88px] items-center gap-3 px-4">
        <div className="h-7 w-28 animate-pulse rounded bg-paper2" />
        <div className="ml-auto hidden gap-4 sm:flex">
          <div className="h-4 w-12 animate-pulse rounded bg-paper2" />
          <div className="h-4 w-12 animate-pulse rounded bg-paper2" />
          <div className="h-4 w-12 animate-pulse rounded bg-paper2" />
        </div>
      </div>
    </header>
  );
}

// ── 레이아웃: 데스크톱 사이드바 (lg+) ──
export function SidebarAccountSkeleton() {
  return (
    <aside className="console-side sticky top-0 hidden h-screen w-[228px] shrink-0 flex-col lg:flex">
      <div className="flex items-center gap-2.5 border-b border-hairline px-4 py-4">
        <div className="h-8 w-8 animate-pulse rounded-[4px] bg-paper2" />
        <div className="h-5 w-20 animate-pulse rounded bg-paper2" />
      </div>
      <div className="flex flex-col gap-3 px-4 py-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-paper2" />
        ))}
      </div>
    </aside>
  );
}

// ── 레이아웃: 마켓바 ──
// 실제 MarketBar는 272×72 고정 타일을 3행(지수/코인/매크로)으로 그린다.
// 스켈레톤도 같은 행 수·타일 높이를 예약해야 콘텐츠 도착 시 레이아웃 점프(CLS)가 없다.
export function MarketBarSkeleton() {
  // 홈 본문(main px-5) 안에 배치되므로 자체 패딩·배경 없이 그리드 골격만 예약한다.
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 3 }).map((_, row) => (
        <div key={row} className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[72px] animate-pulse rounded border border-line bg-paper2" />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── 전역 상단: 신규 상장·상폐 고정 스트립 ──
export function ListingsStripSkeleton() {
  return (
    <section className="flex items-center gap-3 border-b border-line bg-white px-4 py-2">
      <div className="h-2 w-2 bg-line" />
      <div className="h-3.5 w-28 animate-pulse rounded bg-line" />
      <div className="flex animate-pulse items-center gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-6 w-36 rounded bg-paper2" />
        ))}
      </div>
    </section>
  );
}

// ── 홈: 하단 게시판 영역(시장 분석) ──
export function HomeBoardsSkeleton() {
  return <SectionShell minBody="min-h-[300px]" />;
}
