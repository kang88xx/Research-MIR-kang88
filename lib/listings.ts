// @NewListingsFeed 텔레그램 공개 채널 → 금일 신규 상장 예정 추출
// 대상: 바이낸스 선물 · Upbit · Bithumb · Bybit · Robinhood · Coinbase(로드맵 포함) · OKX
// 봇/로그인 없이 t.me/s 웹 미리보기를 30분 간격으로 스크래핑

import { lookup } from "node:dns/promises";
import { cachedJson } from "@/lib/cache";
import { kstDay, KST_MS } from "@/lib/time";

// ── SSRF 방어 — 채널에서 파싱한 외부 URL은 공격자 제어 가능 ──
function isPrivateIPv4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) || // 링크로컬 / 클라우드 메타데이터(169.254.169.254)
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    a >= 224 // 멀티캐스트/예약
  );
}

function isPrivateIPv6(ip: string): boolean {
  const s = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (s === "::1" || s === "::") return true;
  if (/^fe[89ab]/.test(s)) return true; // 링크로컬 fe80::/10
  if (/^f[cd]/.test(s)) return true; // 유니크 로컬 fc00::/7
  const dotted = s.match(/::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dotted) return isPrivateIPv4(dotted[1]);
  const hex = s.match(/::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const n = ((parseInt(hex[1], 16) << 16) | parseInt(hex[2], 16)) >>> 0;
    return isPrivateIPv4(`${(n >>> 24) & 255}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`);
  }
  return false;
}

async function isSafePublicUrl(raw: string): Promise<boolean> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return !isPrivateIPv4(host);
  if (host.includes(":")) return false; // 원시 IPv6 리터럴 차단
  try {
    const addrs = await lookup(host, { all: true });
    if (addrs.length === 0) return false;
    return addrs.every((a) =>
      a.family === 6 ? !isPrivateIPv6(a.address) : !isPrivateIPv4(a.address)
    );
  } catch {
    return false;
  }
}

export type Exchange = "Binance" | "Upbit" | "Bithumb" | "Bybit" | "Robinhood" | "Coinbase" | "OKX";

export type Listing = {
  id: string; // 메시지 고유 (t.me 링크 끝 번호)
  exchange: Exchange; // 노출 대상 거래소
  symbol: string | null; // 예: ZEST
  detail: string; // 예: "listed on Binance futures"
  text: string; // 디코딩된 원문 한 줄
  url: string | null; // 메시지/원문 링크
  date: string; // ISO (UTC) — 텔레그램 게시 시각
  scheduledAt: string | null; // ISO (UTC) — 원문에서 추출한 상장 예정 시각 (없으면 null=미정)
};

const CHANNEL = "NewListingsFeed";
const SRC_URL = `https://t.me/s/${CHANNEL}`;
const TTL_MS = 30 * 60_000; // 30분에 한 번만 실제 스크래핑

const FUTURES_RE = /futures|perpetual|perp\b/i;

// @NewListingsFeed 메시지 → 노출 대상 거래소 분류 (대상 아니면 null)
// 바이낸스는 선물(futures/perpetual)만, 나머지는 상장·로드맵 전부.
function classifyExchange(text: string): Exchange | null {
  if (/binance/i.test(text) && FUTURES_RE.test(text)) return "Binance";
  if (/upbit/i.test(text)) return "Upbit"; // 업비트 상장(현물·KRW) — 김프 직결
  if (/bithumb/i.test(text)) return "Bithumb";
  if (/bybit/i.test(text)) return "Bybit";
  if (/robinhood/i.test(text)) return "Robinhood";
  if (/coinbase/i.test(text)) return "Coinbase"; // 상장 + 로드맵(roadmap) 포함
  if (/okx/i.test(text)) return "OKX"; // OKX 현물·선물 상장
  return null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&#0*36;/g, "$")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseListings(html: string): Listing[] {
  const out: Listing[] = [];
  const re = /tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const inner = m[1];
    const text = decodeEntities(inner);
    if (!text) continue;
    // 노출 대상 거래소만 (바이낸스 선물 · Upbit · Bithumb · Bybit · Robinhood · Coinbase)
    const exchange = classifyExchange(text);
    if (!exchange) continue;

    // 포스팅 본문 안의 원문 링크(거래소 공지·X 등) — 우선 사용
    const srcUrl = inner.match(/href="([^"]+)"/)?.[1]?.replace(/&amp;/g, "&") ?? null;
    const after = html.slice(re.lastIndex, re.lastIndex + 4000);
    const dt = after.match(/datetime="([^"]+)"/)?.[1] ?? null;
    const link = after.match(/href="(https:\/\/t\.me\/[^"]+\/(\d+))"/);
    const url = srcUrl ?? link?.[1] ?? null;
    const id = link?.[2] ?? `${out.length}`;
    const sym = text.match(/^\$?([A-Z0-9]{1,15})\b/)?.[1] ?? null;
    const detail = sym ? text.replace(/^\$?[A-Z0-9]{1,15}\s*/, "") : text;
    out.push({
      id,
      exchange,
      symbol: sym,
      detail,
      text,
      url,
      date: dt ? new Date(dt).toISOString() : new Date().toISOString(),
      scheduledAt: null,
    });
  }
  return out;
}

