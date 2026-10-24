// 고객 '내 공사' 타임라인 단계 계산 (순수 함수)
import { PROJECT_STAGES } from "./constants";

export type StageInput = {
  clusterStatus: string;
  tenderStatus: string | null;
  contractStatus: string | null;
  projectStatus: string | null;
};

export function stageIndex(s: StageInput) {
  const idx = (code: string) => PROJECT_STAGES.findIndex((x) => x.code === code);
  if (s.projectStatus === "AS") return idx("AS");
  if (s.projectStatus === "COMPLETED") return idx("COMPLETED");
  if (s.projectStatus === "IN_PROGRESS") return idx("IN_PROGRESS");
  if (s.contractStatus === "SIGNED") return idx("CONTRACTED");
  if (s.contractStatus === "CONFIRMED" || s.contractStatus === "READY") return idx("SITE_CHECK");
  if (s.contractStatus === "PENDING") return idx("AWARDED");
  if (s.tenderStatus === "OPEN" || s.tenderStatus === "EVALUATING") return idx("TENDERING");
  return idx("MATCHING");
}
