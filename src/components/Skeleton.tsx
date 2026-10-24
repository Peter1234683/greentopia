export function PageSkeleton() {
  return (
    <div className="space-y-4 pt-2" aria-busy="true" aria-label="불러오는 중">
      <div className="h-7 w-40 animate-pulse rounded-lg bg-line/70" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-32 animate-pulse rounded-3xl bg-white ring-1 ring-line/60" />
      ))}
    </div>
  );
}
