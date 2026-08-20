import Link from "next/link";

// 커스텀 404 — notFound() 호출·미존재 경로에서 Next 기본 영문 404 대신 브랜드 톤 안내.
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-[420px] rounded-[6px] border border-line bg-white p-8 text-center">
        <div className="font-mono text-[11px] font-medium tracking-[0.7px] text-amber-300">
          404 NOT FOUND
        </div>
        <h1 className="mt-2 text-[19px] font-extrabold tracking-[-0.3px] text-ink-900">
          페이지를 찾을 수 없어요
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-500">
          주소가 잘못됐거나, 삭제·이동된 페이지입니다.
        </p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-[5px] bg-navy-900 px-5 py-2.5 text-[13px] font-bold text-white transition-opacity hover:opacity-85"
        >
          홈으로 이동
        </Link>
      </div>
    </div>
  );
}
