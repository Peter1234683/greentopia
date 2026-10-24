// P8 데모 모드(역할 전환 · 시나리오 점프 · 시드 초기화) · 온보딩 다시 보기 · PWA 설치 안내
const { chromium, devices } = require('playwright');
require('./patch.js');
const { execSync } = require('child_process');
const SP = __dirname;
const B = 'http://localhost:3000';
const ok = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
const sql = (q) => JSON.parse(execSync(`python3 ${SP}/q.py ` + JSON.stringify(q.replace(/\s+/g, ' '))).toString());
async function loginAs(browser, email, opts = {}) {
  const c = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'ko-KR', ...opts });
  const p = await c.newPage(); p.errors = []; p.on('pageerror', (e) => p.errors.push(e.message));
  await p.goto(B + '/login'); await p.fill('input[name=email]', email); await p.fill('input[name=password]', 'demo1234'); await p.click('button[type=submit]');
  await p.waitForURL((u) => !u.pathname.startsWith('/login'));
  return p;
}
(async () => {
  const browser = await chromium.launch();

  // 헤더 데모 메뉴: ?demo=1 로 들어온 경우만 (운영자는 항상)
  const plain = await loginAs(browser, 'customer@demo.kr');
  ok(!(await plain.isVisible('a[aria-label="데모 모드"]')), 'no demo menu by default');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'ko-KR' });
  const p = await ctx.newPage(); p.errors = []; p.on('pageerror', (e) => p.errors.push(e.message));
  await p.goto(B + '/login?demo=1'); await p.fill('input[name=email]', 'customer@demo.kr'); await p.fill('input[name=password]', 'demo1234'); await p.click('button[type=submit]');
  await p.waitForURL(B + '/customer');
  ok(await p.isVisible('a[aria-label="데모 모드"]'), 'demo menu after ?demo=1');
  const a = await loginAs(browser, 'admin@demo.kr');
  ok(await a.isVisible('a[aria-label="데모 모드"]'), 'admin always sees demo menu');

  // 데모 화면: 역할 빠른 전환
  await p.click('a[aria-label="데모 모드"]'); await p.waitForURL(/\/demo$/);
  ok(await p.isVisible('text=시연 시나리오 바로가기') && (await p.locator('ol >> li').count()) === 9, '9-step scenario');
  await p.click('button:has-text("🛠️ 시공업체")'); await p.waitForURL(B + '/contractor');
  ok(await p.isVisible('text=푸른창호이엔지'), 'switched to contractor');
  await p.screenshot({ path: `${SP}/shots/p8-01-switch.png`, fullPage: true });

  // 시나리오 점프
  const jump = async (n, url, text) => {
    await p.goto(B + '/demo');
    await p.click(`li:nth-child(${n}) button`); await p.waitForURL(url);
    ok(await p.isVisible(`text=${text}`), `jump ${n}: ${text}`);
  };
  await jump(1, /\/photo$/, '사진으로 진단받기');
  await jump(2, /customer\/subsidy/, '2026 민간 건축물 그린리모델링 이자지원사업');
  await jump(3, /customer\/joint/, 'AI가 찾은 공동공사');
  await jump(4, /contractor\/tenders/, '입찰 공고');
  await jump(5, /admin\/tenders\//, '입찰');
  await jump(6, /customer\/contracts\/[^/]+$/, '계약 요약서');
  ok(await p.locator('text=승인 완료').count() >= 3, 'paid stages shown in scenario 6');
  await jump(7, /inspection$/, '준공 검측');
  await jump(8, /reviews\/new/, '리뷰');
  await jump(9, /contractor\/company/, '안심 보장제');
  await p.screenshot({ path: `${SP}/shots/p8-02-demo.png`, fullPage: true });

  // 온보딩 (첫 방문 배너 → 슬라이드 → 시작하기) · 다시 보기
  await p.goto(B + '/demo'); await p.click('button:has-text("🏠 건물주")'); await p.waitForURL(B + '/customer');
  ok(await p.isVisible('text=그린토피아 처음이세요?'), 'first-visit banner');
  await p.click('text=그린토피아 처음이세요?'); await p.waitForURL(/welcome/);
  for (let i = 0; i < 3; i++) await p.click('button:has-text("다음")');
  await p.click('button:has-text("시작하기")'); await p.waitForURL(B + '/customer');
  ok(!(await p.isVisible('text=그린토피아 처음이세요?')), 'banner gone after onboarding');
  ok(sql("select onboardedAt from CustomerProfile cp join User u on u.id=cp.userId where u.email='customer@demo.kr'")[0].onboardedAt != null, 'onboardedAt saved');
  await p.click('a[aria-label="마이 페이지"]'); await p.click('text=온보딩 다시 보기'); await p.waitForURL(/welcome\?replay=1/);
  for (let i = 0; i < 3; i++) await p.click('button:has-text("다음")');
  ok(await p.isVisible('text=마이로 돌아가기'), 'replay ends back to 마이');

  // 시드 초기화 → 데이터 원상복구 + 고른 역할로 재로그인
  await p.goto(B + '/customer/community/new');
  await p.click('label:has-text("우리동네 Q&A")'); await p.fill('input[name=title]', '초기화 전 임시 글'); await p.fill('textarea[name=body]', '데모 초기화 확인용 글이에요.');
  await p.click('button:has-text("글 올리기")'); await p.waitForURL(/community\/c/);
  ok(sql("select count(*) n from CommunityPost where title='초기화 전 임시 글'")[0].n === 1, 'temp post created');
  await p.goto(B + '/demo');
  await p.selectOption('select[name=role]', 'CUSTOMER');
  await p.click('button:has-text("초기화")'); await p.waitForURL(/customer\?reset=1/, { timeout: 180000 });
  ok(sql("select count(*) n from CommunityPost where title='초기화 전 임시 글'")[0].n === 0, 'seed reset removes demo changes');
  ok(await p.isVisible('text=그린토피아 처음이세요?'), 're-logged in as fresh demo customer');

  // PWA 설치 안내: Android(beforeinstallprompt) · iOS(안내 시트) · 설치됨(standalone) 숨김
  const and = await loginAs(browser, 'customer@demo.kr');
  ok(!(await and.isVisible('[data-testid=install-prompt]')), 'hidden until install is possible');
  await and.evaluate(() => {
    const e = new Event('beforeinstallprompt');
    e.prompt = async () => { window.__prompted = true; };
    e.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(e);
  });
  await and.waitForSelector('[data-testid=install-prompt] >> text=설치');
  await and.click('[data-testid=install-prompt] >> text=설치');
  await and.waitForSelector('[data-testid=install-prompt]', { state: 'detached' });
  ok(await and.evaluate(() => window.__prompted === true), 'android: native install prompt called');

  const iphone = devices['iPhone 13'];
  const ios = await loginAs(browser, 'customer@demo.kr', { userAgent: iphone.userAgent, viewport: { width: 390, height: 844 } });
  await ios.waitForSelector('[data-testid=install-prompt]');
  await ios.click('[data-testid=install-prompt] >> text=방법 보기');
  ok(await ios.isVisible('[role=dialog] >> text=홈 화면에 추가'), 'iOS: add-to-home sheet');
  await ios.screenshot({ path: `${SP}/shots/p8-03-ios.png` });
  await ios.click('text=알겠어요');
  await ios.click('[data-testid=install-prompt] [aria-label=닫기]');
  await ios.reload(); await ios.waitForTimeout(500);
  ok(!(await ios.isVisible('[data-testid=install-prompt]')), 'dismissal remembered');

  const sa = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', userAgent: iphone.userAgent });
  await sa.addInitScript(() => Object.defineProperty(navigator, 'standalone', { get: () => true }));
  const sp = await sa.newPage();
  await sp.goto(B + '/login'); await sp.fill('input[name=email]', 'customer@demo.kr'); await sp.fill('input[name=password]', 'demo1234'); await sp.click('button[type=submit]');
  await sp.waitForURL(B + '/customer'); await sp.waitForTimeout(500);
  ok(!(await sp.isVisible('[data-testid=install-prompt]')), 'standalone: install prompt hidden');

  ok([p, a, and, ios].every((x) => x.errors.length === 0), 'no page errors ' + [p, a, and, ios].flatMap((x) => x.errors).join('|'));
  await browser.close();
})().catch((e) => { console.error('FAIL: exception', e); process.exit(1); });
