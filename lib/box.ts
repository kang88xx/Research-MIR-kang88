// 랜덤박스 공용 상수 — "use server"(lib/actions) 밖에 둬서 서버/클라이언트 양쪽에서 import 가능

// 박스 1회 오픈 비용 (포인트). 게시글 5P·출석 10P 기준
export const BOX_COST = 100;

export const RARITIES = ["common", "rare", "epic", "legendary"] as const;
export type Rarity = (typeof RARITIES)[number];

// 등급별 색·라벨 — 옵시디언 크롬 톤에 맞춘 등급 액센트
export const RARITY_META: Record<string, { label: string; color: string }> = {
  common: { label: "커먼", color: "#98a1aa" }, // ink-400
  rare: { label: "레어", color: "#3b6fb0" }, // indigo-500
  epic: { label: "에픽", color: "#b98a1d" }, // 골드
  legendary: { label: "레전더리", color: "#d24b50" }, // 레드
};

export function rarityMeta(r: string) {
  return RARITY_META[r] ?? RARITY_META.common;
}
