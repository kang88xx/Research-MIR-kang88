"use client";

// 루트 레이아웃 자체가 렌더에 실패했을 때의 마지막 방어선 — 자체 <html>/<body>가 필요하다.
// 레이아웃 CSS를 신뢰할 수 없는 상황이므로 인라인 스타일만 사용한다.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            '"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
          background: "#f4f5f8",
          color: "#1c2536",
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: "100%",
            border: "1px solid #d9e0ea",
            borderRadius: 6,
            background: "#fff",
            padding: 32,
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: 19, fontWeight: 800, margin: "0 0 8px" }}>
            일시적인 오류가 발생했어요
          </h1>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: "#5d6a80", margin: "0 0 20px" }}>
            잠시 후 다시 시도해 주세요. 문제가 계속되면 운영자에게 알려 주세요.
          </p>
          <button
            onClick={() => reset()}
            style={{
              border: "none",
              borderRadius: 5,
              background: "#101a2e",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              padding: "10px 20px",
              cursor: "pointer",
            }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
