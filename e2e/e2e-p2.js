// P2 숨은 지원금: 매칭 · 우대 · 계산기 · 상담(규칙 기반) · 관리자 DB
const { chromium } = require('playwright');
require('./patch.js');
const { execSync } = require('child_process');
const SP = __dirname;
const B = 'http://localhost:3000';
const ok = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
const sql = (q) => JSON.parse(execSync(`python3 ${SP}/q.py ` + JSON.stringify(q)).toString());
async function loginAs(browser, email, w = 390) {
  const c = await browser.newContext({ viewport: { width: w, height: 900 }, locale: 'ko-KR' });
  const p = await c.newPage(); p.errors = []; p.on('pageerror', (e) => p.errors.push(e.message));
  await p.goto(B + '/login'); await p.fill('input[name=email]', email); await p.fill('input[name=password]', 'demo1234'); await p.click('button[type=submit]');
  await p.waitForURL((u) => !u.pathname.startsWith('/login'));
  return p;
}
(async () => {
  const browser = await chromium.launch();
  const p = await loginAs(browser, 'customer@demo.kr');
  ok(await p.isVisible('text=숨은 지원금 확인하기'), 'home entry card');
  await p.click('text=숨은 지원금 확인하기'); await p.waitForURL(/customer\/subsidy/);
  ok(await p.isVisible('text=2026 민간 건축물 그린리모델링 이자지원사업'), 'active program listed');
  ok(!(await p.isVisible('text=컨설팅 지원사업')), 'unverified program hidden from customers');
  ok(await p.isVisible('text=공고문 확인 필요'), 'notice-verification badge');
  ok(await p.isVisible('text=조건 확인 필요'), 'needs-check before diagnosis');
  await p.screenshot({ path: `${SP}/shots/p2-01-subsidy.png`, fullPage: true });

  // 진단 → 성능개선률 반영
  await p.goto(B + '/customer/diagnosis'); await p.click('button:has-text("간이 진단 받기")'); await p.waitForURL(/diagnosis\?d=/);
  ok(await p.isVisible('text=이 진단으로 숨은 지원금 확인하기'), 'diagnosis → subsidy entry');
  await p.click('text=이 진단으로 숨은 지원금 확인하기'); await p.waitForURL(/customer\/subsidy/);
  ok(await p.isVisible('text=/예상 성능개선률/'), 'improvement rate from diagnosis used');
  ok(await p.isVisible('text=연 4.5%'), 'general rate 4.5%');
  await p.click('label:has-text("신혼부부")'); await p.click('text=다시 확인하기');
  await p.waitForSelector('text=연 5.5%');
  ok(await p.isVisible('text=우대 조건') && (await p.inputValue('label:has-text("이자 지원율") input')) === '5.5', 'preferential rate 5.5% for 신혼부부 (card + calculator)');
  ok(await p.isVisible('text=다가구주택 대출 한도') && await p.isVisible('text=1억 원'), '다가구(단독주택) limit 1억');
  const before = await p.textContent('text=/이자 절감 예상/');
  await p.fill('label:has-text("공사비") input', '10000000'); await p.waitForTimeout(300);
  const after = await p.textContent('text=/이자 절감 예상/');
  ok(before !== after, 'calculator recalculates');
  await p.screenshot({ path: `${SP}/shots/p2-02-pref-calc.png`, fullPage: true });

  // 상담
  await p.click('text=지원금 상담하기'); await p.waitForURL(/advisor/);
  await p.click('button:has-text("신청 순서가 어떻게 되나요?")');
  await p.waitForSelector('text=※ 실제 적용 여부는 공고문과 관할 기관 확인이 필요합니다.');
  ok(await p.isVisible('text=규칙 기반 답변'), 'rule-based answer label (no AI key)');
  ok(await p.isVisible('a[href="https://v.daum.net/v/20260326043356184"]'), 'source link in answer');
  ok(await p.isVisible('text=/사업확인서/'), 'answer grounded in DB steps');
  await p.screenshot({ path: `${SP}/shots/p2-03-advisor.png`, fullPage: true });
  ok(sql("select count(*) n from AdvisorChatMessage")[0].n === 2, 'chat stored');

  // 관리자
  const a = await loginAs(browser, 'admin@demo.kr', 1100);
  await a.goto(B + '/admin/subsidies'); ok(await a.isVisible('text=검증 필요'), 'admin sees unverified program');
  await a.goto(B + '/admin/subsidies/new');
  await a.fill('input[name=name]', '대구 테스트 지원사업'); await a.fill('input[name=provider]', '테스트구청'); await a.fill('input[name=summary]', '테스트용 지원사업 요약입니다');
  await a.selectOption('select[name=status]', 'ACTIVE'); await a.click('button:has-text("저장")');
  await a.waitForSelector('text=출처 링크가 없는 지원사업은');
  ok(true, 'cannot publish without source');
  await a.fill('textarea[name=benefitJson]', '{"tenPercentBonus": 10}'); await a.selectOption('select[name=status]', 'UNVERIFIED'); await a.click('button:has-text("저장")');
  await a.waitForSelector('text=요건·혜택 JSON 을 확인해주세요');
  ok(true, 'unknown benefit keys rejected');
  await a.fill('textarea[name=benefitJson]', '{}'); await a.click('button:has-text("저장")'); await a.waitForURL(B + '/admin/subsidies');
  ok(await a.isVisible('text=대구 테스트 지원사업'), 'program created as unverified');
  await a.locator('div.rounded-3xl', { hasText: '2026 민간 건축물' }).first().locator('button:has-text("오늘 공고문 확인함")').click(); await a.waitForTimeout(800);
  await p.goto(B + '/customer/subsidy');
  ok(!(await p.isVisible('text=공고문 확인 필요')), 'badge removed after admin verification');
  ok([p, a].every((x) => x.errors.length === 0), 'no page errors ' + [p, a].flatMap((x) => x.errors).join('|'));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
