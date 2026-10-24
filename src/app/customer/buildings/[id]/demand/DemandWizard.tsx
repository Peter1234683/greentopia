"use client";

import { useActionState, useMemo, useState } from "react";
import { saveDemand } from "@/app/actions/building";
import { Button, Field, Input, inputClass } from "@/components/ui";
import {
  JOINT_INTENT_LABEL,
  SYMPTOMS,
  TRADES,
  TRADE_DESC,
  TRADE_LABEL,
  type Trade,
} from "@/lib/constants";
import { won } from "@/lib/format";

export type DemandInitial = {
  symptoms: string[];
  trades: Trade[];
  desiredStart: string; // YYYY-MM
  budget: string;
  jointIntent: string;
  billElectric: string;
  billGas: string;
};

type Option = { value: string; label: string };

const STEPS = ["불편한 점", "필요한 공사", "시기·예산", "관리비", "확인"];

function tradesFor(symptoms: string[]): Trade[] {
  const set = new Set<Trade>();
  for (const s of SYMPTOMS)
    if (symptoms.includes(s.code)) s.trades.forEach((t) => set.add(t));
  return TRADES.filter((t) => set.has(t));
}

function ChoiceCard({
  checked,
  onClick,
  title,
  desc,
  type = "checkbox",
}: {
  checked: boolean;
  onClick: () => void;
  title: string;
  desc?: string;
  type?: "checkbox" | "radio";
}) {
  return (
    <button
      type="button"
      role={type}
      aria-checked={checked}
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-2xl p-4 text-left ring-1 transition ${
        checked
          ? "bg-mint-50 ring-2 ring-forest-700"
          : "bg-white ring-line hover:bg-mint-50/50"
      }`}
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center ${type === "radio" ? "rounded-full" : "rounded-md"} border-2 ${
          checked
            ? "border-forest-700 bg-forest-700 text-white"
            : "border-gray-300 bg-white"
        }`}
      >
        {checked && "✓"}
      </span>
      <span>
        <span className="block font-semibold">{title}</span>
        {desc && (
          <span className="mt-0.5 block text-sm text-muted">{desc}</span>
        )}
      </span>
    </button>
  );
}

