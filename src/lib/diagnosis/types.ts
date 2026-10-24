// 에너지 진단 결과 공통 형식 (EnergyDiagnosis.resultJson 에 저장)

export type Range = { low: number; mid: number; high: number };
export type DiagnosisMode = "SIMPLE" | "GRAI_LINK" | "GRAI_API";

export type MeasureResult = {
  trade: string; // WINDOW ... 또는 COMBINED
  pct: { low: number; high: number }; // 냉난방 에너지 절감률 (0~1)
  kwh: { low: number; high: number }; // 연간 절감량
  won: { low: number; high: number }; // 연간 절감액
};

export type DiagnosisResult = {
  version: string;
  mode: DiagnosisMode;
  grossArea: number;
  intensity: Range; // kWh/㎡·년
  annualKwh: Range;
  annualCostWon: Range;
  grade: { grade: string; label: string };
  peer: { intensity: number; sampleSize: number; basis: "DB" | "CONFIG"; label: string } | null;
  measures: MeasureResult[];
  combined: (MeasureResult & { trades: string[] }) | null;
  precise: { recommended: boolean; reasons: string[] };
  calibratedWithBills: boolean;
  notes: string[];
};

export type BuildingForDiagnosis = {
  approvalDate: Date | null;
  usage: string;
  structure: string;
  grossArea: number;
  households: number;
};

export type Bills = { electric: number | null; gas: number | null };
