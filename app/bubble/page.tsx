import BubbleMap from "@/components/BubbleMap";

export const metadata = { title: "버블맵 · KMIR" };

// 버블맵 전용 페이지 — 페이지 타이틀 없이 버블맵 카드만 크게
export default function BubblePage() {
  return (
    <section className="overflow-hidden rounded-[6px] border border-line bg-white px-3 py-3">
      <p className="px-1 pb-1 text-right text-[11px] text-ink-500">
        시가총액 · 거래량 · 등락률 기준 반영
      </p>
      <div className="h-[76vh] min-h-[440px]">
        <BubbleMap />
      </div>
    </section>
  );
}
