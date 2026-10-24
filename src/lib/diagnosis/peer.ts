import "server-only";
import { db } from "@/lib/db";
import { AGE_BANDS, PEER_MIN_SAMPLE } from "@/config/diagnosis";
import { USAGE_LABEL } from "@/lib/constants";
import { ageBandIndex, estimateIntensity } from "./engine";
import type { BuildingForDiagnosis, DiagnosisResult } from "./types";

// 같은 연식 구간·같은 집 유형의 등록 건물 평균 (간이 추정 기준). 표본이 적으면 설정 기준값.
export async function peerAverage(b: BuildingForDiagnosis & { id?: string }): Promise<DiagnosisResult["peer"]> {
  const idx = ageBandIndex(b.approvalDate);
  const band = AGE_BANDS[idx];
  const fromYear = idx === 0 ? 1900 : AGE_BANDS[idx - 1].until + 1;
  const label = `${band.label} ${USAGE_LABEL[b.usage] ?? ""}`.trim();

  const peers = b.approvalDate
    ? await db.building.findMany({
        where: {
          usage: b.usage,
          id: b.id ? { not: b.id } : undefined,
          approvalDate: { gte: new Date(fromYear, 0, 1), lt: new Date(Math.min(band.until, 3000) + 1, 0, 1) },
        },
        include: { demands: { orderBy: { createdAt: "desc" }, take: 1 } },
      })
    : [];

  if (peers.length < PEER_MIN_SAMPLE) {
    const mid = estimateIntensity({ ...b, structure: "RC" }).model;
    return { intensity: Math.round(mid), sampleSize: 0, basis: "CONFIG", label };
  }
  const sum = peers.reduce((s, p) => {
    const dm = p.demands[0];
    return s + estimateIntensity(p, dm ? { electric: dm.billElectric, gas: dm.billGas } : null).mid;
  }, 0);
  return { intensity: Math.round(sum / peers.length), sampleSize: peers.length, basis: "DB", label };
}
