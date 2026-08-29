import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// 링크 공유 썸네일(OG · 1200×630) — 시안 A "Centered".
// 딥네이비 바탕에 워드마크 정중앙, 풀네임 한 줄을 바로 아래. 요소는 이 둘뿐이라
// 카카오톡/슬랙이 어느 비율로 잘라도 중앙 대칭이 무너지지 않는다.
export const alt = "KMIR — Kang Market Intelligence & Research";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const NAVY = "#091955";
const PERIWINKLE = "#aab6f0";

// 워드마크 300px × 트래킹 -0.055em, 풀네임 20px × 트래킹 0.18em.
// 트래킹은 마지막 글자 뒤에도 붙어 박스 폭이 실제 글자보다 넓어(좁아)진다 →
// 그만큼 마진으로 상쇄해야 "가운데 정렬"이 광학적으로도 정중앙이 된다.
const MARK_SIZE = 300;
const MARK_TRACKING = MARK_SIZE * -0.055;
const EXP_SIZE = 20;
const EXP_TRACKING = EXP_SIZE * 0.18;

export default async function Image() {
  const [archivo, geistMono] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/Archivo-Black.ttf")),
    readFile(join(process.cwd(), "assets/fonts/GeistMono-SemiBold.ttf")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: NAVY,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 44,
        }}
      >
        <div
          style={{
            fontFamily: "Archivo",
            fontSize: MARK_SIZE,
            lineHeight: 0.82,
            letterSpacing: MARK_TRACKING,
            marginRight: -MARK_TRACKING,
            color: "#ffffff",
          }}
        >
          KMIR
        </div>
        <div
          style={{
            fontFamily: "Geist Mono",
            fontSize: EXP_SIZE,
            letterSpacing: EXP_TRACKING,
            marginRight: -EXP_TRACKING,
            color: PERIWINKLE,
          }}
        >
          KANG MARKET INTELLIGENCE &amp; RESEARCH
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Archivo", data: archivo, style: "normal", weight: 900 },
        { name: "Geist Mono", data: geistMono, style: "normal", weight: 600 },
      ],
    },
  );
}
