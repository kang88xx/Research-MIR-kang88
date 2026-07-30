import DominanceCard from "@/components/DominanceCard";
import KimchiTable from "@/components/KimchiTable";

export const dynamic = "force-dynamic";
export const metadata = { title: "김치 프리미엄 · KMIR" };

// 김치 프리미엄 전용 페이지 — BTC 도미넌스(테더 김프·환율) 카드 + 김프·거래대금 TOP 테이블만
export default function KimchiPage() {
  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[420px_1fr]">
      <DominanceCard />
      <KimchiTable />
    </div>
  );
}