export function DemandWizard({
  buildingId,
  initial,
  months,
  budgets,
}: {
  buildingId: string;
  initial: DemandInitial;
  months: Option[];
  budgets: Option[];
}) {
  const [state, action, pending] = useActionState(saveDemand, undefined);
  const [step, setStep] = useState(0);
  const [symptoms, setSymptoms] = useState<string[]>(initial.symptoms);
  const [trades, setTrades] = useState<Trade[]>(initial.trades);
  const [tradesTouched, setTradesTouched] = useState(initial.trades.length > 0);
  const [desiredStart, setDesiredStart] = useState(initial.desiredStart);
  const [budget, setBudget] = useState(initial.budget);
  const [jointIntent, setJointIntent] = useState(initial.jointIntent);
  const [billElectric, setBillElectric] = useState(initial.billElectric);
  const [billGas, setBillGas] = useState(initial.billGas);
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const e = state?.errors ?? {};

  const suggested = useMemo(() => tradesFor(symptoms), [symptoms]);

  function toggleSymptom(code: string) {
    const next = symptoms.includes(code)
      ? symptoms.filter((s) => s !== code)
      : [...symptoms, code];
    setSymptoms(next);
    if (!tradesTouched) setTrades(tradesFor(next));
  }
  function toggleTrade(t: Trade) {
    setTradesTouched(true);
    setTrades((cur) =>
      cur.includes(t)
        ? cur.filter((x) => x !== t)
        : TRADES.filter((x) => x === t || cur.includes(x)),
    );
  }

  function next() {
    setLocalError(null);
    if (step === 1 && trades.length === 0)
      return setLocalError(
        "필요한 공사를 하나 이상 골라주세요. 잘 모르겠다면 가장 가까운 것을 골라도 괜찮아요.",
      );
    if (step === 2 && (!desiredStart || !budget || !jointIntent))
      return setLocalError("시기·예산·공동공사 의향을 모두 골라주세요.");
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0 });
  }

  const serverErrors = Object.values(e);

  return (
    <form action={action} noValidate>
      <input type="hidden" name="buildingId" value={buildingId} />
      {symptoms.map((s) => (
        <input key={s} type="hidden" name="symptoms" value={s} />
      ))}
      {trades.map((t) => (
        <input key={t} type="hidden" name="trades" value={t} />
      ))}
      <input type="hidden" name="desiredStart" value={desiredStart} />
      <input type="hidden" name="budget" value={budget} />
      <input type="hidden" name="jointIntent" value={jointIntent} />

      {/* 진행 표시 */}
      <ol className="mb-6 flex gap-1.5" aria-label="진행 단계">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1">
            <span
              className={`block h-1.5 rounded-full ${i <= step ? "bg-forest-700" : "bg-line"}`}
            />
            <span
              className={`mt-1 block text-center text-[0.65rem] ${i === step ? "font-bold text-forest-800" : "text-muted"}`}
            >
              {s}
            </span>
          </li>
        ))}
      </ol>

      <section hidden={step !== 0} className="space-y-3">
        <h2 className="text-xl font-extrabold">
          요즘 우리 집, 이런 점이 불편하세요?
        </h2>
        <p className="text-sm text-muted">해당하는 것을 모두 골라주세요.</p>
        {SYMPTOMS.map((s) => (
          <ChoiceCard
            key={s.code}
            checked={symptoms.includes(s.code)}
            onClick={() => toggleSymptom(s.code)}
            title={s.label}
          />
        ))}
      </section>

      <section hidden={step !== 1} className="space-y-3">
        <h2 className="text-xl font-extrabold">
          이런 공사가 도움이 될 것 같아요
        </h2>
        <p className="text-sm text-muted">
          {suggested.length
            ? "고르신 불편함을 바탕으로 미리 골라뒀어요. 자유롭게 바꿀 수 있어요."
            : "필요한 공사를 골라주세요."}
        </p>
        {TRADES.map((t) => (
          <ChoiceCard
            key={t}
            checked={trades.includes(t)}
            onClick={() => toggleTrade(t)}
            title={`${TRADE_LABEL[t]}${suggested.includes(t) ? " · 추천" : ""}`}
            desc={TRADE_DESC[t]}
          />
        ))}
        <p className="text-xs text-muted">
          정확한 공사 범위는 에너지 진단과 현장 확인 후에 정해져요.
        </p>
      </section>

      <section hidden={step !== 2} className="space-y-6">
        <div>
          <h2 className="text-xl font-extrabold">
            언제쯤, 얼마 정도로 생각하세요?
          </h2>
          <p className="mt-1 text-sm text-muted">
            이웃과 묶을 때 비슷한 시기의 집끼리 모아요.
          </p>
        </div>
        <Field label="희망 공사 시작 시기" required>
          <select
            value={desiredStart}
            onChange={(ev) => setDesiredStart(ev.target.value)}
            className={inputClass}
          >
            <option value="" disabled>
              선택
            </option>
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
        <div>
          <p className="mb-2 text-sm font-semibold">
            예상 예산 <span className="text-mint-500">*</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            {budgets.map((b) => (
              <button
                key={b.value}
                type="button"
                role="radio"
                aria-checked={budget === b.value}
                onClick={() => setBudget(b.value)}
                className={`rounded-xl px-3 py-3 text-sm ring-1 ${budget === b.value ? "bg-mint-50 font-semibold ring-2 ring-forest-700" : "bg-white ring-line"}`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold">
            이웃과 함께 공사할 의향이 있으세요?{" "}
            <span className="text-mint-500">*</span>
          </p>
          {Object.entries(JOINT_INTENT_LABEL).map(([k, l]) => (
            <ChoiceCard
              key={k}
              type="radio"
              checked={jointIntent === k}
              onClick={() => setJointIntent(k)}
              title={l}
            />
          ))}
          <p className="text-xs text-muted">
            지금 정하지 않아도 돼요. 묶음이 만들어지면 참여 여부를 다시
            여쭤봐요.
          </p>
        </div>
      </section>

      <section hidden={step !== 3} className="space-y-4">
        <div>
          <h2 className="text-xl font-extrabold">
            최근 전기·가스 요금을 알려주세요
          </h2>
          <p className="mt-1 text-sm text-muted">
            선택 사항이에요. 넣어주시면 에너지 진단이 더 정확해져요.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="월 전기요금(원)" error={e.billElectric}>
            <Input
              name="billElectric"
              type="number"
              inputMode="numeric"
              value={billElectric}
              onChange={(ev) => setBillElectric(ev.target.value)}
              placeholder="예: 65000"
            />
          </Field>
          <Field label="월 가스요금(원)" error={e.billGas}>
            <Input
              name="billGas"
              type="number"
              inputMode="numeric"
              value={billGas}
              onChange={(ev) => setBillGas(ev.target.value)}
              placeholder="예: 180000"
            />
          </Field>
        </div>
        <p className="text-xs text-muted">
          가스요금은 겨울철 한 달 기준이면 더 좋아요.
        </p>
        <Field
          label="고지서 사진 (선택)"
          hint="사진·PDF, 5MB 이하"
          error={e.billPhoto}
        >
          <input
            name="billPhoto"
            type="file"
            accept="image/*,application/pdf"
            className={inputClass}
            onChange={(ev) => setPhotoName(ev.target.files?.[0]?.name ?? null)}
          />
        </Field>
      </section>

      <section hidden={step !== 4} className="space-y-4">
        <h2 className="text-xl font-extrabold">이렇게 등록할게요</h2>
        <dl className="divide-y divide-line rounded-2xl bg-white px-4 ring-1 ring-line/60">
          {[
            [
              "불편한 점",
              symptoms
                .map((s) => SYMPTOMS.find((x) => x.code === s)?.label)
                .join(", ") || "없음",
              0,
            ],
            ["필요한 공사", trades.map((t) => TRADE_LABEL[t]).join(", "), 1],
            [
              "희망 시기",
              months.find((m) => m.value === desiredStart)?.label ?? "-",
              2,
            ],
            [
              "예상 예산",
              budgets.find((b) => b.value === budget)?.label ?? "-",
              2,
            ],
            ["공동공사", JOINT_INTENT_LABEL[jointIntent] ?? "-", 2],
            [
              "월 요금",
              [
                billElectric && `전기 ${won(Number(billElectric))}`,
                billGas && `가스 ${won(Number(billGas))}`,
                photoName && "고지서 첨부",
              ]
                .filter(Boolean)
                .join(" · ") || "입력 안 함",
              3,
            ],
          ].map(([k, v, s]) => (
            <div
              key={k as string}
              className="flex items-start justify-between gap-3 py-3 text-sm"
            >
              <dt className="shrink-0 text-muted">{k}</dt>
              <dd className="text-right font-medium">
                {v}
                <button
                  type="button"
                  onClick={() => setStep(s as number)}
                  className="ml-2 text-xs text-forest-700 underline"
                >
                  수정
                </button>
              </dd>
            </div>
          ))}
        </dl>
        {serverErrors.length > 0 && (
          <p role="alert" className="text-sm text-danger">
            {serverErrors[0]}
            {photoName && " (고지서 사진은 다시 선택해주세요.)"}
          </p>
        )}
      </section>

      <div className="sticky bottom-20 mt-8 bg-surface/95 py-2">
        {localError && (
          <p role="alert" className="mb-2 text-sm text-danger">
            {localError}
          </p>
        )}
        <div className="flex gap-2">
          {step > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setLocalError(null);
                setStep(step - 1);
              }}
            >
              이전
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            // key가 달라야 같은 DOM 버튼이 클릭 도중 submit 으로 바뀌어 폼이 제출되는 일을 막는다
            <Button key="next" type="button" className="flex-1" onClick={next}>
              {step === 3 && !billElectric && !billGas && !photoName
                ? "건너뛰기"
                : "다음"}
            </Button>
          ) : (
            <Button
              key="submit"
              type="submit"
              className="flex-1"
              disabled={pending}
            >
              {pending ? "저장 중…" : "등록 완료"}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
