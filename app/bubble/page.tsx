import BubbleMap from "@/components/BubbleMap";
import PageTitle from "@/components/PageTitle";

export const metadata = { title: "버블맵 · KMIR" };

// 버블맵 전용 페이지 — 버블맵만 크게
export default function BubblePage() {
  return (
    <div>
      <PageTitle eyebrow="Bubble Map" title="시총 상위 버블맵" />
      <section className="overflow-hidden rounded-[6px] border border-line bg-white px-3 py-3">
        <div className="h-[72vh] min-h-[440px]">
          <BubbleMap />
        </div>
      </section>
    </div>
  );
}
