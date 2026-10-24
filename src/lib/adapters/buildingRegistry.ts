import "server-only";
import { createHash } from "node:crypto";
import { DAEGU_DISTRICTS, SIDO } from "@/config/regions";
import { SUPPORTED_SIDO } from "@/config/building";

/**
 * 건축물대장 조회 어댑터.
 * MVP는 MockBuildingRegistry 가 주소 문자열로부터 결정적인 가상 정보를 만든다.
 * 실제 연동 시 PublicDataBuildingRegistry 를 구현하고 BUILDING_REGISTRY_PROVIDER=public 으로 바꾼다.
 */

export type RegistryRecord = {
  address: string; // 정규화된 지번 주소
  sido: string;
  sigungu: string;
  dong: string;
  lat: number;
  lng: number;
  approvalDate: string | null; // YYYY-MM-DD (사용승인일)
  usage: "DETACHED" | "MULTI_HOUSEHOLD" | "MULTIPLEX";
  structure: "RC" | "MASONRY" | "BRICK" | "WOOD" | "STEEL" | "OTHER";
  grossArea: number; // ㎡
  floors: number;
  households: number;
  source: "MOCK" | "API";
};

export type RegistryLookup =
  | { ok: true; record: RegistryRecord }
  | { ok: false; reason: "UNSUPPORTED_REGION" | "NOT_FOUND" | "INVALID_ADDRESS" | "PROVIDER_ERROR"; message: string };

export interface BuildingRegistryAdapter {
  readonly name: string;
  lookup(address: string): Promise<RegistryLookup>;
}

// ── 주소 해석 (mock·실제 공용) ──
export type ParsedAddress = { sido: string; sigungu: string; dong: string | null; lot: string | null };

export function parseDaeguAddress(input: string): ParsedAddress | { error: RegistryLookup & { ok: false } } {
  const tokens = input.replace(/[,()]/g, " ").replace(/번지/g, "").split(/\s+/).filter(Boolean);
  if (tokens.join("").length < 4)
    return { error: { ok: false, reason: "INVALID_ADDRESS", message: "주소를 조금 더 자세히 입력해주세요." } };
  const sidoToken = tokens.find((t) => /(특별시|광역시|특별자치시|도)$/.test(t) || /^(서울|부산|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주|대구)$/.test(t));
  if (sidoToken && !sidoToken.startsWith("대구"))
    return { error: { ok: false, reason: "UNSUPPORTED_REGION", message: `지금은 ${SUPPORTED_SIDO.join(", ")} 주소만 지원해요.` } };

  // "수성구" 또는 줄임말 "수성" 모두 허용 (중구·동구 등 두 글자 구는 줄임말 불가)
  const idx = tokens.findIndex((t) =>
    DAEGU_DISTRICTS.some((d) => t === d.sigungu || (d.sigungu.length > 2 && t === d.sigungu.slice(0, -1))),
  );
  if (idx < 0)
    return { error: { ok: false, reason: "INVALID_ADDRESS", message: "구·군 이름을 찾지 못했어요. 예: 대구 남구 대명동 123-4" } };
  const district = DAEGU_DISTRICTS.find((d) => tokens[idx] === d.sigungu || tokens[idx] === d.sigungu.slice(0, -1))!;
  const rest = tokens.slice(idx + 1);
  const dong = rest.find((t) => /^[가-힣0-9]+(동|읍|면|가)$/.test(t)) ?? null;
  const lot = [...rest].reverse().find((t) => /^산?\d{1,5}(-\d{1,4})?$/.test(t)) ?? null;
  return { sido: SIDO, sigungu: district.sigungu, dong, lot };
}

// ── Mock ──
function hashInts(s: string) {
  const h = createHash("sha256").update(s).digest();
  let i = 0;
  return () => h[i++ % h.length] / 255;
}

export class MockBuildingRegistry implements BuildingRegistryAdapter {
  readonly name = "mock";

