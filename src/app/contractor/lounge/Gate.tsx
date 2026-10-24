import { agreeLoungeRules } from "@/app/actions/community";
import { Button, Card } from "@/components/ui";

const RULES = [
  "진행 중인 입찰의 가격·단가·참여 여부는 논의하지 않습니다.",
  "입찰 번호·금액으로 보이는 글은 자동으로 게시가 보류되고 운영자가 검토하며, 담합 감시 기록에 남습니다.",
  "다른 업체 비방·건물주 개인정보(주소·연락처) 공유를 하지 않습니다.",
];

export function LoungeGate({ need }: { need: boolean }) {
  return (
    <Card className="space-y-4">
      <div className="text-4xl" aria-hidden="true">🤝</div>
      <h1 className="text-xl font-extrabold">파트너 라운지 이용 규칙</h1>
      <p className="text-sm text-muted">시공 기술·자재·서류 실무를 나누는 승인 업체 전용 공간이에요. 처음 한 번 규칙에 동의해주세요.</p>
      <form action={agreeLoungeRules} className="space-y-3">
        {RULES.map((r) => (
          <label key={r} className="flex gap-3 rounded-2xl bg-mint-50 p-3 text-sm">
            <input type="checkbox" name="agree" value={r} className="mt-0.5 h-5 w-5 shrink-0 accent-forest-700" />
            {r}
          </label>
        ))}
        {need && <p className="text-sm text-danger">세 가지 모두 동의해야 이용할 수 있어요.</p>}
        <Button className="w-full">동의하고 라운지 들어가기</Button>
      </form>
    </Card>
  );
}
