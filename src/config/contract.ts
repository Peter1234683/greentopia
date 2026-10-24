// 계약 요약 · 단계별 지급 · 준공 검측 설정값 (F9·F10).
// ⚠️ 지급 비율·지체상금률·교차검증 기준은 가정치다. 실제 계약 조건은 계약서 원문을 따른다.
// 실제 돈 이동은 구현하지 않는다 (상태 관리와 기록만, 제휴 금융기관 연동 예정 — README 규제 메모 참고).

export const CONTRACT_DEFAULTS = {
  stages: [
    { code: "DEPOSIT", label: "착공금", ratio: 0.3, condition: "계약 서명 후, 건물주 승인 시" },
    { code: "INTERIM", label: "중도금", ratio: 0.4, condition: "자재 입고 보고 → 건물주 검수 승인 시" },
    { code: "COMPLETION", label: "준공금", ratio: 0.25, condition: "준공 검측을 건물주가 승인한 뒤" },
    { code: "RETENTION", label: "A/S 유보금", ratio: 0.05, condition: "준공 후 90일 보류 · 처리 안 된 A/S가 없을 때" },
  ],
  retentionDays: 90,
  // 지체상금: 지연 1일당 계약금액의 ratePerDayPermil/1000, 상한 maxRatio (가정치)
  delayPenalty: { ratePerDayPermil: 0.5, maxRatio: 0.1 },
  // 준공 검측 교차 검증: 같은 묶음 이웃 세대 통과율 중앙값보다 이만큼 낮으면 표시
  crossCheckGap: 0.25,
  standardContractLabel: "민간건설공사 표준도급계약서(국토교통부) 기반 요약 (데모)",
  escrowNote: "결제·에스크로는 제휴 금융기관 연동 예정이에요 (데모). 지금은 단계별 승인 기록만 남고 실제 돈은 이동하지 않아요.",
  // 공종별 준공 검측 체크리스트 (계약 규격 항목은 입찰 단가표 유형에서 자동 추가)
  checklist: {
    WINDOW: ["창틀 주변 실링(코킹) 마감이 빈틈없음", "창 개폐·잠금이 부드럽게 작동", "유리·프레임 인증 라벨 부착", "기존 창틀 철거 잔재 정리"],
    EXT_INSULATION: ["단열재가 빈틈없이 이어 붙음", "창 주변·배관 관통부 마감", "마감재 균열·들뜸 없음", "비계 철거 후 주변 정리"],
    INT_INSULATION: ["단열재 이음부 틈 없음", "벽 모서리·천장 접합부 마감", "마감 도배·도장 상태 양호", "콘센트·스위치 원위치 복구"],
    BOILER: ["배기 연통 연결·고정 상태", "가스 누설 점검 기록", "난방·온수 정상 작동", "인증 라벨·설치 확인서"],
    ROOF: ["방수층 들뜸·균열 없음", "단열재 시공 범위가 계약대로", "배수구 주변 마감", "자재 잔재 정리"],
  } as Record<string, string[]>,
};
export type ContractSettings = typeof CONTRACT_DEFAULTS;
