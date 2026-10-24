import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { matchContext } from "@/lib/subsidy/service";
import { SUGGESTED_QUESTIONS } from "@/lib/subsidy/advisor";
import { aiStatus } from "@/lib/ai";
import { clearAdvisor } from "@/app/actions/subsidy";
import { Badge, ButtonLink, Card } from "@/components/ui";
import { AdvisorForm } from "./AdvisorForm";

export const metadata: Metadata = { title: "지원금 상담" };

// 답변 속 링크를 누를 수 있게
function Linkify({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="break-all text-forest-700 underline">{p}</a>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

export default async function AdvisorPage(props: PageProps<"/customer/subsidy/advisor">) {
  const user = await requireRole("CUSTOMER");
  const { b } = await props.searchParams;
  const ctx = await matchContext(user.id, typeof b === "string" ? b : undefined);
  if (!ctx)
    return (
      <Card className="mt-4 text-center">
        <p className="font-bold">먼저 우리 집을 등록해주세요</p>
        <ButtonLink href="/customer/buildings/new" className="mt-4 w-full">내 건물 등록하기</ButtonLink>
      </Card>
    );
  const messages = await db.advisorChatMessage.findMany({ where: { userId: user.id, buildingId: ctx.building.id }, orderBy: { createdAt: "asc" } });
  const status = aiStatus();

  return (
    <div className="space-y-4 pt-2">
      <Link href={`/customer/subsidy?b=${ctx.building.id}`} className="text-sm text-muted">‹ 숨은 지원금</Link>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">지원금 상담</h1>
          <p className="text-xs text-muted">{ctx.building.nickname ?? ctx.building.address} · {status.provider === "rule" ? "규칙 기반 답변" : `${status.label} 상담`}</p>
        </div>
        {messages.length > 0 && (
          <form action={clearAdvisor}>
            <input type="hidden" name="buildingId" value={ctx.building.id} />
            <button className="text-xs text-muted underline">대화 지우기</button>
          </form>
        )}
      </div>

      <div className="rounded-2xl bg-mint-50 p-3 text-sm text-forest-900">
        등록된 지원사업과 우리 집 매칭 결과만 근거로 답해요. 등록되지 않은 제도나 수치는 알려드리지 않아요.
      </div>

      <ul className="space-y-3" aria-live="polite">
        {messages.length === 0 && <li className="py-6 text-center text-sm text-muted">아래 질문을 눌러 시작해보세요.</li>}
        {messages.map((m) =>
          m.role === "user" ? (
            <li key={m.id} className="ml-10 rounded-2xl rounded-br-md bg-forest-800 px-4 py-3 text-sm text-white">{m.content}</li>
          ) : (
            <li key={m.id} className="mr-6 rounded-2xl rounded-bl-md bg-white px-4 py-3 text-sm ring-1 ring-line/60">
              <div className="mb-1">{m.provider === "rule" ? <Badge tone="gray">규칙 기반 답변</Badge> : <Badge tone="mint">AI 참고 의견</Badge>}</div>
              <p className="whitespace-pre-line leading-relaxed"><Linkify text={m.content} /></p>
            </li>
          ),
        )}
      </ul>
      <AdvisorForm buildingId={ctx.building.id} suggestions={SUGGESTED_QUESTIONS} />
    </div>
  );
}
