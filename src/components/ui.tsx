import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-base font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed";
const buttonVariants = {
  primary: "bg-forest-800 text-white hover:bg-forest-700 active:bg-forest-900",
  mint: "bg-mint-400 text-forest-950 hover:bg-mint-300",
  outline: "border border-line bg-white text-ink hover:bg-mint-50",
  ghost: "text-forest-700 hover:bg-mint-50",
};
type Variant = keyof typeof buttonVariants;

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={cx(buttonBase, buttonVariants[variant], className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={cx(buttonBase, buttonVariants[variant], className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("rounded-3xl bg-white p-5 shadow-sm ring-1 ring-line/60", className)} {...props} />;
}

export function Badge({
  tone = "mint",
  children,
}: {
  tone?: "mint" | "gray" | "warn" | "forest" | "danger";
  children: ReactNode;
}) {
  const tones = {
    mint: "bg-mint-100 text-forest-800",
    gray: "bg-gray-100 text-gray-700",
    warn: "bg-warn-bg text-warn",
    forest: "bg-forest-800 text-mint-300",
    danger: "bg-red-50 text-danger",
  };
  return <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone])}>{children}</span>;
}

export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
        {required && <span className="ml-0.5 text-mint-500">*</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      {error && <span className="mt-1 block text-sm text-danger">{error}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-line bg-white px-4 py-3 text-base text-ink placeholder:text-gray-400 focus:border-mint-500 focus:outline-none focus:ring-2 focus:ring-mint-300";

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={cx(inputClass, props.className)} />;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between">
      <h2 className="text-lg font-bold text-ink">{children}</h2>
      {action}
    </div>
  );
}

// 금액·절감액 옆에 붙이는 근거 표기 (10장 디자인 가이드)
export function Basis({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-[0.7rem] leading-snug text-muted">※ {children}</p>;
}

export function ComingSoon({ milestone, title, items }: { milestone: number; title: string; items: string[] }) {
  return (
    <Card className="text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-mint-100 text-2xl">🌱</div>
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mt-1 text-sm text-muted">개발 마일스톤 {milestone}에서 열려요.</p>
      <ul className="mt-4 space-y-1.5 text-left text-sm text-ink">
        {items.map((i) => (
          <li key={i} className="flex gap-2">
            <span className="text-mint-500">•</span>
            {i}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-lg font-extrabold tracking-tight", light ? "text-white" : "text-forest-900")}>
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" fill="#4fe3b5" />
        <path d="M12 9c3 0 4 2 4 4-2 0-4-1-4-4z" fill={light ? "#0c3526" : "#ffffff"} />
      </svg>
      그린토피아
    </span>
  );
}

export { cx };
