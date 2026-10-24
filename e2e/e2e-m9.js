const { chromium } = require('playwright');
require('./patch.js');
const { execSync } = require('child_process');
const SP = __dirname;
const B = 'http://localhost:3000';
const ok = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
const sql = (q) => JSON.parse(execSync(`python3 ${SP}/q.py ` + JSON.stringify(q)).toString());
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, locale: 'ko-KR' });
  const p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(B + '/login'); await p.fill('input[name=email]', 'admin@demo.kr'); await p.fill('input[name=password]', 'demo1234'); await p.click('button[type=submit]'); await p.waitForURL(B + '/admin');
  for (const [href, text] of [['/admin/contractors', '사업자 가입 심사'], ['/admin/clusters', 'AI 매칭 실행'], ['/admin/tenders', '입찰 관리'], ['/admin/reviews', 'PQ 규칙'], ['/admin/monitoring', '담합 의심 플래그'], ['/admin/settings', '가격 가정치']]) {
    await p.goto(B + href); ok(await p.isVisible(`text=${text}`), `${href} renders`);
  }
  await p.goto(B + '/admin/monitoring');
  ok(await p.isVisible('text=입찰가 근접'), 'seeded close-price flag shown');
  await p.screenshot({ path: `${SP}/shots/m9-01-monitoring.png`, fullPage: true });
  await p.click('button:has-text("무혐의 처리")'); await p.waitForSelector('text=무혐의');
  ok(sql("select count(*) n from CollusionFlag where status='DISMISSED'")[0].n === 1, 'flag dismissed');

  await p.goto(B + '/admin/settings');
  const sec = p.locator('details', { hasText: 'AI 매칭' });
  await sec.locator('summary').click();
  const ta = sec.locator('textarea');
  const cur = JSON.parse(await ta.inputValue());
  await ta.fill(JSON.stringify({ ...cur, radiusKm: 'three' }));
  await sec.locator('button:has-text("저장")').click(); await p.waitForSelector('text=radiusKm: number 이어야 해요');
  ok(true, 'invalid type rejected');
  await ta.fill(JSON.stringify({ ...cur, radiusKm: 2.5 }, null, 2));
  await sec.locator('button:has-text("저장")').click(); await p.waitForSelector('text=저장했어요');
  ok(JSON.parse(sql("select valueJson from Config where key='matching'")[0].valueJson).radiusKm === 2.5, 'override saved');
  await p.screenshot({ path: `${SP}/shots/m9-02-settings.png`, fullPage: true });
  await p.reload(); await p.locator('details', { hasText: 'AI 매칭' }).locator('summary').click();
  await p.locator('details', { hasText: 'AI 매칭' }).locator('button:has-text("기본값으로 되돌리기")').click();
  await p.waitForSelector('text=저장했어요');
  ok(sql("select count(*) n from Config where key='matching'")[0].n === 0, 'reset to defaults');
  await p.goto(B + '/admin/clusters'); await p.click('button:has-text("AI 매칭 실행")'); await p.waitForLoadState('networkidle');
  ok(await p.isVisible('text=AI 제안'), 'matching rerun from admin');
  await p.screenshot({ path: `${SP}/shots/m9-03-clusters.png`, fullPage: true });
  ok(errors.length === 0, 'no page errors ' + errors.join('|'));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
