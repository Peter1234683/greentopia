"use client";

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type SavingsRow = {
  key: string;
  name: string;
  low: number; // %
  high: number; // %
  wonLow: number;
  wonHigh: number;
  highlight: boolean; // 우리 집에 필요한 공사
  combined?: boolean;
};

const COLOR_HIGHLIGHT = "#1a6347";
const COLOR_OTHER = "#9fd2bb";
const COLOR_COMBINED = "#072419";

const manwon = (n: number) => `${Math.round(n / 1e4).toLocaleString("ko-KR")}만`;
const pctLabel = (r: SavingsRow) => (r.low === r.high ? `${r.low}%` : `${r.low}~${r.high}%`);

function TooltipBox({ active, payload }: { active?: boolean; payload?: { payload: SavingsRow }[] }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="rounded-xl bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-line">
      <p className="font-bold text-ink">{r.name}</p>
      <p className="text-ink">냉난방 에너지 {pctLabel(r)} 절감</p>
      <p className="text-muted">연간 약 {r.wonLow === r.wonHigh ? manwon(r.wonLow) : `${manwon(r.wonLow)}~${manwon(r.wonHigh)}`}원</p>
      {r.highlight && <p className="mt-1 font-semibold text-forest-700">우리 집에 필요한 공사</p>}
    </div>
  );
}

export function SavingsChart({ rows }: { rows: SavingsRow[] }) {
  const data = rows.map((r) => ({ ...r, mid: (r.low + r.high) / 2, label: pctLabel(r) }));
  const max = Math.max(...data.map((d) => d.high), 10);
  return (
    <div style={{ height: data.length * 44 + 8 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 64, bottom: 4, left: 0 }} barCategoryGap={10}>
          <XAxis type="number" hide domain={[0, Math.ceil(max / 10) * 10]} />
          <YAxis
            type="category"
            dataKey="name"
            width={92}
            tickLine={false}
            axisLine={{ stroke: "#dbe5e0" }}
            tick={{ fill: "#10201a", fontSize: 13 }}
          />
          <Tooltip content={<TooltipBox />} cursor={{ fill: "rgba(36,201,154,0.08)" }} />
          <Bar dataKey="mid" radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.key} fill={d.combined ? COLOR_COMBINED : d.highlight ? COLOR_HIGHLIGHT : COLOR_OTHER} />
            ))}
            <LabelList dataKey="label" position="right" style={{ fill: "#10201a", fontSize: 12, fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
