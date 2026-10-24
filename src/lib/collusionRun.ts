import "server-only";
import { db } from "./db";
import { getSettings } from "./settings";
import { detectCollusion } from "./collusion";
import { TRADE_LABEL, type Trade } from "./constants";

export async function runCollusionCheck() {
  const s = (await getSettings()).bidding.collusion;
  const tenders = await db.tender.findMany({
    where: { status: { in: ["AWARDED", "FAILED"] } },
    include: { cluster: true, bids: { where: { status: { in: ["WON", "LOST"] } }, include: { contractor: true } } },
  });
  const names: Record<string, string> = {};
  for (const t of tenders) for (const b of t.bids) names[b.contractorId] = b.contractor.companyName;
  const flags = detectCollusion(
    tenders.map((t) => ({
      id: t.id,
      label: `Cluster #${t.cluster.code} ${TRADE_LABEL[t.cluster.trade as Trade]}`,
      bids: t.bids.map((b) => ({ contractorId: b.contractorId, totalPrice: b.totalPrice, won: b.status === "WON" })),
    })),
    names,
    s,
  );
  let created = 0;
  for (const f of flags) {
    const key = { kind: f.kind, contractorIdsJson: JSON.stringify(f.contractorIds), tenderIdsJson: JSON.stringify(f.tenderIds) };
    if (await db.collusionFlag.count({ where: key })) continue;
    await db.collusionFlag.create({ data: { ...key, detail: f.detail } });
    created++;
  }
  return created;
}
