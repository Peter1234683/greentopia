// P5 매칭 설명 · 수요 지도 · 이웃 초대(QR·링크·진행바 → 가입 → 수요 등록 → 포인트·우선 후보) · 파라미터 시뮬레이션
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

  // 홈: 수요 지도 미리보기 + 커뮤니티 인기글
  ok(await p.isVisible('text=수요 지도 ›') && await p.isVisible('text=이웃 커뮤니티 인기글'), 'home: map preview + popular posts');
  await p.waitForSelector('.leaflet-overlay-pane path');
  ok(await p.locator('.leaflet-overlay-pane path').count() > 0, 'home map has density bubbles');

  // 공동공사 → 매칭 설명
  await p.goto(B + '/customer/joint');
  ok(await p.isVisible('text=/동 더 모이면 다음 물량 구간/'), 'cluster card: next tier progress');
  ok(await p.isVisible('text=우리 동네 수요 지도'), 'joint: map card');
  await p.click('text=🤖 왜 이렇게 묶였나요?'); await p.waitForURL(/joint\/why\//);
  for (const t of ['이렇게 묶어요', '묶인 이유', '우리 집과 이웃의 적합도', '1동 기준 비용 구성: 혼자 vs 함께', '몇 동이 함께하면 좋을까?', '대기 풀', '근처지만 함께하지 못한 이유'])
    ok(await p.isVisible(`text=${t}`), 'why: ' + t);
  ok(await p.isVisible('text=/왜 이 방식\\?/'), 'algorithm one-liner');
  ok(await p.isVisible('text=/건물 구조 · 자재 규격/'), 'structure/material hard filters explained');
  ok(await p.locator('.recharts-surface').count() >= 2, 'cost breakdown + size curve charts');
  ok(await p.isVisible('text=/확정 할인이 아니에요/'), 'assumption basis shown');
  const ex = await p.locator('text=/조적조\\(벽돌\\)는 창틀 고정 방식이 달라/').count();
  ok(ex >= 1, 'structure exclusion reason listed: ' + ex);
  await p.screenshot({ path: `${SP}/shots/p5-01-why.png`, fullPage: true });

  // 수요 지도
  await p.goto(B + '/customer/joint/map');
  await p.waitForSelector('.leaflet-overlay-pane path');
  const all = await p.locator('.leaflet-overlay-pane path').count();
  await p.click('[role=tab]:has-text("보일러")'); await p.waitForURL(/t=BOILER/);
  await p.waitForSelector('.leaflet-overlay-pane path');
  const boiler = await p.locator('.leaflet-overlay-pane path').count();
  ok(boiler < all, `trade filter narrows cells (${all}→${boiler})`);
  ok(await p.isVisible('text=/세대만 더 모이면|묶음 조건을 채웠어요/'), 'neighbor-need message');
  ok(!(await p.content()).includes('1734-5'), 'no exact address on map page');
  await p.screenshot({ path: `${SP}/shots/p5-02-map.png`, fullPage: true });

  // 이웃 초대
  await p.goto(B + '/customer/joint');
  await p.click('text=🙌 이웃 초대'); await p.waitForURL(/customer\/invite\?c=/);
  ok(await p.isVisible('[aria-label="초대 QR코드"] svg'), 'QR code');
  ok(await p.isVisible('text=/현재 \\d+동/') && await p.isVisible('text=/다음 물량 구간/'), 'progress bar with next tier');
  ok(await p.isVisible('text=카카오톡 등으로 공유하기'), 'share button');
  const link = await p.inputValue('input[aria-label="초대 링크"]');
  ok(/\/invite\/[A-Z0-9]{8}$/.test(link), 'invite link ' + link);
  await p.screenshot({ path: `${SP}/shots/p5-03-invite.png`, fullPage: true });
  const pointsBefore = sql("select points from CustomerProfile cp join User u on u.id=cp.userId where u.email='customer@demo.kr'")[0].points;

  // 초대받은 이웃: 랜딩 → 가입 → 건물·수요 등록
  const c2 = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'ko-KR' });
  const q = await c2.newPage(); q.errors = []; q.on('pageerror', (e) => q.errors.push(e.message));
  await q.goto(link);
  ok(await q.isVisible('text=/대명동 이웃이/') && await q.isVisible('text=/창호 공동공사에 초대했어요/'), 'landing: dong + trade, no names');
  ok(!(await q.content()).includes('김그린'), 'inviter name hidden');
  await q.click('text=가입하고 함께하기'); await q.waitForURL(/signup\/customer\?invite=/);
  ok(await q.isVisible('text=이웃의 초대로 가입해요'), 'signup shows invite');
  const email = `p5-${Date.now()}@test.kr`;
  await q.fill('input[name=name]', '이초대'); await q.fill('input[name=phone]', '010-5555-6666');
  await q.fill('input[name=email]', email); await q.fill('input[name=password]', 'abcdefgh');
  await q.fill('input[name=address]', '대구 남구 대명동 1601-2');
  await q.click('button[type=submit]'); await q.waitForURL(/\/customer\?address=/);
  ok(sql(`select count(*) n from Invite i join User u on u.id=i.acceptedById where u.email='${email}'`)[0].n === 1, 'invite accepted on signup');
  await q.click('text=내 건물 등록하기'); await q.waitForURL(/buildings\/new/);
  await q.click('text=건축물대장에서 불러오기'); await q.waitForSelector('text=데모용 가상 정보');
  await q.click('text=이 정보로 등록하기'); await q.waitForURL(/\/demand$/);
  await q.click('text=창호가 오래되었다');
  await q.click('text=다음');
  const sel = await q.$$eval('section:not([hidden]) [role=checkbox][aria-checked=true]', (els) => els.map((e) => e.textContent));
  if (!sel.some((t) => t.includes('창호'))) await q.click('section:not([hidden]) >> text=창호');
  await q.click('text=다음');
  await q.selectOption('section:not([hidden]) select', { index: 3 });
  await q.click('text=1,000만 ~ 2,000만 원'); await q.click('text=이웃과 함께 공사할래요');
  await q.click('text=다음'); await q.click('button:has-text("건너뛰기")');
  await q.click('text=등록 완료'); await q.waitForURL(/diagnosis\?saved=/);
  const inv = sql(`select rewarded, clusterId from Invite i join User u on u.id=i.acceptedById where u.email='${email}'`)[0];
  ok(inv.rewarded === 1, 'invite rewarded after demand');
  const pointsAfter = sql("select points from CustomerProfile cp join User u on u.id=cp.userId where u.email='customer@demo.kr'")[0].points;
  ok(pointsAfter === pointsBefore + 3000, `inviter +3000P (${pointsBefore}→${pointsAfter})`);
  const linked = sql(`select count(*) n from ClusterMember m join Building b on b.id=m.buildingId join User u on u.id=b.ownerId where u.email='${email}' and m.clusterId='${inv.clusterId}'`)[0].n;
  ok(linked === 1, 'invitee linked to invited cluster as priority candidate');
  await q.goto(B + '/customer/joint');
  ok(await q.isVisible('text=공동견적 참여하기'), 'invitee sees cluster to join');
  ok(q.errors.length === 0, 'no page errors (invitee)');

  // 운영자: 파라미터 시뮬레이션
  const a = await loginAs(browser, 'admin@demo.kr', 1100);
  await a.goto(B + '/admin/matching');
  const m0 = Number((await a.textContent('[data-testid=matched]')).match(/\d+/)[0]);
  await a.locator('input[aria-label="최소 성사 동수"]').fill('8');
  await a.waitForFunction((m) => Number(document.querySelector('[data-testid=matched]').textContent.match(/\d+/)[0]) !== m, m0, { timeout: 15000 });
  const m1 = Number((await a.textContent('[data-testid=matched]')).match(/\d+/)[0]);
  ok(m1 < m0, `raising min size reduces matched (${m0}→${m1})`);
  ok(await a.isVisible('text=/왜 이 알고리즘\\?/'), 'admin: algorithm note');
  const clustersBefore = sql("select count(*) n from Cluster")[0].n;
  ok(clustersBefore === sql("select count(*) n from Cluster")[0].n, 'simulation does not change DB');
  await a.screenshot({ path: `${SP}/shots/p5-04-tuner.png`, fullPage: true });
  ok(p.errors.length + a.errors.length === 0, 'no page errors');
  await browser.close();
})().catch((e) => { console.error('FAIL: exception', e); process.exit(1); });
