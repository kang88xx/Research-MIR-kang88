import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { BOX_COST } from "@/lib/box";
import RandomBox, { type PrizeLite } from "@/components/RandomBox";
import PageTitle from "@/components/PageTitle";
import { rarityMeta as rarityOf } from "@/lib/box";

export const dynamic = "force-dynamic";

export default async function BoxPage() {
  const session = await auth();
  const myId = session?.user?.id ?? null;

  const [prizes, me, recentWins] = await Promise.all([
    prisma.prize.findMany({
      where: { active: true, OR: [{ stock: null }, { stock: { gt: 0 } }] },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: { id: true, name: true, description: true, imageUrl: true, rarity: true },
    }),
    myId ? prisma.user.findUnique({ where: { id: myId }, select: { points: true } }) : null,
    prisma.prizeWin.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        prize: { select: { name: true, rarity: true } },
        user: { select: { nickname: true } },
      },
    }),
  ]);

  const points = me?.points ?? 0;

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle
        eyebrow="Lucky Box"
        title="랜덤박스"
        description={`글쓰기·댓글·출석으로 모은 포인트로 박스를 열어보세요. 한 번에 ${BOX_COST}P가 소모됩니다.`}
      />

      <section className="border border-line bg-white p-4">
        {!session?.user ? (
          <p className="py-8 text-center text-sm text-ink-500">
            랜덤박스는{" "}
            <Link href="/login" className="text-navy-700 underline-offset-2 hover:underline">
              로그인
            </Link>{" "}
            후 이용할 수 있습니다.
          </p>
        ) : (
          <RandomBox
            prizes={prizes as PrizeLite[]}
            cost={BOX_COST}
            points={points}
            loggedIn={!!session?.user}
          />
        )}
      </section>

      {/* 상품 라인업 — 실사 이미지를 크게 보여주는 쇼케이스 (비로그인도 노출) */}
      {prizes.length > 0 && (
        <section className="mt-4 border border-line bg-white">
          <header className="border-b border-line px-4 py-2.5">
            <h2 className="text-sm font-semibold text-navy-900">상품 라인업</h2>
          </header>
          <ul className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
            {prizes.map((p) => {
              const { label, color } = rarityOf(p.rarity);
              return (
                <li key={p.id} className="overflow-hidden border" style={{ borderColor: color }}>
                  <div className="aspect-square w-full overflow-hidden" style={{ background: `${color}22` }}>
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <span
                        className="flex h-full items-center justify-center text-5xl font-bold"
                        style={{ color }}
                      >
                        {p.name.slice(0, 1)}
                      </span>
                    )}
                  </div>
                  <div className="px-2.5 py-2">
                    <p className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color }}>
                      {label}
                    </p>
                    <p className="truncate text-xs font-semibold text-navy-900">{p.name}</p>
                    {p.description && (
                      <p className="mt-0.5 truncate text-[11px] text-ink-500">{p.description}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* 최근 당첨 피드 */}
      <section className="mt-4 border border-line bg-white">
        <header className="border-b border-line px-4 py-2.5">
          <h2 className="text-sm font-semibold text-navy-900">최근 당첨</h2>
        </header>
        {recentWins.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-500">
            아직 당첨 기록이 없습니다. 첫 박스를 열어보세요!
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {recentWins.map((w) => (
              <li key={w.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: rarityOf(w.prize.rarity).color }}
                />
                <span className="text-ink-900">
                  <b className="font-semibold text-navy-900">{w.user.nickname}</b> 님이{" "}
                  <b className="font-semibold" style={{ color: rarityOf(w.prize.rarity).color }}>
                    {w.prize.name}
                  </b>{" "}
                  당첨!
                </span>
                <span className="ml-auto text-xs text-ink-500">
                  {w.createdAt.toLocaleTimeString("ko-KR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
