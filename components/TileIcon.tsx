"use client";

// 마켓 지표 타일 공용 아이콘 — 홈 마켓바(MarketBar)와 지표 페이지(IndicatorGrid)가 같이 쓴다.
// 진짜 로고가 있는 지표만 이미지를 표시하고, 나머지(지수·환율 등)는 아이콘 없이 텍스트만.
// ticker는 제목 옆 모노 심볼 표기 (라벨에 이미 심볼이 있는 항목은 생략)
export const ICONS: Record<string, { img?: string; ticker?: string }> = {
  btc: { img: "/logos/coins/BTC.png", ticker: "BTC" },
  eth: { img: "/logos/coins/ETH.png", ticker: "ETH" },
  btcDom: { img: "/logos/coins/BTC.png", ticker: "BTC.D" },
  usdtKimchi: { img: "/logos/coins/USDT.png" },
  mstr: { img: "/logos/coins/MSTR.png" },
  btcBreakeven: { img: "/logos/coins/BTC.png" },
  nasdaq: { ticker: "^IXIC" },
  kospi: { ticker: "^KS11" },
  kosdaq: { ticker: "^KQ11" },
  gold: { ticker: "GC=F" },
};

// 제목 앞 원형 로고 — 이미지 로드 실패 시 아이콘 자체를 숨겨 텍스트만 남긴다
export default function TileIcon({ k, size = 14 }: { k: string; size?: number }) {
  const img = ICONS[k]?.img;
  if (!img) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={img}
      alt=""
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  );
}
