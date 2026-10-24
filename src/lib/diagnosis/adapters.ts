import "server-only";
import { GRAI_URL } from "@/config/diagnosis";
import { diagnoseFromGrai, diagnoseSimple, type GraiInput } from "./engine";
import type { Bills, BuildingForDiagnosis, DiagnosisMode, DiagnosisResult } from "./types";

/**
 * 에너지 진단 어댑터 — 3가지 모드
 *  1) SIMPLE     : 자체 규칙 기반 간이 진단 (기본)
 *  2) GRAI_LINK  : GR-AI 웹을 새 창으로 열고, 사용자가 결과(kWh)를 입력·첨부
 *  3) GRAI_API   : GR-AI 측과 API 협의 후 연동할 자리. 스크래핑은 하지 않는다.
 */
export type DiagnosisContext = {
  building: BuildingForDiagnosis;
  demandTrades: string[];
  peer: DiagnosisResult["peer"];
};

export interface EnergyDiagnosisAdapter<Input> {
  readonly mode: DiagnosisMode;
  readonly sourceLabel: string;
  diagnose(ctx: DiagnosisContext, input: Input): Promise<DiagnosisResult>;
}

export const simpleAdapter: EnergyDiagnosisAdapter<{ bills: Bills | null }> = {
  mode: "SIMPLE",
  sourceLabel: "간이 추정 (그린토피아 규칙 v1)",
  async diagnose(ctx, input) {
    return diagnoseSimple(ctx.building, input.bills, ctx.demandTrades, ctx.peer);
  },
};

export const graiLinkAdapter: EnergyDiagnosisAdapter<GraiInput> & { launchUrl(): string } = {
  mode: "GRAI_LINK",
  sourceLabel: "GR-AI 시뮬레이션 (사용자 입력)",
  launchUrl: () => GRAI_URL,
  async diagnose(ctx, input) {
    return diagnoseFromGrai(ctx.building, input, ctx.demandTrades, ctx.peer);
  },
};

/**
 * TODO(GR-AI API 협의 후):
 *  - 인증 방식·엔드포인트·요청 형식(외벽/지붕/창호 열관류율, 냉난방 COP, 보일러 효율 등) 확정
 *  - 건물 정보 → GR-AI 입력 변환, 응답의 시나리오별 에너지 소요량 → GraiInput 으로 변환 후 diagnoseFromGrai 재사용
 *  - 키: process.env.GRAI_API_KEY
 */
export const graiApiAdapter: EnergyDiagnosisAdapter<{ buildingId: string }> = {
  mode: "GRAI_API",
  sourceLabel: "GR-AI API",
  async diagnose() {
    throw new Error("GR-AI API 연동은 아직 준비되지 않았어요.");
  },
};
