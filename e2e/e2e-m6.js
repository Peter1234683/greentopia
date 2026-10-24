const { chromium } = require('playwright');
require('./patch.js');
const { execSync } = require('child_process');
const SP = __dirname;
const B = 'http://localhost:3000';
const ok = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
const sql = (q) => JSON.parse(execSync(`python3 ${SP}/q.py ` + JSON.stringify(q)).toString());
async function login(browser, label, w = 390) {
  const c = await browser.newContext({ viewport: { width: w, height: 900 }, locale: 'ko-KR' });
  const p = await c.newPage();
  p.errors = []; p.on('pageerror', (e) => p.errors.push(e.message));
  await p.goto(B + '/login'); await p.click(`button:has-text("${label}")`); await p.click('button[type=submit]');
  await p.waitForURL((u) => !u.pathname.startsWith('/login'));
  return p;
}
const tenderId = (trade, sg, status) => sql(`select t.id from Tender t join Cluster c on c.id=t.clusterId where c.trade='${trade}' and c.sigungu='${sg}' and t.status='${status}' order by t.round desc`)[0]?.id;
(async () => {
  const browser = await chromium.launch();
  const admin = await login(browser, '관리자', 1100);
  ok(await admin.isVisible('text=입찰 방식 확정 대기'), 'admin dashboard todos');
  // 1) DRAFT 확정
  const ext = tenderId('EXT_INSULATION', '북구', 'DRAFT');
  await admin.goto(B + '/admin/tenders/' + ext);
  ok(await admin.isVisible('text=입찰 방식 추천'), 'recommendation shown');
  await admin.screenshot({ path: `${SP}/shots/m6-01-draft.png`, fullPage: true });
  await admin.click('text=확정하고 공고 열기'); await admin.waitForSelector('text=입찰 진행 중');
  ok(sql(`select status from Tender where id='${ext}'`)[0].status === 'OPEN', 'draft confirmed → OPEN');

  // 2) 창호 서구: 데모 업체 입찰 후 평가 → 낙찰
  const win = tenderId('WINDOW', '서구', 'OPEN');
  const p = await login(browser, '시공업체');
  await p.goto(B + `/contractor/tenders/${win}/bid`);
  await p.click('button:has-text("다음")');
  const inputs = p.locator('section:not([hidden]) input[type=number]');
  for (let i = 0; i < await inputs.count(); i++) await inputs.nth(i).fill(String(445000 + i * 45000));
  await p.click('button:has-text("다음")'); await p.click('button:has-text("다음")');
  const cond = p.locator('section:not([hidden]) input');
  await cond.nth(0).fill('25'); await cond.nth(1).fill('36'); await cond.nth(2).fill('24'); await cond.nth(3).fill('시공 2개 조(6명)');
  await p.fill('section:not([hidden]) textarea', '근거리 순서로 하루 1동씩 연속 시공하고 마지막 날 일괄 점검');
  await p.click('button:has-text("다음")'); await p.click('button:has-text("입찰서 제출")'); await p.waitForURL(/\/contractor\/bids/);
  await admin.goto(B + '/admin/tenders/' + win);
  await admin.click('text=지금 마감하고 평가 실행'); await admin.waitForSelector('text=종합평가 결과');
  const st = sql(`select t.status, (select count(*) from Contract where tenderId=t.id) contracts, (select count(*) from ClusterMember m where m.clusterId=t.clusterId and m.status='JOINED') joined, (select count(*) from Evaluation e join Bid b on b.id=e.bidId where b.tenderId=t.id) evals from Tender t where t.id='${win}'`)[0];
  console.log('   window tender:', JSON.stringify(st));
  ok(st.status === 'AWARDED' && st.contracts === st.joined && st.evals === 3, 'awarded with per-building contracts');
  await admin.screenshot({ path: `${SP}/shots/m6-02-evaluated.png`, fullPage: true });
  await p.goto(B + '/contractor/bids');
  ok(await p.isVisible('text=평가 결과'), 'contractor sees score breakdown');
  await p.screenshot({ path: `${SP}/shots/m6-03-contractor-result.png`, fullPage: true });

  // 3) 보일러: 1곳 입찰 → 유찰 → 2차(권역 확대) → 유찰 → 3차 수의계약 추천
  let boiler = tenderId('BOILER', '달서구', 'OPEN');
  await admin.goto(B + '/admin/tenders/' + boiler); await admin.click('text=지금 마감하고 평가 실행');
  await admin.waitForSelector('text=유찰 사유');
  ok(await admin.isVisible('text=최소 2곳에 못 미쳐요'), 'failed: below min bidders');
  await admin.click('text=2차 공고로 이동'); await admin.waitForSelector('text=입찰 방식 확정');
  const r2 = sql(`select qualificationJson, priceCap from Tender where round=2`)[0];
  ok(JSON.parse(r2.qualificationJson).expandedRegion === true, 'reannounce with expanded region');
  await admin.click('text=확정하고 공고 열기'); await admin.waitForSelector('text=지금 마감하고 평가 실행');
  await admin.click('text=지금 마감하고 평가 실행'); await admin.waitForSelector('text=3차 공고로 이동');
  await admin.click('text=3차 공고로 이동'); await admin.waitForSelector('text=입찰 방식 추천');
  const r3 = sql(`select method, priceCap from Tender where round=3`)[0];
  ok(r3.method === 'NEGOTIATED', 'third round recommends negotiated contract');
  ok(r3.priceCap <= r2.priceCap, 'negotiated cap ≤ previous cap');
  await admin.screenshot({ path: `${SP}/shots/m6-04-negotiated.png`, fullPage: true });
  ok(admin.errors.length === 0 && p.errors.length === 0, 'no page errors ' + admin.errors.concat(p.errors).join('|'));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
