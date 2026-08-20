// 권한 레벨 단일 소스 — 별도 role 컬럼 없이 레벨 관례를 쓴다.
// Lv10+ = 운영진: 어드민 접근·시장 분석 작성·승인 게이트 무조건 통과가 전부 이 값 하나로 걸린다.
export const ADMIN_MIN_LEVEL = 10;
// 시장 분석 작성 권한 — 현재 운영진과 동일 레벨. 향후 편집자 등급을 분리하면 여기만 바꾼다.
export const EDITOR_MIN_LEVEL = ADMIN_MIN_LEVEL;