const MON: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

// KST(UTC+9) 시:분 → UTC ISO. 자정 전후로 음수 시각이 나와도 Date.UTC가 날짜를 보정함.
function kstToUtcIso(y: number, mo1: number, d: number, hh: number, mm: number): string {
  return new Date(Date.UTC(y, mo1 - 1, d, hh, mm) - KST_MS).toISOString();
}

// ── Bithumb 공지: 본문(예상거래시간)은 Cloudflare로 서버 fetch 불가 → 공개 공지 리스트 API 사용 ──
// feed-api는 최신 공지의 제목·게시시각·pc_url을 JSON으로 제공. 거래 오픈 시각은 제목에
// "(거래 오픈 오후 6시 30분)" / "(거래 오픈 오후 17:00)" 형태로 붙는다(임박 상장 시).
type BithumbNotice = { title: string; publishedAt: string };
const BITHUMB_NOTICE_API = "https://feed-api.bithumb.com/v1/notices";

async function fetchBithumbNotices(): Promise<Map<string, BithumbNotice>> {
  const map = new Map<string, BithumbNotice>();
  try {
    const res = await fetch(BITHUMB_NOTICE_API, {
      signal: AbortSignal.timeout(7000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        Accept: "application/json",
        "Accept-Language": "ko-KR,ko;q=0.9",
      },
    });
    if (!res.ok) return map;
    const arr = (await res.json()) as Array<{ title?: string; pc_url?: string; published_at?: string }>;
    for (const n of Array.isArray(arr) ? arr : []) {
      const id = String(n.pc_url ?? "").match(/\/notice\/(\d+)/)?.[1];
      if (id && n.title && n.published_at) map.set(id, { title: n.title, publishedAt: n.published_at });
    }
  } catch {
    /* 네트워크/파싱 실패 → 빈 맵(미정 처리) */
  }
  return map;
}

// 빗썸 공지 제목에서 거래 오픈 시각(KST) → UTC ISO. 시각이 없으면 null(미정).
// published_at(KST)의 날짜에 제목의 시:분을 결합한다. 예: "(거래 오픈 오후 6시 30분)" → 18:30.
function parseBithumbTradeTime(title: string, publishedAt: string): string | null {
  if (!/거래\s*(오픈|지원|시작)/.test(title)) return null; // 거래시각 공지인지 확인(코인명 숫자 오인 방지)
  const ampm = title.match(/(오전|오후)/)?.[1];
  let hh: number, mm: number;
  const hm = title.match(/(\d{1,2}):(\d{2})/); // "17:00"
  const ko = title.match(/(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?/); // "6시 30분"
  if (hm) {
    hh = +hm[1]; mm = +hm[2];
  } else if (ko) {
    hh = +ko[1]; mm = ko[2] ? +ko[2] : 0;
  } else {
    return null;
  }
  if (ampm === "오후" && hh < 12) hh += 12; // 오후 6시 → 18 (단, "오후 17:00"은 이미 24h라 유지)
  if (ampm === "오전" && hh === 12) hh = 0; // 오전 12시 → 자정
  if (hh > 23 || mm > 59) return null;
  const date = publishedAt.split(" ")[0]; // "2026-06-19" (KST)
  const [y, mo, d] = date.split("-").map(Number);
  if (!y || !mo || !d) return null;
  return kstToUtcIso(y, mo, d, hh, mm);
}

// 상장 예정 시각을 읽기 위해 fetch를 허용할 거래소 공식 도메인 (allow-list).
// 정적 도메인만 허용하므로 DNS 리바인딩(TOCTOU)/HTTP 다운그레이드가 원천 무력화된다.
// 목록 밖 도메인은 fetch하지 않고 '미정'(null) 처리 — scheduledAt은 best-effort라 안전.
const ALLOWED_FETCH_HOSTS = [
  /(^|\.)binance\.com$/i,
  /(^|\.)bithumb\.com$/i,
  /(^|\.)upbit\.com$/i,
  /(^|\.)bybit\.com$/i,
  /(^|\.)coinbase\.com$/i,
  /(^|\.)robinhood\.com$/i,
  /(^|\.)okx\.com$/i,
];
function isAllowedFetchHost(hostname: string): boolean {
  return ALLOWED_FETCH_HOSTS.some((re) => re.test(hostname));
}

// 원문 fetch 응답 바이트 상한 — 대용량 페이지 하나가 서버리스 메모리·시간을 잡아먹지 않게
// 스트림으로 읽다가 상한에서 끊는다. 상장 시각 표기는 문서 앞부분에 있어 잘려도 무방.
const EXTRACT_MAX_BYTES = 512 * 1024;

async function readTextCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    chunks.push(value);
    if (total >= maxBytes) {
      await reader.cancel().catch(() => {});
      break;
    }
  }
  const buf = new Uint8Array(Math.min(total, maxBytes));
  let off = 0;
  for (const c of chunks) {
    const slice = off + c.byteLength > buf.byteLength ? c.subarray(0, buf.byteLength - off) : c;
    buf.set(slice, off);
    off += slice.byteLength;
    if (off >= buf.byteLength) break;
  }
  return new TextDecoder().decode(buf);
}

