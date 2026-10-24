// P7 리뷰 교차 검증 · 업체 상세 프로필 · 안심 보장제 · 권역 수요 인사이트 · 파일럿 현황
const { chromium } = require('playwright');
require('./patch.js');
const { execSync } = require('child_process');
const SP = __dirname;
const B = 'http://localhost:3000';
const ok = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
const sql = (q) => JSON.parse(execSync(`python3 ${SP}/q.py ` + JSON.stringify(q.replace(/\s+/g, ' '))).toString());
async function loginAs(browser, email, w = 390) {
  const c = await browser.newContext({ viewport: { width: w, height: 900 }, locale: 'ko-KR' });
  const p = await c.newPage(); p.errors = []; p.on('pageerror', (e) => p.errors.push(e.message));
  await p.goto(B + '/login'); await p.fill('input[name=email]', email); await p.fill('input[name=password]', 'demo1234'); await p.click('button[type=submit]');
  await p.waitForURL((u) => !u.pathname.startsWith('/login'));
  return p;
}
(async () => {
  const browser = await chromium.launch();
  // 리뷰가 아직 없는 완료 공사 (같은 묶음에 이웃 후기 여러 건)
  const row = sql(`select u.email, ct.id contractId, ct.contractorId from Contract ct join Project p on p.contractId=ct.id join Building b on b.id=ct.buildingId join User u on u.id=b.ownerId
    join Tender t on t.id=ct.tenderId join Cluster c on c.id=t.clusterId
    where p.status='COMPLETED' and c.code=5 and not exists (select 1 from Review r where r.projectId=p.id and r.kind='INITIAL')`)[0];
  const before = sql(`select reputationScore from ContractorProfile where id='${row.contractorId}'`)[0].reputationScore;

  // 이웃 세대와 크게 다른 1점 후기 → 교차 검증 · 평판 반영 보류
  const o = await loginAs(browser, row.email);
  await o.goto(B + `/customer/reviews/new?contract=${row.contractId}`);
  for (const label of ['시공 품질', '공사기간 준수', '청결·안전', '소통', 'A/S 대응', '가격 대비 만족']) await o.click(`[aria-label="${label} 1점"] >> xpath=..`);
  await o.fill('textarea[name=text]', '전반적으로 불만족스러웠어요.');
  await o.click('button:has-text("리뷰 등록")'); await o.waitForSelector('text=리뷰가 등록됐어요');
  const flag = sql(`select f.reason, f.resolved from ReviewFlag f join Review r on r.id=f.reviewId join Project p on p.id=r.projectId where p.contractId='${row.contractId}'`);
  ok(flag.length === 1 && flag[0].reason === 'CLUSTER_OUTLIER' && flag[0].resolved === 0, 'outlier review flagged');
  const mid = sql(`select reputationScore from ContractorProfile where id='${row.contractorId}'`)[0].reputationScore;
  ok(Math.abs(mid - before) < 1e-9, `reputation unchanged while pending (${before} → ${mid})`);

  // 고객이 보는 업체 상세 프로필
  await o.goto(B + `/customer/contractors/${row.contractorId}`);
  ok(await o.isVisible('text=교차 검증 중 · 평판 미반영'), 'pending badge on review');
  ok(await o.locator('text=✔ 단계별 지급 완료 인증 후기').count() >= 1, 'verified (payment-complete) review badge');
  for (const t of ['누적 완공', '무사고 시공', '하자보수 이행률', '사업자 정보', '전문건설업 면허', 'GR 사업자 등록', '영업배상 책임보험', '항목별 평점', '불만 태그와 사후 해결률'])
    ok(await o.isVisible(`text=${t}`), 'profile: ' + t);
  await o.screenshot({ path: `${SP}/shots/p7-01-profile.png`, fullPage: true });

  // 운영자: 교차 검증 처리 → 평판 반영
  const a = await loginAs(browser, 'admin@demo.kr', 1100);
  await a.goto(B + '/admin');
  ok(await a.isVisible('text=파일럿 현황 (대구)'), 'pilot dashboard');
  for (const t of ['공동공사 참여 의향률', '가동 예정 Cluster', '업체 가입 · 승인 · 대기', '입찰 성사율', '낙찰가 vs 개별 견적', '지역별 등록 건물'])
    ok(await a.isVisible(`text=${t}`), 'pilot: ' + t);
  ok(await a.isVisible('text=/\\d+%/'), 'intent rate as percent');
  ok(await a.isVisible('a:has-text("리뷰 교차 검증")'), 'todo: review cross-check');
  await a.screenshot({ path: `${SP}/shots/p7-02-pilot.png`, fullPage: true });
  await a.goto(B + '/admin/reviews');
  ok(await a.isVisible('text=교차 검증 필요 리뷰 (1)'), 'admin sees flagged review');
  await a.click('button:has-text("확인 · 평판 반영")'); await a.waitForSelector('text=교차 검증 필요 리뷰 (0)');
  const after = sql(`select reputationScore from ContractorProfile where id='${row.contractorId}'`)[0].reputationScore;
  ok(after < before, `included after admin check (${before} → ${after})`);

  // 업체: 안심 보장제 참여 → 프로필 배지
  const cemail = sql(`select u.email from ContractorProfile cp join User u on u.id=cp.userId where cp.id='${row.contractorId}'`)[0].email;
  const c = await loginAs(browser, cemail);
  await c.goto(B + '/contractor/company');
  for (const l of ['계약 외 추가비용 요구 금지', '일정 지연 시 지체상금 지급']) { const box = c.locator(`label:has-text("${l}") input`); if (!(await box.isChecked())) await box.check(); }
  await c.locator('input[name=liabilityInsurance]').check();
  await c.click('form:has(input[name=items]) button:has-text("저장")');
  await c.waitForTimeout(800);
  const pledge = sql(`select itemsJson from SafetyPledge where contractorId='${row.contractorId}'`)[0];
  ok(pledge && JSON.parse(pledge.itemsJson).length >= 2, 'safety pledge saved');
  await o.goto(B + `/customer/contractors/${row.contractorId}`);
  ok(await o.isVisible('text=🛡️ 안심 보장제 참여') && await o.isVisible('text=✔ 계약 외 추가비용 요구 금지'), 'pledge badge on profile');
  ok(await o.isVisible('dd:has-text("✔ 가입")'), 'liability insurance shown');

  // 업체: 권역 수요 인사이트
  await c.goto(B + '/contractor');
  await c.click('text=📈 권역 수요 인사이트'); await c.waitForURL(/contractor\/insights/);
  for (const t of ['공종별 진행 중 수요', '수요 집중 동네 Top 3', '건물 유형', '수요 밀도 지도', '곧 공고될 가능성이 높은 묶음'])
    ok(await c.isVisible(`text=${t}`), 'insights: ' + t);
  const html = await c.content();
  const addrs = sql('select address from Building');
  ok(!addrs.some((x) => html.includes(x.address)), 'no building addresses in insights');
  await c.screenshot({ path: `${SP}/shots/p7-03-insights.png`, fullPage: true });
  ok([o, a, c].every((x) => x.errors.length === 0), 'no page errors ' + [o, a, c].flatMap((x) => x.errors).join('|'));
  await browser.close();
})().catch((e) => { console.error('FAIL: exception', e); process.exit(1); });
