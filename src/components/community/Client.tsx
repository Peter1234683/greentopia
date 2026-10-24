"use client";

import { useActionState, useState } from "react";
import { addComment, createPost } from "@/app/actions/community";
import { Button, Field, Input, inputClass } from "@/components/ui";
import { TRADES, TRADE_LABEL } from "@/lib/constants";
import { formValues } from "@/lib/formValues";

export function CommentForm({ postId, parentId, placeholder = "댓글을 남겨주세요" }: { postId: string; parentId?: string; placeholder?: string }) {
  const [state, action, pending] = useActionState(addComment, undefined);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="postId" value={postId} />
      {parentId && <input type="hidden" name="parentId" value={parentId} />}
      <div className="flex gap-2">
        <input key={state?.ok ?? 0} name="body" aria-label={parentId ? "답글" : "댓글"} placeholder={placeholder} className={`${inputClass} py-2.5 text-sm`} maxLength={1000} />
        <Button disabled={pending} className="shrink-0 px-4 py-2.5 text-sm">{pending ? "…" : "등록"}</Button>
      </div>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      {state?.held && <p role="status" className="text-sm text-warn">진행 중 입찰 정보로 보이는 표현이 있어 운영자 검토 후 게시돼요.</p>}
    </form>
  );
}

export function ShareButton({ title }: { title: string }) {
  const [done, setDone] = useState(false);
  async function share() {
    const url = window.location.href.split("?")[0];
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        setDone(true);
      }
    } catch {
      /* 사용자가 공유를 취소함 */
    }
  }
  return (
    <button type="button" onClick={share} className="rounded-full px-3 py-2 text-sm font-semibold text-ink ring-1 ring-line hover:bg-mint-50">
      {done ? "링크 복사됨" : "↗ 공유"}
    </button>
  );
}

type Cat = { code: string; label: string; icon: string };

export function PostForm({ board, categories, hasBuilding, defaultCategory }: { board: "OWNER" | "CONTRACTOR"; categories: Cat[]; hasBuilding: boolean; defaultCategory?: string }) {
  const [state, action, pending] = useActionState(createPost, undefined);
  const e = state?.errors ?? {};
  const { str, has } = formValues(state?.values);
  const [category, setCategory] = useState(str("category") ?? defaultCategory ?? categories[0].code);
  const tips = state?.values?.tips;
  const tip = (i: number) => (Array.isArray(tips) ? tips[i] : i === 0 ? (tips as string | undefined) : undefined);
  const owner = board === "OWNER";

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="board" value={board} />
      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">카테고리<span className="ml-0.5 text-mint-500">*</span></legend>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <label key={c.code} className={`cursor-pointer rounded-full px-3.5 py-2 text-sm font-semibold ring-1 ${category === c.code ? "bg-forest-800 text-white ring-forest-800" : "bg-white ring-line"}`}>
              <input type="radio" name="category" value={c.code} checked={category === c.code} onChange={() => setCategory(c.code)} className="sr-only" />
              {c.icon} {c.label}
            </label>
          ))}
        </div>
        {e.category && <p className="mt-1 text-sm text-danger">{e.category}</p>}
      </fieldset>

      <Field label="제목" required error={e.title}>
        <Input name="title" defaultValue={str("title")} maxLength={80} placeholder={owner ? "예: 창호 바꾸고 첫 겨울 난방비 후기" : "예: 조적조 창틀 앵커 보강 방법"} />
      </Field>
      <Field label="내용" required error={e.body} hint={owner ? "주소는 동 단위까지만 써주세요. 번지·동호수는 올릴 수 없어요." : "진행 중인 입찰의 번호·가격·참여 여부는 쓸 수 없어요. 감지되면 운영자 검토 후 게시돼요."}>
        <textarea name="body" defaultValue={str("body")} rows={7} maxLength={3000} className={inputClass} />
      </Field>

      {category === "RECRUIT" && owner && (
        <Field label="함께할 공사" required error={e.recruitTrade} hint="관심 이웃은 이 공사가 자동으로 수요에 추가되고 AI 매칭에 반영돼요.">
          <select name="recruitTrade" defaultValue={str("recruitTrade") ?? ""} className={inputClass}>
            <option value="">골라주세요</option>
            {TRADES.map((t) => <option key={t} value={t}>{TRADE_LABEL[t]}</option>)}
          </select>
        </Field>
      )}

      {owner && (
        <>
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold">관련 공사</legend>
            <div className="flex flex-wrap gap-2">
              {TRADES.map((t) => (
                <label key={t} className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm ring-1 ring-line has-[:checked]:bg-mint-100 has-[:checked]:ring-mint-400">
                  <input type="checkbox" name="works" value={t} defaultChecked={has("works", t)} className="accent-forest-700" />
                  {TRADE_LABEL[t]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <Field label="시공 전 사진" error={e.photos}>
              <input type="file" name="before" accept="image/*" className="block w-full text-sm" />
            </Field>
            <Field label="시공 후 사진">
              <input type="file" name="after" accept="image/*" className="block w-full text-sm" />
            </Field>
          </div>
          <Field label="아낀 금액 (원)" error={e.savingsAmount} hint="공사비·난방비 등 직접 아낀 금액을 적어주세요. '작성자 입력'으로 표시돼요.">
            <Input name="savingsAmount" inputMode="numeric" defaultValue={str("savingsAmount")} placeholder="예: 350000" />
          </Field>
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-semibold">핵심 꿀팁 3줄</legend>
            {[0, 1, 2].map((i) => (
              <Input key={i} name="tips" defaultValue={tip(i)} maxLength={60} placeholder={`꿀팁 ${i + 1}`} />
            ))}
          </fieldset>
          <Field label="내 건물 정보 공개 범위" hint={hasBuilding ? "정확한 주소는 절대 공개되지 않아요." : "건물을 등록하면 동네·건물 유형이 함께 표시돼요."}>
            <select name="disclose" defaultValue={str("disclose") ?? "DONG"} className={inputClass} disabled={!hasBuilding}>
              <option value="DONG">동까지 (예: 남구 대명동)</option>
              <option value="GU">구까지 (예: 남구)</option>
              <option value="NONE">공개 안 함</option>
            </select>
          </Field>
        </>
      )}

      {!owner && (
        <Field label="첨부 (PDF·이미지, 2개까지)" error={e.attachments}>
          <input type="file" name="attachments" multiple accept="application/pdf,image/*" className="block w-full text-sm" />
        </Field>
      )}

      <Button disabled={pending} className="w-full">{pending ? "올리는 중…" : "글 올리기"}</Button>
    </form>
  );
}
