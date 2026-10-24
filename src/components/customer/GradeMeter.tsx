import { GRADE_BANDS } from "@/config/diagnosis";
import type { DiagnosisResult } from "@/lib/diagnosis/types";

// 간이 등급 띠: A(좋음) → E(개선 시급). 우리 집 범위와 같은 연식·유형 평균을 함께 표시한다.
const SCALE_MIN = 60;
const SCALE_MAX = 320;
const pos = (v: number) => `${Math.min(100, Math.max(0, ((v - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100))}%`;
// 한 가지 색상(초록)의 밝기 단계 — 등급 순서를 밝기로 보여주고 글자로도 표기한다
const BAND_COLORS = ["#1a6347", "#3f8a68", "#7bb79a", "#b7dccb", "#e3f1ea"];

export function GradeMeter({ result }: { result: DiagnosisResult }) {
  const { intensity, peer, grade } = result;
  const isRange = intensity.low !== intensity.high;
  const segments = GRADE_BANDS.map((b, i) => {
    const start = i === 0 ? SCALE_MIN : GRADE_BANDS[i - 1].max;
    const end = Math.min(b.max, SCALE_MAX);
    return { ...b, left: pos(start), width: `calc(${pos(end)} - ${pos(start)})`, color: BAND_COLORS[i] };
  });

  return (
    <div>
      <div className="flex items-end gap-4">
        <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-3xl bg-forest-900 text-white">
          <span className="text-4xl font-extrabold leading-none">{grade.grade}</span>
          <span className="mt-1 text-[0.65rem] text-mint-300">간이 등급</span>
        </div>
        <div>
          <p className="text-lg font-bold">{grade.label}</p>
          <p className="text-sm text-muted">
            연간 냉난방 에너지 ㎡당{" "}
            <b className="text-ink tabular-nums">{isRange ? `${intensity.low}~${intensity.high}` : intensity.mid}kWh</b>
          </p>
        </div>
      </div>

      <div className="relative mt-8 mb-6" role="img" aria-label={`간이 등급 ${grade.grade}, ㎡당 ${intensity.mid}kWh${peer ? `, 같은 연식·유형 평균 ${peer.intensity}kWh` : ""}`}>
        {/* 우리 집 범위 */}
        <div className="absolute -top-6 flex -translate-x-1/2 flex-col items-center" style={{ left: pos(intensity.mid) }}>
          <span className="whitespace-nowrap rounded-full bg-ink px-2 py-0.5 text-[0.7rem] font-bold text-white">우리 집</span>
          <span className="h-0 w-0 border-x-4 border-t-4 border-x-transparent border-t-ink" />
        </div>
        <div className="relative h-4 overflow-hidden rounded-full">
          {segments.map((s) => (
            <span key={s.grade} className="absolute inset-y-0 border-r-2 border-white" style={{ left: s.left, width: s.width, background: s.color }} />
          ))}
          {peer && <span className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-muted" style={{ left: pos(peer.intensity) }} />}
          {isRange && (
            <span
              className="absolute inset-y-0 rounded-full ring-2 ring-ink"
              style={{ left: pos(intensity.low), width: `calc(${pos(intensity.high)} - ${pos(intensity.low)})` }}
            />
          )}
        </div>
        <div className="relative mt-1 h-4 text-[0.7rem] text-muted">
          {segments.map((s) => (
            <span key={s.grade} className="absolute text-center font-semibold" style={{ left: s.left, width: s.width }}>{s.grade}</span>
          ))}
        </div>
        {peer && (
          <div className="relative h-5">
            <div className="absolute flex -translate-x-1/2 items-center gap-0.5" style={{ left: pos(peer.intensity) }}>
              <span className="h-0 w-0 border-x-4 border-b-[6px] border-x-transparent border-b-muted" />
              <span className="whitespace-nowrap text-[0.7rem] font-semibold text-muted">평균</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
