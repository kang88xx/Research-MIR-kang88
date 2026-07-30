import Link from "next/link";
import { formatPostDate } from "@/lib/format";
import { getMembers, type MemberSort } from "@/lib/admin";

export const dynamic = "force-dynamic";

const SORTS: { key: MemberSort; label: string }[] = [
  { key: "recent", label: "최신 가입" },
  { key: "level", label: "레벨순" },
];

// 권한 게이트는 app/admin/layout.tsx에서 일원화.
export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const sort: MemberSort = sp.sort === "level" ? sp.sort : "recent";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const { rows, total, totalPages } = await getMembers({ q, sort, page });

  // 검색·정렬을 유지하며 page만 바꾸는 링크 빌더
  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (sort !== "recent") params.set("sort", sort);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/admin/members?${s}` : "/admin/members";
  };

  const blockStart = Math.floor((page - 1) / 10) * 10 + 1;
  const blockEnd = Math.min(blockStart + 9, totalPages);
  const pages = Array.from({ length: blockEnd - blockStart + 1 }, (_, i) => blockStart + i);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-navy-900">회원 관리</h1>
        <span className="text-xs text-ink-500">총 {total.toLocaleString()}명</span>
      </div>

      {/* 검색 + 정렬 (GET 폼) */}
      <form method="get" action="/admin/members" className="mb-4 flex flex-wrap items-center gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="닉네임 · 이메일 검색"
          className="min-w-[200px] flex-1 border border-line bg-white px-3 py-1.5 text-sm text-ink-900 focus:border-navy-700 focus:outline-none"
        />
        <select
          name="sort"
          defaultValue={sort}
          className="border border-line bg-white px-2 py-1.5 text-sm text-ink-900 focus:border-navy-700 focus:outline-none"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="bg-navy-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-navy-700"
        >
          검색
        </button>
        {q && (
          <Link href="/admin/members" className="text-xs text-ink-500 hover:text-navy-700">
            초기화
          </Link>
        )}
      </form>

      <div className="overflow-x-auto border border-line bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-navy-900 text-xs font-light text-white">
              <th className="px-3 py-2 text-left font-normal">회원</th>
              <th className="px-3 py-2 text-left font-normal">이메일</th>
              <th className="px-3 py-2 text-right font-normal">글</th>
              <th className="px-3 py-2 text-right font-normal">댓글</th>
              <th className="px-3 py-2 text-right font-normal">가입일</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-ink-500">
                  {q ? "검색 결과가 없습니다." : "회원이 없습니다."}
                </td>
              </tr>
            ) : (
              rows.map((m) => (
                <tr key={m.id} className="border-b border-line last:border-0 hover:bg-paper">
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className="mr-1 bg-paper2 px-1 font-mono text-[10px] text-navy-500">
                      Lv{m.level}
                    </span>
                    <span className="text-ink-900">{m.nickname}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-ink-500">{m.email}</td>
                  <td className="px-3 py-2 text-right font-mono text-ink-500">{m._count.posts}</td>
                  <td className="px-3 py-2 text-right font-mono text-ink-500">{m._count.comments}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-xs text-ink-500">
                    {formatPostDate(m.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <nav className="mt-4 flex items-center justify-center gap-1 text-sm">
          {blockStart > 1 && (
            <Link href={pageHref(blockStart - 1)} className="px-2 py-1 text-ink-500 hover:bg-paper2">
              이전
            </Link>
          )}
          {pages.map((p) => (
            <Link
              key={p}
              href={pageHref(p)}
              className={`px-2.5 py-1 ${
                p === page ? "bg-navy-900 font-semibold text-white" : "text-ink-500 hover:bg-paper2"
              }`}
            >
              {p}
            </Link>
          ))}
          {blockEnd < totalPages && (
            <Link href={pageHref(blockEnd + 1)} className="px-2 py-1 text-ink-500 hover:bg-paper2">
              다음
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