// 원문 공지에서 상장 예정 시각(UTC)을 best-effort로 추출. 못 찾으면 null.
async function extractScheduledTime(url: string | null): Promise<string | null> {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const hostname = u.hostname;
  // X·트위터 등 JS 렌더 페이지는 정적으로 시각을 못 읽음 → 미정 처리
  if (/(^|\.)(x|twitter)\.com$/i.test(hostname)) return null;
  // SSRF 방어 — https + 거래소 공식 도메인 allow-list만 fetch (리바인딩/다운그레이드 차단)
  if (u.protocol !== "https:" || !isAllowedFetchHost(hostname)) return null;
  if (!(await isSafePublicUrl(url))) return null; // 추가 방어: 사설 IP로 해석되는 호스트 차단
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(7000),
      redirect: "manual", // 리다이렉트로 사설망 우회 방지
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        Accept: "text/html",
      },
    });
    if (!res.ok) return null;
    // HTML만 파싱 — 바이너리/JSON 응답을 통째로 텍스트 변환하지 않는다
    const ct = res.headers.get("content-type") ?? "";
    if (ct && !/text\/html|application\/xhtml/i.test(ct)) return null;
    const t = (await readTextCapped(res, EXTRACT_MAX_BYTES))
      .replace(/<script[\s\S]*?<\/script>/g, " ")
      .replace(/<style[\s\S]*?<\/style>/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ");
    // 두 가지 어순 모두 대응
    const a = t.match(/([A-Z][a-z]{2,8})\.?\s+(\d{1,2}),?\s*(\d{4}),?\s+(\d{1,2}):(\d{2})\s*\(?UTC/);
    const b = t.match(/(\d{1,2}):(\d{2})\s*\(?UTC\)?\s+on\s+([A-Z][a-z]{2,8})\.?\s+(\d{1,2}),?\s*(\d{4})/);
    let y: number | undefined, mo: number | undefined, d: number, hh: number, mm: number;
    let idx = Infinity;
    if (a && a.index !== undefined && a.index < idx) {
      mo = MON[a[1].slice(0, 3).toLowerCase()]; d = +a[2]; y = +a[3]; hh = +a[4]; mm = +a[5]; idx = a.index;
    }
    if (b && b.index !== undefined && b.index < idx) {
      hh = +b[1]; mm = +b[2]; mo = MON[b[3].slice(0, 3).toLowerCase()]; d = +b[4]; y = +b[5]; idx = b.index;
    }
    if (idx === Infinity || mo == null || y == null) {
      // 영문 UTC 표기가 없으면 한국어 공지(빗썸 등) "예상 거래시간 … YYYY년 M월 D일 HH:MM"(KST) 시도
      const k = t.match(
        /(?:예상\s*거래\s*시간|거래\s*(?:지원|오픈|시작)[^.\d]{0,12})[^\d]{0,12}?(\d{4})\D{1,3}(\d{1,2})\D{1,3}(\d{1,2})\D{0,8}?(오전|오후)?\s*(\d{1,2})\s*[:시]\s*(\d{1,2})?/
      );
      if (!k) return null;
      let kh = +k[5];
      const km = k[6] ? +k[6] : 0;
      if (k[4] === "오후" && kh < 12) kh += 12;
      if (k[4] === "오전" && kh === 12) kh = 0;
      if (kh > 23 || km > 59) return null;
      return kstToUtcIso(+k[1], +k[2], +k[3], kh, km);
    }
    return new Date(Date.UTC(y, mo, d!, hh!, mm!)).toISOString();
  } catch {
    return null;
  }
}

