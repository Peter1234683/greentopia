/**
 * 대구 지역 가상 데모 데이터
 * - 노후 저층주택 100동 (건물주 계정 100명, 이 중 1명은 데모 고객)
 * - 시공업체 15곳 (승인 13 · 심사대기 2)
 * - 2025년 완료된 공동공사 4건 (Cluster → 입찰 → 낙찰 → 건물별 계약 → 시공 완료 → 리뷰)
 * 모든 사람·업체·주소는 가상이며, 금액은 시드용 가정치다.
 * 실행: npm run db:seed (결정적 난수라 매번 같은 데이터가 만들어진다)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DAEGU_DISTRICTS, SIDO, type District } from "../src/config/regions";
import { runMatching } from "../src/lib/matching/run";
import { createTenderDraft } from "../src/lib/bidding/tenders";
import { confirmTender } from "../src/lib/bidding/lifecycle";
import { bidTotal, tierRanges } from "../src/lib/bidding/bidMath";
import { PRICING_DEFAULTS } from "../src/config/pricing";
import { BIDDING_DEFAULTS } from "../src/config/bidding";
import { MATCHING_DEFAULTS } from "../src/config/matching";

const db = new PrismaClient();

// ── 결정적 난수 ──
let seed = 20261024;
const rand = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
const weighted = <T,>(pairs: [T, number][]) => {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of pairs) if ((r -= w) <= 0) return v;
  return pairs[pairs.length - 1][0];
};
const sample = <T,>(arr: readonly T[], n: number) => [...arr].sort(() => rand() - 0.5).slice(0, n);
const json = (v: unknown) => JSON.stringify(v);
const d = (s: string) => new Date(`${s}T09:00:00+09:00`);
const monthsFromNow = (m: number) => {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth() + m, 1);
};

const SURNAMES = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오", "서", "신", "권", "황", "안", "송", "류", "전"];
const GIVEN = ["영희", "철수", "민준", "서연", "정숙", "상철", "미경", "동훈", "순자", "영호", "경희", "재원", "말순", "성민", "혜진", "광수", "은주", "태식", "옥자", "병철", "지현", "종수", "명숙", "현우"];
const personName = () => pick(SURNAMES) + pick(GIVEN);

// ── 수요 핫스팟: 이후 마일스톤의 AI 매칭이 Cluster를 만들 수 있도록 같은 공종 수요를 모아둔다 ──
type Hotspot = { sigungu: string; dong: string; trades: string[]; count: number; usage?: string };
const HOTSPOTS: Hotspot[] = [
  { sigungu: "남구", dong: "대명동", trades: ["WINDOW"], count: 13 },
  { sigungu: "서구", dong: "비산동", trades: ["WINDOW"], count: 10 },
  { sigungu: "북구", dong: "침산동", trades: ["EXT_INSULATION", "WINDOW"], count: 8, usage: "MULTI_HOUSEHOLD" },
  { sigungu: "달서구", dong: "송현동", trades: ["BOILER"], count: 9, usage: "MULTIPLEX" },
  { sigungu: "수성구", dong: "황금동", trades: ["ROOF", "INT_INSULATION"], count: 6, usage: "DETACHED" },
];

const SYMPTOMS_BY_TRADE: Record<string, string[]> = {
  WINDOW: ["OLD_WINDOW", "COLD_WINTER"],
  EXT_INSULATION: ["COLD_WINTER", "HIGH_BILL"],
  INT_INSULATION: ["COLD_WINTER"],
  BOILER: ["BOILER", "HIGH_BILL"],
  ROOF: ["ROOF_LEAK"],
};

function district(name: string): District {
  return DAEGU_DISTRICTS.find((x) => x.sigungu === name)!;
}

function makeBuildingData(sigungu: string, dongName: string, usageHint?: string) {
  const dist = district(sigungu);
  const dong = dist.dongs.find((x) => x.name === dongName) ?? pick(dist.dongs);
  const usage = usageHint ?? weighted<string>([["DETACHED", 4], ["MULTI_HOUSEHOLD", 3], ["MULTIPLEX", 3]]);
  const year = weighted<number>([[int(1975, 1989), 3], [int(1990, 2002), 5], [int(2003, 2015), 2]]);
  const floors = usage === "DETACHED" ? int(1, 2) : int(3, 4);
  const households = usage === "DETACHED" ? 1 : usage === "MULTI_HOUSEHOLD" ? int(3, 9) : int(4, 12);
  const grossArea =
    usage === "DETACHED" ? int(70, 190) : usage === "MULTI_HOUSEHOLD" ? int(180, 480) : int(260, 780);
  const structure =
    year < 1990 ? weighted<string>([["BRICK", 5], ["MASONRY", 3], ["RC", 2]]) : weighted<string>([["RC", 6], ["BRICK", 2], ["MASONRY", 2]]);
  // 반경 약 600m 안에 흩뿌린다
  const lat = dong.lat + (rand() - 0.5) * 0.011;
  const lng = dong.lng + (rand() - 0.5) * 0.013;
  return {
    address: `${SIDO} ${sigungu} ${dongName.endsWith("읍") ? dongName : dong.name} ${int(10, 1999)}-${int(1, 40)}`,
    sido: SIDO,
    sigungu,
    dong: dong.name,
    lat: +lat.toFixed(6),
    lng: +lng.toFixed(6),
    approvalDate: new Date(year, int(0, 11), int(1, 28)),
    usage,
    structure,
    grossArea,
    floors,
    households,
    windowArea: Math.round(grossArea * (0.12 + rand() * 0.06)),
    registrySource: "MOCK",
  };
}

function makeDemand(trades: string[], status = "ACTIVE") {
  const symptoms = [...new Set(trades.flatMap((t) => SYMPTOMS_BY_TRADE[t]))];
  const budget = pick([[500, 1000], [1000, 2000], [1500, 3000], [2000, 4000]] as const);
  return {
    tradesJson: json(trades),
    symptomsJson: json(symptoms),
    desiredStart: monthsFromNow(int(1, 6)),
    budgetMin: budget[0] * 10000,
    budgetMax: budget[1] * 10000,
    jointIntent: weighted<string>([["YES", 6], ["MAYBE", 3], ["NO", 1]]),
    billElectric: int(4, 15) * 10000,
    billGas: int(6, 30) * 10000,
    status,
  };
}

// ── 시공업체 ──
type ContractorSeed = {
  email: string;
  company: string;
  trades: string[];
  regions: string[];
  grade: string;
  status?: "APPROVED" | "PENDING";
  gr?: boolean;
  warranty?: boolean;
  staff: number;
  external: number;
  license: string;
  office: string;
};
const CONTRACTORS: ContractorSeed[] = [
  { email: "contractor@demo.kr", company: "푸른창호이엔지", trades: ["WINDOW", "INT_INSULATION"], regions: ["남구", "서구", "중구", "달서구"], grade: "EXCELLENT", staff: 9, external: 34, license: "실내건축공사업", office: "남구" },
  { email: "c02@demo.kr", company: "대구그린리모델링", trades: ["WINDOW", "EXT_INSULATION", "ROOF"], regions: ["전체"], grade: "GREEN_PARTNER", staff: 18, external: 71, license: "실내건축공사업", office: "수성구" },
  { email: "c03@demo.kr", company: "수성에너지하우스", trades: ["EXT_INSULATION", "INT_INSULATION", "ROOF"], regions: ["수성구", "동구", "중구"], grade: "EXCELLENT", staff: 11, external: 40, license: "실내건축공사업", office: "수성구" },
  { email: "c04@demo.kr", company: "달구벌창호", trades: ["WINDOW"], regions: ["서구", "북구", "중구"], grade: "STANDARD", staff: 6, external: 22, license: "금속창호·지붕건축물조립공사업", office: "서구" },
  { email: "c05@demo.kr", company: "한빛보일러설비", trades: ["BOILER"], regions: ["달서구", "남구", "서구", "달성군"], grade: "STANDARD", staff: 7, external: 58, license: "기계설비·가스공사업", office: "달서구" },
  { email: "c06@demo.kr", company: "에코단열시스템", trades: ["EXT_INSULATION", "INT_INSULATION"], regions: ["북구", "동구", "서구"], grade: "STANDARD", staff: 8, external: 19, license: "실내건축공사업", office: "북구" },
  { email: "c07@demo.kr", company: "신암종합건설", trades: ["WINDOW", "EXT_INSULATION", "BOILER", "ROOF"], regions: ["동구", "북구", "수성구"], grade: "STANDARD", staff: 14, external: 27, license: "건축공사업", office: "동구" },
  { email: "c08@demo.kr", company: "온누리설비", trades: ["BOILER"], regions: ["전체"], grade: "STANDARD", staff: 5, external: 40, license: "기계설비·가스공사업", office: "중구" },
  { email: "c09@demo.kr", company: "그린웰창호", trades: ["WINDOW"], regions: ["남구", "달서구", "수성구"], grade: "STANDARD", staff: 5, external: 15, license: "금속창호·지붕건축물조립공사업", office: "남구" },
  { email: "c10@demo.kr", company: "참좋은지붕", trades: ["ROOF", "INT_INSULATION"], regions: ["수성구", "남구", "달성군"], grade: "STANDARD", staff: 4, external: 12, license: "금속창호·지붕건축물조립공사업", office: "수성구" },
  { email: "c11@demo.kr", company: "새봄리모델링", trades: ["WINDOW", "INT_INSULATION"], regions: ["북구", "서구"], grade: "SPROUT", staff: 3, external: 4, license: "실내건축공사업", office: "북구" },
  { email: "c12@demo.kr", company: "다사에너지설비", trades: ["BOILER", "ROOF"], regions: ["달성군", "달서구"], grade: "SPROUT", staff: 3, external: 6, license: "기계설비·가스공사업", office: "달성군" },
  { email: "c13@demo.kr", company: "명성인테리어", trades: ["WINDOW", "INT_INSULATION"], regions: ["중구", "남구"], grade: "SPROUT", gr: false, staff: 4, external: 9, license: "실내건축공사업", office: "중구" },
  { email: "pending@demo.kr", company: "새길창호", trades: ["WINDOW"], regions: ["달서구", "남구"], grade: "SPROUT", status: "PENDING", staff: 2, external: 3, license: "실내건축공사업", office: "달서구" },
  { email: "c15@demo.kr", company: "튼튼단열", trades: ["EXT_INSULATION"], regions: ["전체"], grade: "SPROUT", status: "PENDING", warranty: false, staff: 3, external: 2, license: "실내건축공사업", office: "서구" },
];

// ── 과거 완료 공동공사 (리뷰·평판 데이터 확보용) ──
type PastJob = {
  code: number;
  sigungu: string;
  dong: string;
  trade: string;
  usage?: string;
  size: number;
  bidders: string[]; // 업체 email (첫 번째가 낙찰)
  completed: string;
  // 낙찰 업체 리뷰 성향: good | mixed | defect
  mood: "good" | "mixed" | "defect";
};
const PAST: PastJob[] = [
  { code: 1, sigungu: "남구", dong: "봉덕동", trade: "WINDOW", size: 6, bidders: ["contractor@demo.kr", "c09@demo.kr", "c02@demo.kr"], completed: "2025-05-20", mood: "good" },
  { code: 2, sigungu: "북구", dong: "산격동", trade: "EXT_INSULATION", usage: "MULTI_HOUSEHOLD", size: 5, bidders: ["c06@demo.kr", "c02@demo.kr", "c07@demo.kr"], completed: "2025-07-15", mood: "mixed" },
  { code: 3, sigungu: "달서구", dong: "본리동", trade: "BOILER", usage: "MULTIPLEX", size: 5, bidders: ["c05@demo.kr", "c08@demo.kr", "c12@demo.kr"], completed: "2025-09-30", mood: "defect" },
  { code: 4, sigungu: "수성구", dong: "만촌동", trade: "WINDOW", size: 4, bidders: ["c02@demo.kr", "contractor@demo.kr", "c03@demo.kr"], completed: "2025-11-12", mood: "good" },
];

// 시드용 단가 가정 (원). 실제 화면의 예상가 산정은 src/config/pricing.ts(마일스톤 4)에서 관리한다.
function jobAmount(trade: string, b: { windowArea: number; households: number; grossArea: number }, factor: number) {
  const base =
    trade === "WINDOW" ? b.windowArea * 520000
    : trade === "BOILER" ? b.households * 1300000
    : trade === "EXT_INSULATION" ? b.grossArea * 0.9 * 165000
    : b.grossArea * 0.5 * 90000;
  return Math.round((base * factor) / 10000) * 10000;
}

const REVIEW_TEXT: Record<PastJob["mood"], string[]> = {
  good: [
    "창호 바꾸고 첫 겨울인데 외풍이 거의 없어요. 작업자분들이 매일 정리하고 가셨어요.",
    "이웃이랑 같이 하니 혼자 견적 받을 때보다 확실히 저렴했습니다. 일정도 약속대로 끝났어요.",
    "설명을 쉽게 해주셔서 좋았습니다. 결로가 확 줄었어요.",
  ],
  mixed: [
    "단열 효과는 좋은데 공사가 예정보다 일주일 늦어졌어요.",
    "마감은 깔끔한 편인데 분진 때문에 이웃 민원이 좀 있었습니다.",
    "결과물은 만족하지만 중간에 연락이 잘 안 될 때가 있었어요.",
  ],
  defect: [
    "보일러 설치 후 배관에서 물이 새서 연락했는데 처리까지 3주 걸렸어요.",
    "초반엔 친절했는데 하자 접수 후 대응이 너무 느렸습니다.",
    "가격은 괜찮았지만 A/S 요청을 몇 번이나 해야 했어요.",
  ],
};

function reviewFor(mood: PastJob["mood"]) {
  const r = (lo: number, hi: number) => int(lo, hi);
  if (mood === "good")
    return { ratingQuality: r(4, 5), ratingSchedule: r(4, 5), ratingCleanliness: r(4, 5), ratingComm: r(4, 5), ratingAS: r(4, 5), ratingValue: r(4, 5), tags: rand() < 0.15 ? ["NOISE_DUST"] : [] };
  if (mood === "mixed")
    return { ratingQuality: r(3, 5), ratingSchedule: r(2, 4), ratingCleanliness: r(2, 4), ratingComm: r(3, 4), ratingAS: r(3, 5), ratingValue: r(3, 4), tags: sample(["DELAY", "NOISE_DUST", "NO_CONTACT"], int(1, 2)) };
  return { ratingQuality: r(3, 4), ratingSchedule: r(3, 4), ratingCleanliness: r(3, 5), ratingComm: r(2, 3), ratingAS: r(1, 2), ratingValue: r(3, 4), tags: ["DEFECT_DELAY", ...(rand() < 0.4 ? ["NO_CONTACT"] : [])] };
}

async function main() {
  // 초기화 (자식 → 부모 순)
  await db.$transaction([
    db.notification.deleteMany(), db.collusionFlag.deleteMany(), db.config.deleteMany(),
    db.benefit.deleteMany(), db.pQRule.deleteMany(), db.reviewReport.deleteMany(), db.review.deleteMany(),
    db.project.deleteMany(), db.contract.deleteMany(), db.evaluation.deleteMany(), db.bid.deleteMany(),
    db.tenderNomination.deleteMany(), db.tender.deleteMany(), db.compatibilityScore.deleteMany(),
    db.clusterMember.deleteMany(), db.cluster.deleteMany(), db.energyDiagnosis.deleteMany(),
    db.retrofitDemand.deleteMany(), db.building.deleteMany(), db.document.deleteMany(),
    db.contractorRegion.deleteMany(), db.contractorTrade.deleteMany(), db.contractorProfile.deleteMany(),
    db.customerProfile.deleteMany(), db.user.deleteMany(),
  ]);

  const passwordHash = await bcrypt.hash("demo1234", 10);

  await db.user.create({ data: { email: "admin@demo.kr", passwordHash, name: "그린토피아 운영자", role: "ADMIN" } });

  // ── 업체 ──
  const contractorId: Record<string, string> = {};
  for (const [i, c] of CONTRACTORS.entries()) {
    const dist = district(c.office);
    const gr = c.gr ?? true;
    const user = await db.user.create({
      data: {
        email: c.email,
        passwordHash,
        name: personName(),
        phone: `053-${int(200, 999)}-${String(int(0, 9999)).padStart(4, "0")}`,
        role: "CONTRACTOR",
        createdAt: c.status === "PENDING" ? new Date(Date.now() - int(1, 3) * 864e5) : d("2024-11-01"),
      },
    });
    const p = await db.contractorProfile.create({
      data: {
        userId: user.id,
        companyName: c.company,
        ceoName: user.name,
        bizRegNo: `5${String(i + 10).padStart(2, "0")}-8${int(1, 9)}-${String(int(10000, 99999))}`,
        phone: user.phone!,
        officeAddress: `${SIDO} ${c.office} ${pick(dist.dongs).name}`,
        lat: dist.lat,
        lng: dist.lng,
        grRegistered: gr,
        grRegNo: gr ? `GR-대구-${2021 + (i % 4)}-${String(100 + i * 7).padStart(4, "0")}` : null,
        constructionLicense: c.license,
        licenseNo: `대구-${c.office}-${int(1000, 9999)}`,
        warrantyAvailable: c.warranty ?? true,
        techStaffCount: c.staff,
        externalProjectCount: c.external,
        portfolio: `최근 3년 GR 관련 시공 ${c.external}건 (${c.regions.includes("전체") ? "대구 전역" : c.regions.join("·") + " 일대"} 노후주택 위주)`,
        reviewStatus: c.status ?? "APPROVED",
        reviewedAt: c.status === "PENDING" ? null : d("2024-11-05"),
        grade: c.grade,
        trades: { create: c.trades.map((trade) => ({ trade })) },
        regions: { create: c.regions.map((sigungu) => ({ sido: SIDO, sigungu })) },
      },
    });
    contractorId[c.email] = p.id;
    if (gr) {
      await db.document.create({
        data: { ownerId: user.id, contractorId: p.id, kind: "GR_CERT", path: "uploads/sample-gr-cert.pdf", originalName: `${c.company}_GR사업자등록증.pdf`, mimeType: "application/pdf", size: 102400 },
      });
    }
  }

  // ── 건물주 + 건물 100동 ──
  let ownerSeq = 0;
  async function createOwnerWithBuilding(building: ReturnType<typeof makeBuildingData>, opts: { email?: string; name?: string; nickname?: string } = {}) {
    ownerSeq++;
    const user = await db.user.create({
      data: {
        email: opts.email ?? `owner${String(ownerSeq).padStart(3, "0")}@demo.kr`,
        passwordHash,
        name: opts.name ?? personName(),
        phone: `010-${int(2000, 9999)}-${int(1000, 9999)}`,
        role: "CUSTOMER",
        customerProfile: { create: {} },
      },
    });
    const b = await db.building.create({ data: { ...building, ownerId: user.id, nickname: opts.nickname } });
    return { user, building: b };
  }

  // 데모 고객: 대명동 핫스팟 안의 30년 된 다가구
  const demoBuilding = { ...makeBuildingData("남구", "대명동", "MULTI_HOUSEHOLD"), approvalDate: new Date(1994, 4, 12), address: `${SIDO} 남구 대명동 1734-5`, grossArea: 286, floors: 3, households: 5, windowArea: 41, structure: "BRICK" };
  const demo = await createOwnerWithBuilding(demoBuilding, { email: "customer@demo.kr", name: "김그린", nickname: "대명동 우리집" });
  await db.retrofitDemand.create({
    data: { ...makeDemand(["WINDOW", "BOILER"]), symptomsJson: json(["OLD_WINDOW", "COLD_WINTER", "HIGH_BILL"]), jointIntent: "YES", desiredStart: monthsFromNow(3), budgetMin: 1500e4, budgetMax: 3000e4, billElectric: 82000, billGas: 236000, buildingId: demo.building.id },
  });
  let total = 1;

  // 과거 공사 건물 (수요 DONE)
  const pastBuildings: Record<number, { userId: string; id: string; windowArea: number; households: number; grossArea: number }[]> = {};
  for (const job of PAST) {
    pastBuildings[job.code] = [];
    for (let i = 0; i < job.size; i++) {
      const { user, building } = await createOwnerWithBuilding(makeBuildingData(job.sigungu, job.dong, job.usage));
      await db.retrofitDemand.create({ data: { ...makeDemand([job.trade], "DONE"), jointIntent: "YES", desiredStart: d(job.completed), buildingId: building.id } });
      pastBuildings[job.code].push({ userId: user.id, id: building.id, windowArea: building.windowArea!, households: building.households, grossArea: building.grossArea });
      total++;
    }
  }

  // 핫스팟 (데모 고객이 대명동 1동을 차지하므로 대명동은 1 적게)
  for (const h of HOTSPOTS) {
    const n = h.sigungu === "남구" && h.dong === "대명동" ? h.count - 1 : h.count;
    for (let i = 0; i < n; i++) {
      const { building } = await createOwnerWithBuilding(makeBuildingData(h.sigungu, h.dong, h.usage));
      const trades = rand() < 0.75 ? h.trades.slice(0, 1) : h.trades;
      await db.retrofitDemand.create({ data: { ...makeDemand(trades), buildingId: building.id } });
      total++;
    }
  }

  // 나머지: 대구 전역에 흩어진 수요 (일부는 수요 미입력)
  const ALL_TRADES = ["WINDOW", "EXT_INSULATION", "INT_INSULATION", "BOILER", "ROOF"];
  while (total < 100) {
    const dist = weighted(DAEGU_DISTRICTS.map((x) => [x, x.sigungu === "달성군" ? 1 : 3] as [District, number]));
    const dong = pick(dist.dongs);
    const { building } = await createOwnerWithBuilding(makeBuildingData(dist.sigungu, dong.name));
    if (rand() < 0.85) {
      const primary = weighted<string>([["WINDOW", 4], ["BOILER", 3], ["EXT_INSULATION", 2], ["INT_INSULATION", 1], ["ROOF", 1]]);
      const trades = rand() < 0.3 ? [primary, pick(ALL_TRADES.filter((t) => t !== primary))] : [primary];
      await db.retrofitDemand.create({ data: { ...makeDemand(trades), buildingId: building.id } });
    }
    total++;
  }

  // ── 과거 공동공사 체인 ──
  for (const job of PAST) {
    const members = pastBuildings[job.code];
    const dist = district(job.sigungu);
    const dong = dist.dongs.find((x) => x.name === job.dong)!;
    const completed = d(job.completed);
    const started = new Date(completed.getTime() - 45 * 864e5);
    const deadline = new Date(started.getTime() - 30 * 864e5);

    const cluster = await db.cluster.create({
      data: {
        code: job.code, trade: job.trade, status: "COMPLETED", radiusKm: +(0.5 + rand()).toFixed(1), avgScore: int(78, 92),
        centerLat: dong.lat, centerLng: dong.lng, sigungu: job.sigungu,
        reasonsJson: json(["동일 공종", "희망 시기 유사", "거리 가까움", "규모 유사"]),
        createdAt: new Date(deadline.getTime() - 20 * 864e5),
        members: { create: members.map((m) => ({ buildingId: m.id, status: "JOINED", joinedAt: new Date(deadline.getTime() - 14 * 864e5) })) },
      },
    });
    const tender = await db.tender.create({
      data: {
        clusterId: cluster.id, method: "OPEN", recommendedMethod: "OPEN", recommendationReason: "권역 내 자격 업체가 충분하고 일반 난이도 공종이라 공개경쟁이 적합합니다.",
        methodConfirmedAt: new Date(deadline.getTime() - 14 * 864e5), deadline, workStart: started, workEnd: completed,
        status: "AWARDED", createdAt: new Date(deadline.getTime() - 14 * 864e5),
      },
    });

    const factors = [0.84, 0.9, 0.95].map((f) => f + (rand() - 0.5) * 0.04);
    for (const [rank, email] of job.bidders.entries()) {
      const factor = factors[rank];
      const total = members.reduce((s, m) => s + jobAmount(job.trade, m, factor), 0);
      const won = rank === 0;
      const bid = await db.bid.create({
        data: {
          tenderId: tender.id, contractorId: contractorId[email],
          tierPricesJson: json([{ minBuildings: job.size, maxBuildings: job.size + 3, factor }, { minBuildings: Math.max(3, job.size - 2), maxBuildings: job.size - 1, factor: factor * 1.05 }]),
          unitPriceTableJson: json({ basis: "seed" }),
          totalPrice: total, durationDays: int(30, 50), warrantyMonths: pick([24, 36]), asMonths: pick([12, 24]),
          planSummary: "건물별 실측 후 2개 조로 연속 시공", status: won ? "WON" : "LOST", submittedAt: new Date(deadline.getTime() - 2 * 864e5),
        },
      });
      // 종합평가 결과 (시드용 고정 점수. 실제 산식은 마일스톤 6)
      const price = 50 - rank * 3.5, record = 17 - rank, period = 8, warranty = 9 - rank, rep = 7;
      await db.evaluation.create({
        data: { bidId: bid.id, pqPassed: true, pqDetailsJson: json({ license: true, gr: true, warranty: true, sanction: false }), scoresJson: json({ price, record, duration: period, warranty, reputation: rep }), total: price + record + period + warranty + rep, rank: rank + 1 },
      });
      if (!won) continue;

      for (const m of members) {
        const contract = await db.contract.create({
          data: { buildingId: m.id, contractorId: contractorId[email], tenderId: tender.id, bidId: bid.id, amount: jobAmount(job.trade, m, factor), status: "SIGNED", signedAt: new Date(started.getTime() - 7 * 864e5) },
        });
        const project = await db.project.create({
          data: { contractId: contract.id, status: "COMPLETED", plannedEnd: new Date(completed.getTime() - (job.mood === "mixed" ? 7 : 0) * 864e5), startedAt: started, completedAt: completed },
        });
        if (rand() < 0.85) {
          const r = reviewFor(job.mood);
          const { tags, ...ratings } = r;
          await db.review.create({
            data: { projectId: project.id, authorId: m.userId, contractorId: contractorId[email], ...ratings, complaintTagsJson: json(tags), text: pick(REVIEW_TEXT[job.mood]), createdAt: new Date(completed.getTime() + int(3, 20) * 864e5) },
          });
          // 6개월 후속 리뷰 (하자 여부)
          if (Date.now() - completed.getTime() > 183 * 864e5 && rand() < 0.6) {
            const defect = job.mood === "defect" ? rand() < 0.6 : rand() < 0.1;
            await db.review.create({
              data: {
                projectId: project.id, authorId: m.userId, contractorId: contractorId[email], kind: "FOLLOWUP_6M",
                ...ratings, complaintTagsJson: json(defect && job.mood === "defect" ? ["DEFECT_DELAY"] : []),
                defectOccurred: defect, defectResolved: defect ? job.mood !== "defect" : null,
                text: defect ? "6개월 지나 작은 하자가 생겼어요." : "6개월 지났는데 문제 없이 잘 쓰고 있어요.",
                createdAt: new Date(completed.getTime() + 185 * 864e5),
              },
            });
          }
        }
      }
    }
  }

  // ── 평판 점수 (임시: 항목 평균 × 20. 정식 산식은 마일스톤 8) ──
  for (const id of Object.values(contractorId)) {
    const reviews = await db.review.findMany({ where: { contractorId: id } });
    if (!reviews.length) continue;
    const avg = reviews.reduce((s, r) => s + (r.ratingQuality + r.ratingSchedule + r.ratingCleanliness + r.ratingComm + r.ratingAS + r.ratingValue) / 6, 0) / reviews.length;
    await db.contractorProfile.update({ where: { id }, data: { reputationScore: +(avg * 20).toFixed(1) } });
  }

  // ── 기본 PQ 규칙 · 등급 혜택 ──
  await db.pQRule.createMany({
    data: [
      { name: "공종 면허·등록", description: "해당 공종의 건설업 등록·면허 보유", kind: "REQUIRE_LICENSE" },
      { name: "GR 사업자 등록", description: "그린리모델링 사업자 등록 업체", kind: "REQUIRE_GR" },
      { name: "하자보증 가능", description: "하자보증(보증보험) 발급 가능", kind: "REQUIRE_WARRANTY" },
      { name: "행정처분·부실시공 이력 없음", description: "최근 2년 내 행정처분·부실시공 이력 없음", kind: "NO_SANCTION", paramsJson: json({ years: 2 }) },
    ],
  });
  await db.benefit.createMany({
    data: [
      { grade: "GREEN_PARTNER", kind: "NOMINATION_POOL", description: "지명경쟁 지명 풀 포함" },
      { grade: "GREEN_PARTNER", kind: "REPUTATION_BONUS", description: "종합평가 평판 가산점", valueJson: json({ points: 2 }) },
      { grade: "GREEN_PARTNER", kind: "FEE_DISCOUNT", description: "플랫폼 수수료 할인", valueJson: json({ rate: 0.3 }) },
      { grade: "GREEN_PARTNER", kind: "PRIORITY_ALERT", description: "신규 공고 우선 알림" },
      { grade: "GREEN_PARTNER", kind: "BADGE", description: "업체 프로필 그린파트너 배지" },
      { grade: "EXCELLENT", kind: "NOMINATION_POOL", description: "지명경쟁 지명 풀 포함" },
      { grade: "EXCELLENT", kind: "REPUTATION_BONUS", description: "종합평가 평판 가산점", valueJson: json({ points: 1 }) },
      { grade: "EXCELLENT", kind: "FEE_DISCOUNT", description: "플랫폼 수수료 할인", valueJson: json({ rate: 0.15 }) },
      { grade: "EXCELLENT", kind: "PRIORITY_ALERT", description: "신규 공고 우선 알림" },
      { grade: "SPROUT", kind: "PRIORITY_ALERT", description: "새싹 트랙: 소형 Cluster 공개경쟁 우선 노출" },
    ],
  });

  // ── AI 매칭 실행 + 데모 상태 ──
  await runMatching();
  // 데모 고객이 속한 Cluster: 이웃 3동이 먼저 참여 → 데모 고객이 참여하면 입찰 공고 초안이 생긴다
  const demoMember = await db.clusterMember.findFirst({ where: { buildingId: demo.building.id }, include: { cluster: { include: { members: true } } } });
  if (demoMember) {
    const others = demoMember.cluster.members.filter((m) => m.buildingId !== demo.building.id).slice(0, 3);
    for (const m of others) {
      await db.clusterMember.update({ where: { id: m.id }, data: { status: "JOINED", joinedAt: new Date(Date.now() - int(1, 5) * 864e5) } });
      if (m.demandId) await db.retrofitDemand.update({ where: { id: m.demandId }, data: { status: "MATCHED" } });
    }
    await db.cluster.update({ where: { id: demoMember.clusterId }, data: { status: "RECRUITING" } });
  }

  // 진행 중 입찰 공고: Cluster 전원 참여 → 공고 초안 → (일부) 운영자 확정
  async function joinAll(clusterId: string) {
    const members = await db.clusterMember.findMany({ where: { clusterId } });
    for (const m of members) {
      await db.clusterMember.update({ where: { id: m.id }, data: { status: "JOINED", joinedAt: new Date(Date.now() - int(3, 9) * 864e5) } });
      if (m.demandId) await db.retrofitDemand.update({ where: { id: m.demandId }, data: { status: "MATCHED" } });
    }
    await db.cluster.update({ where: { id: clusterId }, data: { status: "RECRUITING" } });
  }
  async function seedBid(tenderId: string, email: string, factor: number, durationDays: number, warrantyMonths: number) {
    const t = await db.tender.findUniqueOrThrow({ where: { id: tenderId }, include: { cluster: { include: { members: { where: { status: "JOINED" } } } } } });
    const tp = PRICING_DEFAULTS.trades[t.cluster.trade];
    const mid = (tp.unitPrice.low + tp.unitPrice.high) / 2;
    const table = Object.fromEntries(tp.types.map((x) => [x.code, Math.round((mid * factor * x.factor) / 1000) * 1000]));
    const ranges = tierRanges(t.cluster.members.length, MATCHING_DEFAULTS.minClusterSize, BIDDING_DEFAULTS.tierUpperShare, BIDDING_DEFAULTS.tierExtra);
    const tiers = ranges.map((r, i) => ({ ...r, adjustPct: i === 0 ? 0 : 5 }));
    const members = t.cluster.members.map((m, i) => {
      const q = JSON.parse(m.quantityJson ?? "{}")[t.cluster.trade];
      return { memberId: m.id, label: `${i + 1}번 건물`, amount: q.amount, mix: q.mix, unit: q.unit };
    });
    await db.bid.create({
      data: {
        tenderId, contractorId: contractorId[email], tierPricesJson: json(tiers), unitPriceTableJson: json(table),
        totalPrice: bidTotal(members, table, tiers).total, durationDays, warrantyMonths, asMonths: 12,
        staffPlan: "시공 2개 조(5명), 운반 차량 1대", planSummary: "1주차 실측 후 근거리 순서로 하루 1동씩 연속 시공, 마지막 주 일괄 점검",
        status: "SUBMITTED", submittedAt: new Date(Date.now() - int(1, 2) * 864e5),
      },
    });
  }
  const proposed = await db.cluster.findMany({ where: { status: "PROPOSED" }, include: { members: true } });
  const findCluster = (trade: string, sigungu: string) => proposed.find((c) => c.trade === trade && c.sigungu === sigungu);
  const windowWest = findCluster("WINDOW", "서구");
  if (windowWest) {
    await joinAll(windowWest.id);
    const t = await createTenderDraft(windowWest.id);
    await confirmTender(t.id, t.method);
    await seedBid(t.id, "c04@demo.kr", 0.93, 30, 24);
    await seedBid(t.id, "c11@demo.kr", 0.88, 35, 24);
  }
  const boiler = proposed.filter((c) => c.trade === "BOILER").sort((a, b) => b.members.length - a.members.length)[0];
  if (boiler) {
    await joinAll(boiler.id);
    const t = await createTenderDraft(boiler.id);
    await confirmTender(t.id, t.method);
    await seedBid(t.id, "c05@demo.kr", 0.8, 20, 24);
  }
  const ext = findCluster("EXT_INSULATION", "북구");
  if (ext) {
    await joinAll(ext.id);
    await createTenderDraft(ext.id); // 운영자 확정 대기 (DRAFT)
  }

  const counts = {
    users: await db.user.count(),
    buildings: await db.building.count(),
    activeDemands: await db.retrofitDemand.count({ where: { status: "ACTIVE" } }),
    contractors: await db.contractorProfile.count(),
    clusters: await db.cluster.count(),
    proposedClusters: await db.cluster.count({ where: { status: { in: ["PROPOSED", "RECRUITING"] } } }),
    tenders: await db.tender.groupBy({ by: ["status"], _count: true }),
    openBids: await db.bid.count({ where: { status: "SUBMITTED" } }),
    contracts: await db.contract.count(),
    reviews: await db.review.count(),
  };
  console.log("✅ 시드 완료", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
