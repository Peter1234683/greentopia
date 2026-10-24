const { chromium } = require('playwright');
require('./patch.js');
const SP = __dirname;
const B = 'http://localhost:3000';
const ok = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
(async () => {
  const browser = await chromium.launch();
  const ctx = () => browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR' });
  const shot = (p, n) => p.screenshot({ path: `${SP}/shots/${n}.png`, fullPage: true });

  // 비로그인 접근 차단
  let c = await ctx(); let p = await c.newPage();
  await p.goto(B + '/customer'); ok(p.url().endsWith('/login'), 'unauth /customer → /login');
  await p.goto(B); await shot(p, '01-splash');
  await p.click('text=시작하기'); await p.waitForURL('**/onboarding'); await shot(p, '02-onboarding');

  // 고객 가입: 검증 오류 후 입력값 유지
  await p.click('text=내 집을 고치고 싶어요'); await p.waitForURL('**/signup/customer');
  await p.fill('input[name=name]', '테스트'); await p.fill('input[name=phone]', '123');
  await p.fill('input[name=email]', 'new1@test.kr'); await p.fill('input[name=password]', 'abcdefgh');
  await p.click('button[type=submit]'); await p.waitForSelector('text=연락처 형식을 확인해주세요');
  ok(await p.inputValue('input[name=name]') === '테스트', 'values kept after validation error');
  await shot(p, '03-signup-customer-error');
  await p.fill('input[name=phone]', '010-1111-2222'); await p.fill('input[name=password]', 'abcdefgh');
  await p.click('button[type=submit]'); await p.waitForURL(B + '/customer'); await shot(p, '04-customer-home-new');
  ok(await p.isVisible('text=내 건물 등록하기'), 'new customer sees register CTA');
  await p.goto(B + '/contractor'); ok(p.url().endsWith('/customer'), 'customer blocked from /contractor');
  await c.close();

  // 사업자 가입 (증빙 업로드)
  c = await ctx(); p = await c.newPage();
  await p.goto(B + '/signup/contractor');
  await p.fill('input[name=companyName]', '테스트창호'); await p.fill('input[name=ceoName]', '홍길동');
  await p.fill('input[name=bizRegNo]', '1234567890'); await p.fill('input[name=phone]', '053-111-2222');
  await p.fill('input[name=email]', 'newc@test.kr'); await p.fill('input[name=password]', 'abcdefgh');
  await p.click('text=창호'); await p.click('label:has-text("남구")');
  await p.click('fieldset >> text=예 >> nth=0');
  await p.fill('input[name=grRegNo]', 'GR-TEST-1');
  await p.setInputFiles('input[name=grCert]', { name: 'gr.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') });
  await p.fill('input[name=constructionLicense]', '실내건축공사업');
  await p.locator('input[name=warrantyAvailable][value=yes]').check({ force: true });
  await shot(p, '05-signup-contractor');
  await p.click('button[type=submit]'); await p.waitForURL(B + '/contractor', { timeout: 15000 });
  ok(await p.isVisible('text=가입 심사를 기다리고 있어요'), 'new contractor is pending');
  await shot(p, '06-contractor-pending');
  await c.close();

  // 관리자 승인
  c = await ctx(); p = await c.newPage();
  await p.goto(B + '/login'); await p.click('text=관리자'); await p.click('button[type=submit]');
  await p.waitForURL(B + '/admin'); await p.setViewportSize({ width: 1100, height: 900 }); await p.goto(B + '/admin/contractors'); await shot(p, '07-admin');
  const card = p.locator('div', { hasText: '테스트창호' }).filter({ has: p.locator('button:has-text("승인")') }).last();
  const href = await card.locator('a[href^="/files/"]').first().getAttribute('href');
  const fileRes = await p.request.get(B + href); ok(fileRes.status() === 200, 'admin can open uploaded doc');
  await card.locator('button:has-text("승인")').click();
  await p.waitForTimeout(800);
  ok(JSON.parse(require('child_process').execSync('python3 ' + __dirname + '/q.py ' + JSON.stringify("select reviewStatus from ContractorProfile where companyName='테스트창호'")).toString())[0].reviewStatus === 'APPROVED', 'contractor approved');
  await c.close();

  // 다른 사용자는 증빙 파일 접근 불가
  c = await ctx(); p = await c.newPage();
  await p.goto(B + '/login'); await p.click('text=건물주'); await p.click('button[type=submit]'); await p.waitForURL(B + '/customer');
  ok((await p.request.get(B + href)).status() === 404, 'other user cannot open doc');
  await shot(p, '08-customer-home-demo');
  await p.goto(B + '/customer/my'); await p.click('button[role=switch]'); await p.waitForTimeout(600);
  ok(await p.evaluate(() => document.documentElement.classList.contains('text-large')), 'large text toggles');
  await shot(p, '09-my-large');
  await p.goto(B + '/customer/joint'); await shot(p, '10-joint-placeholder');
  await c.close();

  // 승인된 업체 대시보드
  c = await ctx(); p = await c.newPage();
  await p.goto(B + '/login'); await p.click('text=시공업체'); await p.click('button[type=submit]'); await p.waitForURL(B + '/contractor');
  await shot(p, '11-contractor-home');
  await p.goto(B + '/contractor/company'); await shot(p, '12-contractor-company');
  await p.goto(B + '/login'); 
  await c.close();

  // 잘못된 로그인
  c = await ctx(); p = await c.newPage();
  await p.goto(B + '/login'); await p.fill('input[name=email]', 'customer@demo.kr'); await p.fill('input[name=password]', 'wrong');
  await p.click('button[type=submit]'); await p.waitForSelector('text=이메일 또는 비밀번호가 맞지 않아요');
  ok(true, 'bad password rejected');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