async function scrape(): Promise<{ listings: Listing[]; updatedAt: string }> {
  const res = await fetch(SRC_URL, {
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      Accept: "text/html",
    },
  });
  if (!res.ok) throw new Error(`${SRC_URL} -> ${res.status}`);
  const html = await res.text();
  const all = parseListings(html);
  // HTML은 받았는데 메시지 블록이 0건이면 '오늘 상장 없음'이 아니라 위젯 마크업이 바뀐 신호일 수 있다.
  // (정규식 파싱이라 t.me 구조가 바뀌면 조용히 빈 결과가 캐싱됨 → 경고로 가시화)
  if (all.length === 0) {
    console.warn(
      `[listings] ${SRC_URL} 파싱 결과 0건 (html ${html.length}B) — t.me 위젯 마크업 변경 가능성`
    );
  }
  const today = kstDay(new Date());
  const yesterday = kstDay(new Date(Date.now() - 24 * 3600_000));
  // 게시일이 오늘/어제인 후보까지 본다 — '어제 공지된 오늘 상장'을 놓치지 않기 위함.
  // (상장 예정 시각 추출이 네트워크 비용이라 최신 40건으로 제한.)
  const candidates = all
    .filter((l) => {
      const d = kstDay(new Date(l.date));
      return d === today || d === yesterday;
    })
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 40);

  // 빗썸 공지 리스트 1콜(거래시각은 제목에 표기) — 매 리스팅 fetch 방지
  const hasBithumb = candidates.some((l) => l.exchange === "Bithumb");
  const bithumbNotices = hasBithumb ? await fetchBithumbNotices() : new Map<string, BithumbNotice>();

  // 원문에서 상장 예정 시각 추출 — 동시성 6으로 제한(최대 40개 동시 소켓 방지) +
  // 전체 10초 예산(콜드 캐시 인라인 경로가 오래 막히지 않게). 예산 초과분은 미정(null) 유지.
  const extractOne = async (l: Listing) => {
    if (l.exchange === "Bithumb") {
      // 빗썸: 공지 제목의 "(거래 오픈 …)"을 우선 사용(안정적), 없으면 본문 best-effort
      const id = l.url?.match(/feed\.bithumb\.com\/notice\/(\d+)/)?.[1];
      const notice = id ? bithumbNotices.get(id) : undefined;
      l.scheduledAt = notice ? parseBithumbTradeTime(notice.title, notice.publishedAt) : null;
      if (!l.scheduledAt) l.scheduledAt = await extractScheduledTime(l.url);
      return;
    }
    l.scheduledAt = await extractScheduledTime(l.url);
  };
  // 예산 초과 시 새 작업 배분을 멈추고(진행 중 건만 마무리), 타이머는 finally에서 해제.
  const deadline = Date.now() + 10_000;
  const queue = [...candidates];
  const workers = Array.from({ length: Math.min(6, queue.length) }, async () => {
    for (;;) {
      if (Date.now() >= deadline) return; // 예산 소진 — 남은 후보는 미정(null) 유지
      const l = queue.shift();
      if (!l) return;
      await extractOne(l);
    }
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.all(workers),
      new Promise((resolve) => {
        timer = setTimeout(resolve, 10_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }

  // '금일'은 게시일이 아니라 상장 예정일(scheduledAt) 기준으로 확정 — 없으면 게시일로 폴백.
  // 임박 순(예정 시각 빠른 것)으로 정렬해 위쪽에 가장 가까운 일정이 오게 한다.
  // 얕은 복사로 스냅숏 — 예산 초과 후 뒤늦게 끝난 워커가 반환·캐시된 결과를 변형하지 못하게.
  const listings = candidates
    .filter((l) => kstDay(new Date(l.scheduledAt ?? l.date)) === today)
    .sort((a, b) => (a.scheduledAt ?? a.date).localeCompare(b.scheduledAt ?? b.date))
    .map((l) => ({ ...l }));

  return { listings, updatedAt: new Date().toISOString() };
}

// 금일(KST) 신규 상장 예정 (바이낸스 선물·Upbit·Bithumb·Bybit·Robinhood·Coinbase·OKX) — DB 공유 캐시(30분)
// ok=false 는 '수집 실패(직전 데이터 없음)' — UI가 진짜 0건과 장애를 구분하게 한다.
export async function getTodayListings(): Promise<{ listings: Listing[]; updatedAt: string; ok: boolean }> {
  try {
    // -v6: 상장 예정일(scheduledAt) 기준 필터로 변경 — 옛 캐시 무시하고 즉시 갱신
    const r = await cachedJson("listings-v6", TTL_MS, scrape);
    return { ...r, ok: true };
  } catch {
    return { listings: [], updatedAt: new Date(0).toISOString(), ok: false };
  }
}
