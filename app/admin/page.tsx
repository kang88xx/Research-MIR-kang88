import { getAdminStats, getDailySeries } from "@/lib/admin";

export const dynamic = "force-dynamic";

// 권한 게이트는 app/admin/layout.tsx에서 일원화.
export default async function AdminHomePage() {
  const [stats, daily] = await Promise.all([getAdminStats(), getDailySeries(14)]);

  const cumulative = [
    { label: "총 회원", value: stats.totalUsers },
    { label: "총 게시글", value: stats.totalPosts },
    { label: "총 댓글", value: stats.totalComments },
  ];
  const today = [
    { label: "오늘 방문", value: stats.todayVisitors },
    { label: "오늘 가입", value: stats.todaySignups },
    { label: "오늘 글", value: stats.todayPosts },
    { label: "오늘 댓글", value: stats.todayComments },
  ];

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-navy-900">대시보드</h1>

      {/* 누적 */}
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">누적</h2>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cumulative.map((c) => (
          <div key={c.label} className="border border-line bg-white px-4 py-3">
            <p className="text-[11px] text-ink-500">{c.label}</p>
            <p className="mt-1 font-mono text-2xl font-semibold tracking-tight text-navy-900">
              {c.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* 금일 */}
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
        금일 (KST {daily[0]?.day})
      </h2>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {today.map((c) => (
          <div key={c.label} className="border border-line bg-white px-4 py-3">
            <p className="text-[11px] text-ink-500">{c.label}</p>
            <p className="mt-1 font-mono text-2xl font-semibold tracking-tight text-navy-900">
              {c.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* 데일리 DB */}
      <section className="border border-line bg-white">
        <header className="border-b border-line px-4 py-2.5">
          <h2 className="text-sm font-semibold text-navy-900">최근 14일 일자별 집계</h2>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy-900 text-xs font-light text-white">
                <th className="px-3 py-2 text-left font-normal">날짜 (KST)</th>
                <th className="px-3 py-2 text-right font-normal">방문</th>
                <th className="px-3 py-2 text-right font-normal">가입</th>
                <th className="px-3 py-2 text-right font-normal">글</th>
                <th className="px-3 py-2 text-right font-normal">댓글</th>
              </tr>
            </thead>
            <tbody>
              {daily.map((d) => (
                <tr key={d.day} className="border-b border-line last:border-0 hover:bg-paper">
                  <td className="px-3 py-2 font-mono text-xs text-ink-500">{d.day}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-navy-900">
                    {d.visitors.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-ink-900">{d.signups}</td>
                  <td className="px-3 py-2 text-right font-mono text-ink-900">{d.posts}</td>
                  <td className="px-3 py-2 text-right font-mono text-ink-900">{d.comments}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
