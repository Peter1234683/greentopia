import type { Review } from "@prisma/client";
import { COMPLAINT_TAGS, parseJson } from "@/lib/constants";
import { RATING_KEYS } from "@/lib/reputation";
import { Badge } from "./ui";

const KIND: Record<string, string> = { INITIAL: "시공 후기", FOLLOWUP_6M: "6개월 후속", FOLLOWUP_12M: "1년 후속" };

export function ReviewCard({ r, author, children }: { r: Review; author?: string; children?: React.ReactNode }) {
  const tags = parseJson<string[]>(r.complaintTagsJson, []);
  const photos = parseJson<string[]>(r.photosJson, []);
  const avg = RATING_KEYS.reduce((s, [, f]) => s + r[f], 0) / RATING_KEYS.length;
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-line/60">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge tone={r.kind === "INITIAL" ? "mint" : "gray"}>{KIND[r.kind]}</Badge>
          {r.status === "REPORTED" && <Badge tone="warn">신고 검토 중</Badge>}
          {r.status === "HIDDEN" && <Badge tone="danger">숨김</Badge>}
        </div>
        <span className="text-xs text-muted">{author && `${author} · `}{r.createdAt.toLocaleDateString("ko-KR")}</span>
      </div>
      {r.kind === "INITIAL" ? (
        <>
          <p className="mt-2 text-sm"><span aria-hidden="true" className="text-amber-500">{"★".repeat(Math.round(avg))}{"☆".repeat(5 - Math.round(avg))}</span> <span className="tabular-nums">{avg.toFixed(1)}</span></p>
          <dl className="mt-1 grid grid-cols-3 gap-x-2 text-[0.7rem] text-muted">
            {RATING_KEYS.map(([k, f, l]) => <div key={k} className="flex justify-between"><dt>{l}</dt><dd className="tabular-nums text-ink">{r[f]}</dd></div>)}
          </dl>
        </>
      ) : (
        <p className="mt-2 text-sm">
          하자 {r.defectOccurred ? (r.defectResolved ? "발생 → 처리 완료" : "발생 · 처리 안 됨") : "없음"} · A/S 대응 {r.ratingAS}점
        </p>
      )}
      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.map((t) => <Badge key={t} tone="danger">{COMPLAINT_TAGS.find((x) => x.code === t)?.label ?? t}</Badge>)}
        </div>
      )}
      {r.text && <p className="mt-2 whitespace-pre-line text-sm">{r.text}</p>}
      {photos.length > 0 && (
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {photos.map((id) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={id} src={`/files/${id}`} alt="리뷰 사진" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
          ))}
        </div>
      )}
      {r.reply && <p className="mt-3 rounded-xl bg-surface p-3 text-sm"><b>업체 답글</b> {r.reply}</p>}
      {children}
    </div>
  );
}
