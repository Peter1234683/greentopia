import { closeDueTenders } from "@/lib/bidding/close";

// 외부 스케줄러(예: Vercel Cron, GitHub Actions)가 주기적으로 호출해 마감된 공고를 평가한다.
// Authorization: Bearer $CRON_SECRET
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const closed = await closeDueTenders();
  return Response.json({ closed });
}
