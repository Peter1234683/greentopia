import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { inspectionCrossCheck } from "@/lib/contractFlow";
import { finalVerdict, passRate, type CheckItem } from "@/lib/inspection";
import { requestFix, setOwnerCheck } from "@/app/actions/payment";
import { BeforeAfter } from "@/components/contract/BeforeAfter";
import { ApproveInspection } from "@/components/contract/ApproveInspection";
import { Badge, Button, Card, cx, inputClass } from "@/components/ui";
import { parseJson } from "@/lib/constants";

export const metadata: Metadata = { title: "준공 검측" };

const V = { O: { label: "충족", tone: "forest" }, X: { label: "미흡", tone: "danger" }, UNKNOWN: { label: "판단 불가", tone: "gray" } } as const;

export default async function InspectionPage(props: PageProps<"/customer/contracts/[id]/inspection">) {
  const user = await requireRole("CUSTOMER");
  const { id } = await props.params;
  const c = await db.contract.findFirst({
    where: { id, building: { ownerId: user.id } },
    include: { contractor: true, project: { include: { inspection: true } } },
  });
  const insp = c?.project?.inspection;
  if (!c || !insp) notFound();
  const items = parseJson<CheckItem[]>(insp.checklistJson, []);
  const ai = insp.source === "ai";
  const cross = await inspectionCrossCheck(c.project!.id);
  const rate = passRate(items);
  const lots = parseJson<string[]>(insp.lotPhotosJson, []);
  const done = insp.ownerApproved;

  return (
    <div className="space-y-5 pt-2">
      <Link href={`/customer/contracts/${c.id}`} className="text-sm text-muted">‹ 계약 요약 · 지급</Link>
      <div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={ai ? "forest" : "gray"}>{ai ? "AI 참고 의견" : "수동 모드"}</Badge>
          {done && <Badge tone="forest">✔ 건물주 승인 완료</Badge>}
        </div>
        <h1 className="mt-2 text-2xl font-extrabold">준공 검측</h1>
        <p className="mt-1 text-sm text-muted">
          {ai ? "AI가 사진으로 본 결과는 참고 의견이에요. " : "AI 판독 없이 직접 확인하는 모드예요. "}
          최종 승인은 반드시 건물주가 해요. 승인하면 준공금 단계가 열려요.
        </p>
      </div>

      <Card>
        <p className="mb-3 font-bold">📷 시공 전 · 후 비교</p>
        <BeforeAfter before={parseJson<string[]>(insp.beforePhotosJson, [])} after={parseJson<string[]>(insp.afterPhotosJson, [])} />
      </Card>

      <section className="space-y-2">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-bold">✅ 계약 규격 체크리스트</h2>
          <span className="text-sm text-muted">통과율 {rate == null ? "-" : `${Math.round(rate * 100)}%`}</span>
        </div>
        {items.map((x, i) => {
          const f = finalVerdict(x);
          return (
            <Card key={i} className={cx("p-4", f === "X" && "ring-red-200")} data-item={i}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold">{x.item}</p>
                <Badge tone={V[f].tone}>{V[f].label}</Badge>
              </div>
              {ai && <p className="mt-1 text-xs text-muted">AI: {V[x.verdict].label}{x.comment ? ` — ${x.comment}` : ""}</p>}
              {!done && (
                <form action={setOwnerCheck} className="mt-2 flex gap-1.5">
                  <input type="hidden" name="contractId" value={c.id} />
                  <input type="hidden" name="index" value={i} />
                  {(["O", "X"] as const).map((v) => (
                    <button key={v} name="verdict" value={v} aria-pressed={x.ownerCheck === v} className={cx("flex-1 rounded-xl py-2 text-sm font-semibold ring-1", x.ownerCheck === v ? (v === "O" ? "bg-forest-700 text-white ring-forest-700" : "bg-danger text-white ring-danger") : "ring-line")}>
                      {v === "O" ? "✓ 직접 확인: 충족" : "✕ 미흡"}
                    </button>
                  ))}
                </form>
              )}
            </Card>
          );
        })}
      </section>

      <Card>
        <p className="font-bold">🏷️ 자재 LOT · 인증 라벨</p>
        <p className="mt-1 text-sm">{insp.lotNumber ? <>LOT 번호 <b>{insp.lotNumber}</b> (같은 묶음 자재인지 확인용)</> : "업체가 아직 LOT 번호를 입력하지 않았어요."}</p>
        {lots.length > 0 && (
          <div className="mt-2 flex gap-2">
            {lots.map((d) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={d} src={`/files/${d}`} alt="자재 라벨 사진" className="h-20 w-20 rounded-xl object-cover" />
            ))}
          </div>
        )}
      </Card>

      <Card>
        <p className="font-bold">🏘️ 같은 묶음 이웃 세대와 비교</p>
        {cross && cross.others.length > 0 ? (
          <>
            <p className="mt-1 text-sm">이웃 세대 {cross.others.length}곳 통과율 중앙값 <b>{cross.median != null ? `${Math.round(cross.median * 100)}%` : "-"}</b> · 우리 집 <b>{cross.mine != null ? `${Math.round(cross.mine * 100)}%` : "-"}</b></p>
            {cross.flagged && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">우리 집만 유독 낮아요. 보완을 요청하거나 운영자에게 확인을 요청할 수 있어요. (승인 시 운영자에게 자동 알림)</p>}
          </>
        ) : (
          <p className="mt-1 text-sm text-muted">아직 비교할 이웃 세대 검측 결과가 없어요.</p>
        )}
        <p className="mt-1 text-xs text-muted">개별 세대 정보는 보여주지 않고 통과율만 비교해요.</p>
      </Card>

      {!done ? (
        <>
          <Card className="space-y-3">
            <p className="font-bold">보완이 필요하면</p>
            <form action={requestFix} className="flex gap-2">
              <input type="hidden" name="contractId" value={c.id} />
              <input name="note" placeholder="예: 거실 창 실링 마감 다시" className={inputClass} />
              <Button variant="outline" className="shrink-0 py-3">보완 요청</Button>
            </form>
          </Card>
          <ApproveInspection contractId={c.id} hasIssues={items.some((x) => finalVerdict(x) === "X")} />
        </>
      ) : (
        <Card className="text-sm">✔ {insp.ownerApprovedAt?.toLocaleDateString("ko-KR")} 승인했어요.{insp.ownerNote ? ` 메모: ${insp.ownerNote}` : ""}</Card>
      )}
    </div>
  );
}
