const { chromium } = require('playwright');
require('./patch.js');
const { execSync } = require('child_process');
const SP = __dirname;
const B = 'http://localhost:3000';
const ok = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
const sql = (q) => JSON.parse(execSync(`python3 ${SP}/q.py ` + JSON.stringify(q)).toString());
async function loginAs(browser, email, w = 390) {
  const c = await browser.newContext({ viewport: { width: w, height: 900 }, locale: 'ko-KR' });
  const p = await c.newPage();
  p.errors = []; p.on('pageerror', (e) => p.errors.push(e.message));
  await p.goto(B + '/login'); await p.fill('input[name=email]', email); await p.fill('input[name=password]', 'demo1234'); await p.click('button[type=submit]');
  await p.waitForURL((u) => !u.pathname.startsWith('/login'));
  return p;
}
(async () => {
  const browser = await chromium.launch();
  const win = sql("select t.id, t.clusterId from Tender t join Cluster c on c.id=t.clusterId where c.trade='WINDOW' and c.sigungu='서구' and t.status='OPEN'")[0];
  const admin = await loginAs(browser, 'admin@demo.kr', 1100);
  await admin.goto(B + '/admin/tenders/' + win.id); await admin.click('text=지금 마감하고 평가 실행'); await admin.waitForSelector('text=종합평가 결과');
  const owners = sql(`select u.email, ct.id contractId, ct.amount from Contract ct join Building b on b.id=ct.buildingId join User u on u.id=b.ownerId where ct.tenderId='${win.id}' order by ct.amount`);
  const winner = sql(`select u.email from Bid bd join ContractorProfile cp on cp.id=bd.contractorId join User u on u.id=cp.userId where bd.tenderId='${win.id}' and bd.status='WON'`)[0].email;
  console.log('   winner', winner, 'owners', owners.map((o) => o.email).join(','));

  const o1 = await loginAs(browser, owners[0].email);
  await o1.goto(B + '/customer/projects');
  ok(await o1.isVisible('text=확인 필요'), 'owner sees action needed');
  await o1.click('text=창호 공동공사'); await o1.waitForSelector('text=공동견적 비교');
  ok(await o1.locator('text=낙찰').count() >= 1, 'comparison with winner');
  await o1.fill('input[name=ownerQuote]', '30000000'); await o1.click('button:has-text("비교")'); await o1.waitForSelector('text=개별 견적');
  ok(true, 'own quote compare');
  await o1.screenshot({ path: `${SP}/shots/m7-01-compare.png`, fullPage: true });
  await o1.click('text=참여 확정하고 현장확인 받기'); await o1.waitForSelector('text=✔ 참여 확정');
  ok(sql(`select status from Contract where id='${owners[0].contractId}'`)[0].status === 'CONFIRMED', 'participation confirmed');

  const o2 = await loginAs(browser, owners[1].email);
  await o2.goto(B + `/customer/projects/${win.clusterId}`);
  await o2.click('text=이번에는 참여하지 않을래요'); await o2.waitForSelector('text=참여하지 않기로 했어요');
  ok(sql(`select status from Contract where id='${owners[1].contractId}'`)[0].status === 'CANCELLED', 'other owner declined');

  const c = await loginAs(browser, winner);
  await c.goto(B + '/contractor/projects');
  await c.waitForSelector('text=근거리 연속 시공 동선');
  await c.fill('input[name=measuredQty]', String(Math.round(sql(`select measuredQty from Contract where id='${owners[0].contractId}'`)[0].measuredQty || 30)));
  const before = owners[0].amount;
  const qtyInput = c.locator('input[name=measuredQty]').first();
  const est = Number(await c.locator('input[name=estimatedQty]').first().inputValue());
  await qtyInput.fill(String(est + 2));
  await c.click('text=현장확인 완료'); await c.waitForSelector('text=건물주 서명 대기');
  const after = sql(`select amount, status from Contract where id='${owners[0].contractId}'`)[0];
  ok(after.status === 'READY' && after.amount > before, `site check adjusted amount (${before} → ${after.amount})`);

  await o1.goto(B + `/customer/projects/${win.clusterId}`);
  await o1.check('input[name=agree]'); await o1.click('text=계약서 서명하기'); await o1.waitForSelector('text=계약 완료 · 착공 대기');
  ok(sql(`select status from Contract where id='${owners[0].contractId}'`)[0].status === 'SIGNED', 'owner signed');

  await c.goto(B + '/contractor/projects');
  await c.click('button:has-text("착공")'); await c.waitForSelector('text=완료 보고 올리기');
  await c.screenshot({ path: `${SP}/shots/m7-02-contractor.png`, fullPage: true });
  await c.click('text=완료 보고 올리기'); await c.waitForSelector('text=완료 사진을 1장 이상');
  ok(true, 'completion requires photo');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  await c.setInputFiles('input[name=photos]', { name: 'done.png', mimeType: 'image/png', buffer: png });
  await c.fill('textarea[name=note]', '창호 4면 교체, 실리콘 마감 완료');
  await c.click('text=완료 보고 올리기'); await c.waitForSelector('text=완료 보고 올리기', { state: 'detached' });
  ok(sql(`select p.status from Project p where p.contractId='${owners[0].contractId}'`)[0].status === 'COMPLETED', 'project completed');

  await o1.goto(B + `/customer/projects/${win.clusterId}`);
  ok(await o1.isVisible('img[alt="완료 사진"]'), 'owner sees completion photo');
  const imgOk = await o1.evaluate(() => { const i = document.querySelector('img[alt="완료 사진"]'); return i.complete && i.naturalWidth > 0; });
  ok(imgOk, 'photo served to building owner');
  ok(await o1.isVisible('text=리뷰 남기기'), 'review CTA');
  await o1.screenshot({ path: `${SP}/shots/m7-03-completed.png`, fullPage: true });
  await o1.goto(B + '/customer/projects');
  await o1.screenshot({ path: `${SP}/shots/m7-04-list.png`, fullPage: true });
  ok([o1, o2, c, admin].every((x) => x.errors.length === 0), 'no page errors ' + [o1, o2, c, admin].flatMap((x) => x.errors).join('|'));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
