"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Parts = { material: number; labor: number; logistics: number; fixed: number };
const PARTS: { key: keyof Parts; label: string; color: string }[] = [
  { key: "material", label: "자재비", color: "#1a6347" },
  { key: "labor", label: "인건비", color: "#24c99a" },
  { key: "logistics", label: "이동·물류비", color: "#9fd2bb" },
  { key: "fixed", label: "고정비(사다리차·비계)", color: "#072419" },
];
const man = (n: number) => `${Math.round(n / 1e4).toLocaleString("ko-KR")}만`;

export function CostBreakdownChart({ solo, joint, n }: { solo: Parts; joint: Parts; n: number }) {
  const data = [
    { name: "혼자", ...solo },
    { name: `${n}동 함께`, ...joint },
  ];
  return (
    <div className="h-64" role="img" aria-label={`1동 기준 비용 구성: 혼자 ${man(Object.values(solo).reduce((a, b) => a + b, 0))}원, 함께 ${man(Object.values(joint).reduce((a, b) => a + b, 0))}원`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#e5ece8" />
          <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis tickFormatter={man} tickLine={false} axisLine={false} fontSize={11} width={48} />
          <Tooltip formatter={(v) => `${man(Number(v))}원`} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {PARTS.map((p) => (
            <Bar key={p.key} dataKey={p.key} name={p.label} stackId="a" fill={p.color} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SizeCurveChart({ points, from, to, current }: { points: { n: number; perBuilding: number }[]; from: number; to: number; current: number }) {
  return (
    <div className="h-56" role="img" aria-label={`동수별 1동당 예상 비용. 추천 규모 ${from}~${to}동, 현재 ${current}동`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#e5ece8" />
          <ReferenceArea x1={from} x2={to} fill="#24c99a" fillOpacity={0.15} />
          <XAxis dataKey="n" tickFormatter={(v) => `${v}동`} tickLine={false} axisLine={false} fontSize={11} />
          <YAxis tickFormatter={man} tickLine={false} axisLine={false} fontSize={11} width={48} domain={["auto", "auto"]} />
          <Tooltip formatter={(v) => `${man(Number(v))}원`} labelFormatter={(v) => `${v}동이 함께할 때 1동당`} />
          <Line type="monotone" dataKey="perBuilding" name="1동당 비용" stroke="#1a6347" strokeWidth={2} isAnimationActive={false}
            dot={(p: { cx?: number; cy?: number; payload?: { n: number } }) => (
              <circle key={p.payload?.n} cx={p.cx} cy={p.cy} r={p.payload?.n === current ? 6 : 2.5} fill={p.payload?.n === current ? "#072419" : "#1a6347"} />
            )} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
