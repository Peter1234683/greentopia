import { PROJECT_STAGES } from "@/lib/constants";

export function Timeline({ current }: { current: number }) {
  return (
    <ol className="flex items-start" aria-label="공사 진행 단계">
      {PROJECT_STAGES.map((s, i) => (
        <li key={s.code} className="relative flex flex-1 flex-col items-center" aria-current={i === current ? "step" : undefined}>
          {i > 0 && <span className={`absolute right-1/2 top-2 h-0.5 w-full ${i <= current ? "bg-forest-700" : "bg-line"}`} aria-hidden="true" />}
          <span
            className={`relative z-10 flex h-4 w-4 items-center justify-center rounded-full ring-2 ${
              i < current ? "bg-forest-700 ring-forest-700" : i === current ? "bg-mint-400 ring-forest-700" : "bg-white ring-line"
            }`}
          />
          <span className={`mt-1 text-center text-[0.62rem] leading-tight ${i === current ? "font-bold text-forest-800" : i < current ? "text-ink" : "text-muted"}`}>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}
