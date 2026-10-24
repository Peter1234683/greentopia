// DB에는 문자열로 저장되는 코드값과 화면 표시용 한국어 라벨.

export const ROLES = ["CUSTOMER", "CONTRACTOR", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_HOME: Record<Role, string> = {
  CUSTOMER: "/customer",
  CONTRACTOR: "/contractor",
  ADMIN: "/admin",
};

export const TRADES = ["WINDOW", "EXT_INSULATION", "INT_INSULATION", "BOILER", "ROOF"] as const;
export type Trade = (typeof TRADES)[number];

export const TRADE_LABEL: Record<Trade, string> = {
  WINDOW: "창호",
  EXT_INSULATION: "외단열",
  INT_INSULATION: "내단열",
  BOILER: "보일러",
  ROOF: "지붕",
};

// 비전문가용 한 줄 설명
export const TRADE_DESC: Record<Trade, string> = {
  WINDOW: "오래된 창을 단열 성능이 좋은 창으로 바꿔 외풍·결로를 줄여요.",
  EXT_INSULATION: "건물 바깥 벽에 단열재를 덧대 집 전체를 감싸요.",
  INT_INSULATION: "방 안쪽 벽에 단열재를 보강해요. 세대별로 할 수 있어요.",
  BOILER: "효율 좋은 콘덴싱 보일러로 바꿔 가스비를 줄여요.",
  ROOF: "지붕·옥상에 단열을 보강해 꼭대기 층 더위·추위를 줄여요.",
};

export const USAGE_LABEL: Record<string, string> = {
  DETACHED: "단독주택",
  MULTI_HOUSEHOLD: "다가구주택",
  MULTIPLEX: "다세대주택",
};

export const STRUCTURE_LABEL: Record<string, string> = {
  RC: "철근콘크리트",
  MASONRY: "조적조",
  BRICK: "연와조",
  WOOD: "목조",
  STEEL: "철골조",
  OTHER: "기타",
};

// 생활 언어 질문 → 공사 수요 태그 (4-1)
export const SYMPTOMS = [
  { code: "OLD_WINDOW", label: "창호가 오래되었다", trades: ["WINDOW"] },
  { code: "COLD_WINTER", label: "겨울철 실내가 춥다", trades: ["WINDOW", "INT_INSULATION", "EXT_INSULATION"] },
  { code: "HIGH_BILL", label: "냉난방비가 많이 나온다", trades: ["WINDOW", "EXT_INSULATION", "BOILER"] },
  { code: "BOILER", label: "보일러 교체를 고민 중이다", trades: ["BOILER"] },
  { code: "ROOF_LEAK", label: "꼭대기 층이 여름에 덥고 겨울에 춥다", trades: ["ROOF"] },
] as const satisfies readonly { code: string; label: string; trades: readonly Trade[] }[];

export const JOINT_INTENT_LABEL: Record<string, string> = {
  YES: "이웃과 함께 공사할래요",
  MAYBE: "조건이 맞으면 고려할게요",
  NO: "혼자 진행할래요",
};

export const GRADES = ["SPROUT", "STANDARD", "EXCELLENT", "GREEN_PARTNER"] as const;
export type Grade = (typeof GRADES)[number];

export const GRADE_LABEL: Record<Grade, string> = {
  SPROUT: "새싹",
  STANDARD: "일반",
  EXCELLENT: "우수",
  GREEN_PARTNER: "그린파트너",
};

export const CONTRACTOR_REVIEW_STATUS_LABEL: Record<string, string> = {
  PENDING: "심사 대기",
  APPROVED: "승인",
  REJECTED: "반려",
};

export const TENDER_METHOD_LABEL: Record<string, string> = {
  OPEN: "공개경쟁",
  RESTRICTED: "제한경쟁",
  NOMINATED: "지명경쟁",
  NEGOTIATED: "수의계약",
};

export const TENDER_STATUS_LABEL: Record<string, string> = {
  DRAFT: "확정 대기",
  OPEN: "공고 중",
  EVALUATING: "평가 중",
  AWARDED: "낙찰",
  FAILED: "유찰",
  CANCELLED: "취소",
};

export const CONTRACT_STATUS_LABEL: Record<string, string> = {
  PENDING: "참여 결정 대기",
  CONFIRMED: "현장확인 대기",
  READY: "서명 대기",
  SIGNED: "계약 완료",
  CANCELLED: "참여 안 함",
};

export const PROJECT_STATUS_LABEL: Record<string, string> = {
  SITE_CHECK: "현장확인",
  CONTRACTED: "계약 완료 · 착공 대기",
  IN_PROGRESS: "시공 중",
  COMPLETED: "완료",
  AS: "A/S",
};

export const COMPLAINT_TAGS = [
  { code: "DELAY", label: "일정 지연" },
  { code: "EXTRA_COST", label: "추가비용 요구" },
  { code: "POOR_FINISH", label: "마감 불량" },
  { code: "NOISE_DUST", label: "소음·분진 관리 미흡" },
  { code: "NO_CONTACT", label: "연락 두절" },
  { code: "DEFECT_DELAY", label: "하자 처리 지연" },
  { code: "SAFETY", label: "안전관리 미흡" },
] as const;

export const PROJECT_STAGES = [
  { code: "MATCHING", label: "매칭" },
  { code: "TENDERING", label: "입찰 중" },
  { code: "AWARDED", label: "낙찰" },
  { code: "SITE_CHECK", label: "현장확인" },
  { code: "CONTRACTED", label: "계약" },
  { code: "IN_PROGRESS", label: "시공 중" },
  { code: "COMPLETED", label: "완료" },
  { code: "AS", label: "A/S" },
] as const;

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

// ── 지원금 (F1) ──
export const BENEFICIARY_TYPES = [
  { code: "NEWLYWED", label: "신혼부부" },
  { code: "MULTI_CHILD", label: "다자녀" },
  { code: "SENIOR", label: "고령자" },
  { code: "LOW_INCOME", label: "차상위" },
  { code: "VETERAN", label: "국가유공자" },
] as const;

export const SUBSIDY_STATUS_LABEL: Record<string, string> = { ACTIVE: "진행 중", CLOSED: "마감", UNVERIFIED: "검증 필요" };

// ── 커뮤니티 (F2·F3) ──
export const OWNER_CATEGORIES = [
  { code: "TIP", label: "시공 노하우&팁", icon: "💡" },
  { code: "REVIEW", label: "시공 전·후 후기", icon: "📸" },
  { code: "SUBSIDY", label: "지원금 꿀팁", icon: "💰" },
  { code: "QNA", label: "우리동네 Q&A", icon: "❓" },
  { code: "RECRUIT", label: "이웃 모집&공동구매", icon: "🤝" },
  { code: "NOTICE", label: "공지", icon: "📢" },
] as const;

export const CONTRACTOR_CATEGORIES = [
  { code: "TECH", label: "시공 기술·공법", icon: "🛠️" },
  { code: "MATERIAL", label: "자재·단가 정보", icon: "📦" },
  { code: "PAPERWORK", label: "지원사업·서류 실무", icon: "📋" },
  { code: "SAFETY", label: "안전·하자 사례", icon: "⚠️" },
  { code: "HIRING", label: "협력·하도급 구인", icon: "🤝" },
  { code: "NOTICE", label: "플랫폼 공지", icon: "📢" },
] as const;

// ── 사진 진단 (F4) ──
export const PHOTO_PARTS = [
  { code: "WINDOW", label: "창호" },
  { code: "WALL", label: "벽체" },
  { code: "CEILING", label: "천장" },
  { code: "ROOF", label: "지붕·옥상" },
  { code: "BOILER", label: "보일러" },
  { code: "OTHER", label: "기타" },
] as const;

// ── 안심 보장제 (F11) ──
export const SAFETY_PLEDGE_ITEMS = [
  { code: "NO_EXTRA_COST", label: "계약 외 추가비용 요구 금지" },
  { code: "DELAY_PENALTY", label: "일정 지연 시 지체상금 지급" },
  { code: "REDO_POOR_FINISH", label: "마감 불량 시 재시공" },
] as const;
