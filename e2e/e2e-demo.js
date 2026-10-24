// 데모 시나리오: 고객 1명(customer@demo.kr) + 업체 3곳으로 매칭 → 입찰 → 낙찰 → 계약 → 시공 → 리뷰
const { chromium } = require('playwright');
require('./patch.js');
const { execSync } = require('child_process');
const SP = __dirname;
const B = 'http://localhost:3000';
const ok = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
const sql = (q) => JSON.parse(execSync(`python3 ${SP}/q.py ` + JSON.stringify(q)).toString());
const all = [];
async function loginAs(browser, email, w = 390) {
  const c = await browser.newContext({ viewport: { width: w, height: 900 }, locale: 'ko-KR' });
  const p = await c.newPage(); all.push(p);
  p.errors = []; p.on('pageerror', (e) => p.errors.push(e.message));
  await p.goto(B + '/login'); await p.fill('input[name=email]', email); await p.fill('input[name=password]', 'demo1234'); await p.click('button[type=submit]');
  await p.waitForURL((u) => !u.pathname.startsWith('/login'));
  return p;
}
const shot = (p, n) => p.screenshot({ path: `${SP}/shots/demo-${n}.png`, fullPage: true });
(async () => {
  const browser = await chromium.launch();
  // 1. 고객: AI 제안 Cluster 참여 → 공고 초안
  const cu = await loginAs(browser, 'customer@demo.kr');
  await shot(cu, '01-home');
  await cu.goto(B + '/customer/joint'); await cu.click('text=공동견적 참여하기'); await cu.waitForSelector('text=참여 중이에요');
  const cl = sql("select c.id, c.code from Cluster c join ClusterMember m on m.clusterId=c.id join Building b on b.id=m.buildingId join User u on u.id=b.ownerId where u.email='customer@demo.kr'")[0];
  const draft = sql(`select id, method from Tender where clusterId='${cl.id}'`)[0];
  ok(draft, `1. 고객 참여 → Cluster #${cl.code} 공고 초안 (${draft.method})`);

  // 2. 운영자: 방식 확정 → 공고 → 데모 자동 입찰
  const ad = await loginAs(browser, 'admin@demo.kr', 1100);
  await ad.goto(B + '/admin/tenders/' + draft.id); await ad.click('text=확정하고 공고 열기'); await ad.waitForSelector('text=입찰 진행 중');
  await ad.click('text=데모: 다른 자격 업체 자동 입찰'); await ad.waitForLoadState('networkidle');
  const auto = sql(`select count(*) n from Bid where tenderId='${draft.id}'`)[0].n;
  ok(auto === 2, `2. 운영자 확정 · 다른 업체 자동 입찰 ${auto}건`);

  // 3. 발표자 업체 입찰
  const co = await loginAs(browser, 'contractor@demo.kr');
  ok(await co.isVisible('text=참가 가능한 신규 공고'), '3a. 업체 대시보드 알림');
  await co.goto(B + `/contractor/tenders/${draft.id}/bid`); await co.click('button:has-text("다음")');
  const inputs = co.locator('section:not([hidden]) input[type=number]');
  for (let i = 0; i < await inputs.count(); i++) await inputs.nth(i).fill(String(420000 + i * 40000));
  await co.click('button:has-text("다음")'); await co.click('button:has-text("다음")');
  const cond = co.locator('section:not([hidden]) input');
  await cond.nth(0).fill('21'); await cond.nth(1).fill('36'); await cond.nth(2).fill('24'); await cond.nth(3).fill('시공 3개 조(8명), 고소작업차');
  await co.fill('section:not([hidden]) textarea', '대명동 근거리 순서로 하루 2동씩 연속 시공, 마지막 날 전체 점검');
  await co.click('button:has-text("다음")'); await shot(co, '03-bid-preview');
  await co.click('button:has-text("입찰서 제출")'); await co.waitForURL(/\/contractor\/bids/);
  ok(true, '3b. 발표자 업체 입찰 제출');

  // 4. 마감 · 평가 · 낙찰
  await ad.goto(B + '/admin/tenders/' + draft.id); await ad.click('text=지금 마감하고 평가 실행'); await ad.waitForSelector('text=종합평가 결과');
  await shot(ad, '04-evaluation');
  const winner = sql(`select u.email, cp.companyName from Bid b join ContractorProfile cp on cp.id=b.contractorId join User u on u.id=cp.userId where b.tenderId='${draft.id}' and b.status='WON'`)[0];
  ok(winner, `4. 낙찰: ${winner.companyName}`);

  // 5. 고객: 할 일 → 견적 비교 → 참여 확정
  await cu.goto(B + '/customer'); ok(await cu.isVisible('text=지금 확인할 일'), '5a. 홈에 할 일 표시');
  await cu.click('text=참여 여부 결정'); await cu.waitForSelector('text=공동견적 비교');
  await shot(cu, '05-compare');
  await cu.click('text=참여 확정하고 현장확인 받기'); await cu.waitForSelector('text=✔ 참여 확정');
  ok(true, '5b. 견적 비교 후 참여 확정');

  // 6. 낙찰 업체: 현장확인 → 고객 서명 → 착공 → 완료 보고
  const wi = winner.email === 'contractor@demo.kr' ? co : await loginAs(browser, winner.email);
  await wi.goto(B + '/contractor/projects');
  const demoCard = wi.locator('div.rounded-3xl', { hasText: '대명동 1734-5' }).last();
  await demoCard.locator('button:has-text("현장확인 완료")').click(); await wi.waitForSelector('text=건물주 서명 대기');
  await cu.goto(B + `/customer/projects/${cl.id}`); await cu.check('input[name=agree]'); await cu.click('text=계약서 서명하기'); await cu.waitForSelector('text=계약 완료 · 착공 대기');
  await wi.goto(B + '/contractor/projects');
  await wi.locator('div.rounded-3xl', { hasText: '대명동 1734-5' }).last().locator('button:has-text("착공")').click();
  await wi.waitForSelector('input[name=photos]');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const card = wi.locator('div.rounded-3xl', { hasText: '대명동 1734-5' }).last();
  await card.locator('input[name=photos]').setInputFiles({ name: 'done.png', mimeType: 'image/png', buffer: png });
  await card.locator('button:has-text("완료 보고 올리기")').click();
  await wi.waitForTimeout(1500);
  await shot(wi, '06-contractor-projects');
  const proj = sql("select p.status from Project p join Contract c on c.id=p.contractId join Building b on b.id=c.buildingId join User u on u.id=b.ownerId where u.email='customer@demo.kr'")[0];
  ok(proj.status === 'COMPLETED', '6. 현장확인 → 서명 → 착공 → 완료 보고');

  // 7. 고객 리뷰 → 평판 반영
  const repBefore = sql(`select reputationScore from ContractorProfile where companyName='${winner.companyName}'`)[0].reputationScore;
  await cu.goto(B + '/customer'); await cu.click('text=공사 완료 · 리뷰 남기기');
  for (const label of ['시공 품질', '공사기간 준수', '청결·안전', '소통', 'A/S 대응', '가격 대비 만족']) await cu.click(`[aria-label="${label} 4점"] >> xpath=..`);
  await cu.fill('textarea[name=text]', '이웃과 함께 하니 혼자 알아볼 때보다 훨씬 저렴했어요. 창이 바뀌니 외풍이 없어요.');
  await cu.click('button:has-text("리뷰 등록")'); await cu.waitForSelector('text=리뷰가 등록됐어요');
  await shot(cu, '07-review-done');
  const repAfter = sql(`select reputationScore, grade from ContractorProfile where companyName='${winner.companyName}'`)[0];
  ok(repAfter.reputationScore !== repBefore, `7. 리뷰 → 평판 ${repBefore ?? '없음'} → ${repAfter.reputationScore} (${repAfter.grade})`);
  await cu.goto(B + '/customer/projects'); await shot(cu, '08-projects');
  ok(all.every((p) => p.errors.length === 0), 'no page errors ' + all.flatMap((p) => p.errors).join('|'));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
