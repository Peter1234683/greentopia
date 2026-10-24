// 전제: e2e-m7.js 직후 상태 (서구 창호 Cluster 의 한 건물 공사 완료)
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
  const row = sql("select u.email, ct.id contractId, ct.contractorId, cu.email cemail from Contract ct join Project p on p.contractId=ct.id join Building b on b.id=ct.buildingId join User u on u.id=b.ownerId join ContractorProfile cp on cp.id=ct.contractorId join User cu on cu.id=cp.userId where p.status='COMPLETED' and p.photosJson != '[]'")[0];
  const before = sql(`select grade, reputationScore from ContractorProfile where id='${row.contractorId}'`)[0];
  const pts0 = sql(`select points from CustomerProfile cp join User u on u.id=cp.userId where u.email='${row.email}'`)[0].points;
  const o = await loginAs(browser, row.email);
  await o.goto(B + `/customer/reviews/new?contract=${row.contractId}`);
  await o.click('button:has-text("리뷰 등록")'); await o.waitForSelector('text=별점을 모두 매겨주세요');
  ok(true, 'ratings required');
  for (const label of ['시공 품질', '공사기간 준수', '청결·안전', '소통', 'A/S 대응', '가격 대비 만족']) await o.click(`[aria-label="${label} 5점"] >> xpath=..`);
  await o.click('label:has-text("소음·분진 관리 미흡")');
  await o.fill('textarea[name=text]', '이웃과 함께 하니 저렴했고, 공사도 깔끔했어요.');
  await o.screenshot({ path: `${SP}/shots/m8-01-review-form.png`, fullPage: true });
  await o.click('button:has-text("리뷰 등록")'); await o.waitForSelector('text=리뷰가 등록됐어요');
  const after = sql(`select grade, reputationScore from ContractorProfile where id='${row.contractorId}'`)[0];
  console.log('   contractor', JSON.stringify(before), '→', JSON.stringify(after));
  ok(after.reputationScore != null && after.grade !== 'SPROUT', 'reputation & grade updated from first review');
  ok(sql(`select points from CustomerProfile cp join User u on u.id=cp.userId where u.email='${row.email}'`)[0].points === pts0 + 3000, 'customer got review points');
  ok(!(await o.isVisible('button:has-text("리뷰 등록")')), 'one review per project');

  const c = await loginAs(browser, row.cemail);
  await c.goto(B + '/contractor/company');
  await c.fill('input[name=reply]', '좋은 리뷰 감사합니다. A/S도 책임지겠습니다.'); await c.click('button:has-text("등록")');
  await c.waitForSelector('text=업체 답글');
  ok(true, 'contractor replied');
  await c.click('text=허위·비방 신고'); await c.waitForSelector('text=신고 검토 중');
  ok(true, 'contractor reported review');
  await c.screenshot({ path: `${SP}/shots/m8-02-company.png`, fullPage: true });

  const admin = await loginAs(browser, 'admin@demo.kr', 1100);
  await admin.goto(B + '/admin/reviews');
  ok(await admin.isVisible('text=하자 처리 지연'), 'PQ candidate from complaint tags');
  await admin.screenshot({ path: `${SP}/shots/m8-03-admin-reviews.png`, fullPage: true });
  await admin.click('button:has-text("기각 · 유지")'); await admin.waitForSelector('text=처리할 신고가 없어요');
  ok(sql(`select status from Review where contractorId='${row.contractorId}' order by createdAt desc limit 1`)[0].status === 'VISIBLE', 'report rejected, review visible');
  await admin.locator('section', { hasText: 'PQ 규칙 후보' }).locator('button:has-text("PQ 탈락 규칙으로 추가")').first().click();
  await admin.waitForSelector('text=리뷰 불만: 하자 처리 지연');
  ok(true, 'PQ rule added from candidate');

  const h = await loginAs(browser, 'c05@demo.kr');
  await h.goto(B + '/contractor/tenders?scope=all');
  ok(await h.isVisible("text=리뷰 불만 '하자 처리 지연'"), 'defect-prone contractor now fails PQ');

  // 후속 리뷰: 시드 과거 공사 중 12개월 후속이 없는 건
  const f = sql("select u.email, ct.id contractId from Contract ct join Project p on p.contractId=ct.id join Building b on b.id=ct.buildingId join User u on u.id=b.ownerId where p.completedAt < " + (Date.now() - 400 * 864e5) + " and exists (select 1 from Review r where r.projectId=p.id and r.kind='INITIAL') and not exists (select 1 from Review r where r.projectId=p.id and r.kind='FOLLOWUP_12M') limit 1")[0];
  const fo = await loginAs(browser, f.email);
  await fo.goto(B + `/customer/reviews/new?contract=${f.contractId}`);
  ok(await fo.isVisible('text=하자는 없나요'), 'follow-up review form shown when due');
  await fo.click('text=네, 생겼어요'); await fo.click('text=처리됐어요');
  await fo.click('[aria-label="A/S 대응 4점"] >> xpath=..');
  await fo.click('button:has-text("리뷰 등록")'); await fo.waitForSelector('text=리뷰가 등록됐어요');
  ok(true, 'follow-up review saved');
  ok([o, c, admin, h, fo].every((x) => x.errors.length === 0), 'no page errors ' + [o, c, admin, h, fo].flatMap((x) => x.errors).join('|'));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
