import PageTitle from "@/components/PageTitle";
import KimchiHero from "@/components/KimchiHero";
import KimchiRegister from "@/components/KimchiRegister";
import KimchiContext from "@/components/KimchiContext";

export const dynamic = "force-dynamic";
export const metadata = { title: "김치 프리미엄 · KMIR" };

// 김치 프리미엄 전용 페이지 — E7B(K2) 확정안: 히어로(헤드라인+존 게이지+7일 추이) →
// 코인별 김프·거래소 괴리 통합 레지스터 → 시장 컨텍스트 스트립. 단일 컬럼 문서 흐름.
export default function KimchiPage() {
  return (
    <div>
      <PageTitle
        eyebrow="Kimchi Premium"
        description="국내(업비트)와 해외(바이낸스) 가격 차이입니다. 양수면 국내가 비싸고, 음수면 역프리미엄입니다."
      />
      <div className="flex flex-col gap-4">
        <KimchiHero />
        <KimchiRegister />
        <KimchiContext />
      </div>
    </div>
  );
}
