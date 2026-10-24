"use client";

import { useActionState } from "react";
import { saveSettingsSection } from "@/app/actions/admin";
import { Button, inputClass } from "@/components/ui";

export function SettingsEditor({ section, title, desc, json, overridden }: { section: string; title: string; desc: string; json: string; overridden: boolean }) {
  const [state, action, pending] = useActionState(saveSettingsSection, undefined);
  return (
    <details className="rounded-2xl bg-white p-4 ring-1 ring-line/60" open={!!state}>
      <summary className="cursor-pointer">
        <span className="font-bold">{title}</span>
        {overridden && <span className="ml-2 rounded-full bg-warn-bg px-2 py-0.5 text-xs font-semibold text-warn">수정됨</span>}
        <span className="mt-0.5 block text-sm text-muted">{desc}</span>
      </summary>
      <form action={action} className="mt-3 space-y-2">
        <input type="hidden" name="section" value={section} />
        <textarea name="json" defaultValue={json} rows={18} spellCheck={false} className={`${inputClass} font-mono text-xs`} aria-label={`${title} JSON`} />
        {state?.errors && <ul role="alert" className="space-y-0.5 text-sm text-danger">{state.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        {state?.ok && <p role="status" className="text-sm text-forest-700">저장했어요. 바로 반영돼요.</p>}
        <div className="flex gap-2">
          <Button className="py-2 text-sm" disabled={pending}>저장</Button>
          {overridden && <Button name="op" value="reset" variant="outline" className="py-2 text-sm">기본값으로 되돌리기</Button>}
        </div>
      </form>
    </details>
  );
}
