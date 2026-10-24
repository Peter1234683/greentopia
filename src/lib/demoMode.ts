import "server-only";
import { cookies } from "next/headers";
import { db } from "./db";
import { demoToolsEnabled } from "./demo";

export const DEMO_COOKIE = "gt_demo";
export const DEMO_ACCOUNTS = { CUSTOMER: "customer@demo.kr", CONTRACTOR: "contractor@demo.kr", ADMIN: "admin@demo.kr" } as const;
export type DemoRole = keyof typeof DEMO_ACCOUNTS;

// 헤더 데모 메뉴: 데모 도구가 켜져 있고, 운영자이거나 ?demo=1 로 들어온 경우만
export async function demoMenuVisible(role?: string) {
  if (!demoToolsEnabled()) return false;
  return role === "ADMIN" || (await cookies()).get(DEMO_COOKIE)?.value === "1";
}

export type ScenarioStep = { n: number; title: string; desc: string; role: DemoRole | "OWNER"; email?: string; to: string };

// 시연 시나리오: 각 단계로 바로 이동 (해당 역할로 자동 로그인)
export async function scenarioSteps(): Promise<ScenarioStep[]> {
  const demoBuilding = await db.building.findFirst({ where: { owner: { email: DEMO_ACCOUNTS.CUSTOMER } }, orderBy: { createdAt: "asc" } });
  const tender = await db.tender.findFirst({ where: { status: { in: ["OPEN", "EVALUATING", "AWARDED"] }, cluster: { trade: "WINDOW" } }, orderBy: { createdAt: "desc" } });
  // 계약·지급·검측·리뷰 단계는 시드의 완료된 과거 공사(창호)를 보여준다
  const paid = await db.contract.findFirst({
    where: { status: "SIGNED", project: { status: "COMPLETED", inspection: { isNot: null } }, tender: { cluster: { trade: "WINDOW" } } },
    include: { building: { include: { owner: true } } },
    orderBy: { createdAt: "asc" },
  });
  const toReview = await db.contract.findFirst({
    where: { status: "SIGNED", project: { status: "COMPLETED", reviews: { none: { kind: "INITIAL" } } } },
    include: { building: { include: { owner: true } } },
  });
  const b = demoBuilding?.id ?? "";
  return [
    { n: 1, title: "고객 진단 (사진)", desc: "사진으로 부위별 상태와 추천 공사를 확인", role: "CUSTOMER", to: b ? `/customer/buildings/${b}/photo` : "/customer/diagnosis" },
    { n: 2, title: "숨은 지원금 확인", desc: "지원금 DB 대조 · 우대 조건 · 계산기", role: "CUSTOMER", to: "/customer/subsidy" },
    { n: 3, title: "이웃 묶음", desc: "AI 매칭 결과 · 왜 묶였는지 · 이웃 초대", role: "CUSTOMER", to: "/customer/joint" },
    { n: 4, title: "업체 입찰", desc: "공고 지도 · 입찰서 작성", role: "CONTRACTOR", to: "/contractor/tenders" },
    { n: 5, title: "종합평가 낙찰", desc: "마감 → 종합평가 → 낙찰", role: "ADMIN", to: tender ? `/admin/tenders/${tender.id}` : "/admin/tenders" },
    { n: 6, title: "계약 · 단계별 지급", desc: "계약 요약서 · 30/40/25/5 승인 기록", role: "OWNER", email: paid?.building.owner.email, to: paid ? `/customer/contracts/${paid.id}` : "/customer/projects" },
    { n: 7, title: "준공 검측", desc: "전/후 비교 · 규격 체크리스트 · 이웃 교차 검증", role: "OWNER", email: paid?.building.owner.email, to: paid ? `/customer/contracts/${paid.id}/inspection` : "/customer/projects" },
    { n: 8, title: "리뷰", desc: "항목별 별점 · 불만 태그", role: "OWNER", email: toReview?.building.owner.email, to: toReview ? `/customer/reviews/new?contract=${toReview.id}` : "/customer/projects" },
    { n: 9, title: "평판 반영", desc: "업체 평판 점수 · 등급 · 안심 보장제", role: "CONTRACTOR", to: "/contractor/company" },
  ];
}
