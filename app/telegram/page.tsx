import TelegramChannels from "@/components/TelegramChannels";
import PageTitle from "@/components/PageTitle";
import { getTelegramPopular } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const metadata = { title: "텔레그램 포스팅 · KMIR" };

// 텔레그램 전용 페이지 — 슬라이드 없이 인기 포스팅 전부를 그리드로 배치
export default async function TelegramPage() {
  const popular = await getTelegramPopular().catch(() => null);
  return (
    <div>
      <PageTitle
        eyebrow="Telegram"
        title="텔레그램 인기 포스팅"
        actions={<p className="text-[11px] text-ink-500">한국 크립토 채널 · 24시간 인기순</p>}
      />
      <TelegramChannels popular={popular} layout="grid" />
    </div>
  );
}
