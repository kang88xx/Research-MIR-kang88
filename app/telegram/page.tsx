import TelegramChannels from "@/components/TelegramChannels";
import TelegramBotsMeme from "@/components/TelegramBotsMeme";
import { getTelegramPopular } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const metadata = { title: "텔레그램 · KMIR" };

// 텔레그램 전용 페이지 — 트렌딩 포스팅 그리드 + 텔레 봇 큐레이션
export default async function TelegramPage() {
  const popular = await getTelegramPopular().catch(() => null);
  return (
    <div className="flex flex-col gap-6">
      <TelegramChannels popular={popular} layout="grid" />
      <TelegramBotsMeme />
    </div>
  );
}