  async lookup(address: string): Promise<RegistryLookup> {
    const parsed = parseDaeguAddress(address);
    if ("error" in parsed) return parsed.error;
    if (!parsed.lot) return { ok: false, reason: "INVALID_ADDRESS", message: "번지까지 입력해주세요. 예: 대명동 123-4" };

    const district = DAEGU_DISTRICTS.find((d) => d.sigungu === parsed.sigungu)!;
    const knownDong = district.dongs.find((d) => d.name === parsed.dong);
    const dongName = parsed.dong ?? district.dongs[0].name;
    const r = hashInts(`${parsed.sigungu}|${dongName}|${parsed.lot}`);
    const center = knownDong ?? district;

    const usageRoll = r();
    const usage = usageRoll < 0.4 ? "DETACHED" : usageRoll < 0.7 ? "MULTI_HOUSEHOLD" : "MULTIPLEX";
    const year = 1978 + Math.floor(r() * 38); // 1978~2015
    const floors = usage === "DETACHED" ? 1 + Math.round(r()) : 3 + Math.round(r());
    const households = usage === "DETACHED" ? 1 : usage === "MULTI_HOUSEHOLD" ? 3 + Math.floor(r() * 7) : 4 + Math.floor(r() * 9);
    const grossArea =
      usage === "DETACHED" ? 70 + Math.round(r() * 120) : usage === "MULTI_HOUSEHOLD" ? 180 + Math.round(r() * 300) : 260 + Math.round(r() * 500);
    const sRoll = r();
    const structure = year < 1990 ? (sRoll < 0.5 ? "BRICK" : sRoll < 0.8 ? "MASONRY" : "RC") : sRoll < 0.6 ? "RC" : sRoll < 0.8 ? "BRICK" : "MASONRY";

    return {
      ok: true,
      record: {
        address: `${SIDO} ${parsed.sigungu} ${dongName} ${parsed.lot}`,
        sido: SIDO,
        sigungu: parsed.sigungu,
        dong: dongName,
        lat: +(center.lat + (r() - 0.5) * 0.01).toFixed(6),
        lng: +(center.lng + (r() - 0.5) * 0.012).toFixed(6),
        approvalDate: `${year}-${String(1 + Math.floor(r() * 12)).padStart(2, "0")}-${String(1 + Math.floor(r() * 28)).padStart(2, "0")}`,
        usage,
        structure,
        grossArea,
        floors,
        households,
        source: "MOCK",
      },
    };
  }
}

/**
 * 공공데이터포털 건축물대장 Open API 연동 자리.
 * TODO(연동 시):
 *  1. 주소 → 시군구코드·법정동코드·번·지 변환 (행정안전부 도로명주소 API 등)
 *  2. 건축물대장 표제부 조회 (국토교통부 건축HUB 건축물대장정보 서비스 — 엔드포인트·필드명은 신청 시 명세서로 확인)
 *     사용승인일(useAprDay), 주용도(mainPurpsCdNm), 구조(strctCdNm), 연면적(totArea), 지상층수(grndFlrCnt), 세대수(hhldCnt)
 *  3. 좌표는 대장에 없으므로 지오코딩 API 로 별도 조회
 *  4. 주용도 코드 → DETACHED/MULTI_HOUSEHOLD/MULTIPLEX, 구조 코드 → RC/MASONRY/... 매핑
 *  키: process.env.BUILDING_REGISTRY_API_KEY
 */
export class PublicDataBuildingRegistry implements BuildingRegistryAdapter {
  readonly name = "public";
  async lookup(): Promise<RegistryLookup> {
    return { ok: false, reason: "PROVIDER_ERROR", message: "건축물대장 API 연동이 아직 설정되지 않았어요. 정보를 직접 입력해주세요." };
  }
}

export function getBuildingRegistry(): BuildingRegistryAdapter {
  return process.env.BUILDING_REGISTRY_PROVIDER === "public" ? new PublicDataBuildingRegistry() : new MockBuildingRegistry();
}
