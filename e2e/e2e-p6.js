// P6 계약 요약 · 단계별 지급(30/40/25/5, 데모) · 지체상금 · 준공 검측(수동 모드) → 준공금 → 유보금
const { chromium } = require('playwright');
require('./patch.js');
const { execSync } = require('child_process');
const path = require('path');
const SP = __dirname;
const B = 'http://localhost:3000';
const IMG = path.join(SP, '..', 'src', 'app', 'icon.png');
const ok = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
const sql = (q) => JSON.parse(execSync(`python3 ${SP}/q.py ` + JSON.stringify(q)).toString());
async function loginAs(browser, email, w = 390) {
  const c = await browser.newContext({ viewport: { width: w, height: 900 }, locale: 'ko-KR' });
  const p = await c.newPage(); p.errors = []; p.on('pageerror', (e) => p.errors.push(e.message));
  await p.goto(B + '/login'); await p.fill('input[name=email]', email); await p.fill('input[name=password]', 'demo1234'); await p.click('button[type=submit]');
  await p.waitForURL((u) => !u.pathname.startsWith('/login'));
  return p;
}
const ms = (cid) => Object.fromEntries(sql(`select stage, status from PaymentMilestone where contractId='${cid}'`).map((r) => [r.stage, r.status]));

(async () => {
  const browser = await chromium.launch();
  // 서구 창호 공고 마감 → 낙찰 → 1세대 참여·실측·서명
  const win = sql("select t.id, t.clusterId from Tender t join Cluster c on c.id=t.clusterId where c.trade='WINDOW' and c.sigungu='서구' and t.status='OPEN'")[0];
  const admin = await loginAs(browser, 'admin@demo.kr', 1100);
  await admin.goto(B + '/admin/tenders/' + win.id); await admin.click('text=지금 마감하고 평가 실행'); await admin.waitForSelector('text=종합평가 결과');
  const own = sql(`select u.email, ct.id contractId from Contract ct join Building b on b.id=ct.buildingId join User u on u.id=b.ownerId where ct.tenderId='${win.id}' order by ct.amount`)[0];
  const winner = sql(`select u.email from Bid bd join ContractorProfile cp on cp.id=bd.contractorId join User u on u.id=cp.userId where bd.tenderId='${win.id}' and bd.status='WON'`)[0].email;
  const o = await loginAs(browser, own.email);
  await o.goto(B + `/customer/projects/${win.clusterId}`);
  await o.click('text=참여 확정하고 현장확인 받기'); await o.waitForSelector('text=✔ 참여 확정');
  const c = await loginAs(browser, winner);
  await c.goto(B + '/contractor/projects'); await c.click('text=현장확인 완료'); await c.waitForSelector('text=건물주 서명 대기');

  // 서명 전에도 요약서 확인
  await o.goto(B + `/customer/projects/${win.clusterId}`);
  await o.click('text=📄 계약 요약서 · 단계별 지급'); await o.waitForURL(/customer\/contracts\//);
  ok(await o.isVisible('text=/표준도급계약서\\(국토교통부\\) 기반 요약 \\(데모\\)/'), 'summary labelled as standard-contract-based demo');
  for (const k of ['건물주', '시공업체', '공사 범위', '자재 규격', '공사 기간', '계약 금액', '하자보수', '지체상금', 'A/S 유보금']) ok(await o.isVisible(`dt:has-text("${k}")`), 'summary row: ' + k);
  ok(await o.isVisible('text=/보증기관 무관/'), 'warranty bond any issuer');
  ok(await o.isVisible('text=계약서에 서명하면 지급 단계가 만들어져요'), 'no milestones before signing');
  // 지체상금 시뮬레이터
  const p0 = await o.textContent('[data-testid=penalty]');
  await o.locator('input[aria-label="지연 일수"]').fill('30');
  await o.waitForFunction((v) => document.querySelector('[data-testid=penalty]').textContent !== v, p0);
  ok(true, 'delay penalty recalculates: ' + p0 + ' → ' + (await o.textContent('[data-testid=penalty]')));

  await o.goto(B + `/customer/projects/${win.clusterId}`);
  await o.check('input[name=agree]'); await o.click('text=계약서 서명하기'); await o.waitForSelector('text=계약 완료 · 착공 대기');
  const cid = own.contractId;
  const rows = sql(`select stage, ratio, amount from PaymentMilestone where contractId='${cid}' order by seq`);
  const amount = sql(`select amount from Contract where id='${cid}'`)[0].amount;
  ok(rows.map((r) => r.ratio).join() === '0.3,0.4,0.25,0.05' && rows.reduce((a, r) => a + r.amount, 0) === amount, 'milestones 30/40/25/5 sum to contract amount');
  ok(ms(cid).DEPOSIT === 'READY' && ms(cid).INTERIM === 'LOCKED', 'deposit ready after signing');

  await o.goto(B + `/customer/contracts/${cid}`);
  ok(await o.isVisible('text=/실제 돈은 이동하지 않아요/'), 'escrow demo notice');
  await o.click('button:has-text("착공금 승인하기")'); await o.waitForSelector('[data-stage=DEPOSIT] >> text=승인 완료');
  ok(ms(cid).DEPOSIT === 'RELEASED', 'deposit released (record only)');
  ok(ms(cid).INTERIM === 'LOCKED', 'interim locked until materials');
  await o.screenshot({ path: `${SP}/shots/p6-01-contract.png`, fullPage: true });

  // 업체: 착공 → 자재 입고 보고
  await c.goto(B + '/contractor/projects');
  await c.click('button:has-text("착공")'); await c.waitForSelector('text=자재 입고 보고');
  ok(await c.isVisible('text=단계별 지급 (데모 · 실제 송금 없음)'), 'contractor sees milestone strip');
  await c.click('text=📦 자재 입고 보고'); await c.waitForSelector('text=/자재 입고 보고 \\d/');
  ok(ms(cid).INTERIM === 'READY', 'interim ready after materials report');
  await o.goto(B + `/customer/contracts/${cid}`);
  await o.click('button:has-text("중도금 승인하기")'); await o.waitForSelector('[data-stage=INTERIM] >> text=승인 완료');
  ok(ms(cid).COMPLETION === 'LOCKED', 'completion locked until inspection');

  // 완료 보고 → 준공 검측(수동 모드)
  await c.goto(B + '/contractor/projects');
  await c.setInputFiles('input[name=photos]', IMG);
  await c.click('text=완료 보고 올리기'); await c.waitForSelector('text=준공 검측 · 자재 LOT 입력');
  await c.fill('input[name=lotNumber]', 'PVC-2026-0412-A'); await c.setInputFiles('input[name=lotPhotos]', IMG);
  await c.click('button:has-text("LOT · 라벨 저장")'); await c.waitForSelector('text=저장했어요.');
  const insp = sql(`select i.source, i.checklistJson from CompletionInspection i join Project p on p.id=i.projectId where p.contractId='${cid}'`)[0];
  const items = JSON.parse(insp.checklistJson);
  ok(insp.source === 'manual' && items.every((x) => x.verdict === 'UNKNOWN'), 'manual mode without AI key');
  ok(items[0].item.startsWith('계약 규격대로 시공'), 'spec items auto-generated from contract');

  await o.goto(B + `/customer/contracts/${cid}/inspection`);
  ok(await o.isVisible('text=수동 모드') && await o.isVisible('text=/최종 승인은 반드시 건물주가/'), 'owner-final notice');
  ok(await o.isVisible('text=슬라이더 비교') && await o.isVisible('img[alt="시공 후"]'), 'before/after viewer');
  ok(await o.isVisible('text=PVC-2026-0412-A'), 'LOT number shown');
  ok(await o.isVisible('text=/아직 비교할 이웃 세대|이웃 세대 \\d+곳/'), 'cross-check panel');
  await o.click('button:has-text("준공 검측 승인하기")'); await o.waitForSelector('text=/아직 확인하지 않은 항목이 \\d+개/');
  ok(true, 'cannot approve with unchecked items');
  const n = items.length;
  for (let i = 0; i < n; i++) {
    const v = i === 1 ? 'X' : 'O';
    await o.click(`[data-item="${i}"] button[value=${v}]`);
    await o.waitForSelector(`[data-item="${i}"] button[value=${v}][aria-pressed=true]`);
  }
  await o.click('button:has-text("준공 검측 승인하기")'); await o.waitForSelector('text=/미흡\\(X\\) 항목이 있어요/');
  ok(true, 'issues require explicit acceptance');
  await o.screenshot({ path: `${SP}/shots/p6-02-inspection.png`, fullPage: true });
  await o.check('input[name=acceptIssues]'); await o.click('button:has-text("준공 검측 승인하기")');
  await o.waitForSelector('text=✔ 건물주 승인 완료');
  const score = sql(`select score from CompletionInspection i join Project p on p.id=i.projectId where p.contractId='${cid}'`)[0].score;
  ok(Math.abs(score - (n - 1) / n) < 1e-9, 'pass rate recorded ' + score);
  ok(ms(cid).COMPLETION === 'READY', 'completion payment opened by owner inspection approval');

  await o.goto(B + `/customer/contracts/${cid}`);
  await o.click('button:has-text("준공금 승인하기")'); await o.waitForSelector('[data-stage=COMPLETION] >> text=승인 완료');
  ok(ms(cid).RETENTION === 'LOCKED' && await o.isVisible('text=/해제 예정/'), 'retention held for 90 days');
  await o.click('text=데모: 유보 기간 경과 처리'); await o.waitForSelector('button:has-text("A/S 유보금 승인하기")');
  await o.click('button:has-text("A/S 유보금 승인하기")'); await o.waitForSelector('[data-stage=RETENTION] >> text=승인 완료');
  ok(Object.values(ms(cid)).every((s) => s === 'RELEASED'), 'all stages released');
  await o.screenshot({ path: `${SP}/shots/p6-03-paid.png`, fullPage: true });

  // 업체 화면 반영 · 다른 사용자 접근 불가
  await c.goto(B + '/contractor/projects');
  ok(await c.isVisible('text=/준공 검측 건물주 승인 완료 · LOT PVC-2026-0412-A/'), 'contractor sees approval + LOT');
  const other = await loginAs(browser, 'customer@demo.kr');
  const r = await other.goto(B + `/customer/contracts/${cid}`);
  await other.waitForTimeout(500); ok((await other.content()).includes('찾는 화면이 없어요') && !(await other.content()).includes('계약 요약서'), 'other owners cannot open contract (' + r.status() + ')');
  ok([o, c, admin].every((x) => x.errors.length === 0), 'no page errors ' + [o, c, admin].flatMap((x) => x.errors).join('|'));
  await browser.close();
})().catch((e) => { console.error('FAIL: exception', e); process.exit(1); });
