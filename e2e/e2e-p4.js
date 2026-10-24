// P4 사진 진단(규칙 기반, AI 키 없음) · 단열 기준 비교 · 성공 가이드 · 체크리스트 → 내 공사 할 일
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
(async () => {
  const browser = await chromium.launch();
  const p = await loginAs(browser, 'customer@demo.kr');
  await p.goto(B + '/customer/diagnosis');
  await p.click('text=사진으로 진단'); await p.waitForURL(/\/photo$/);
  ok(await p.isVisible('text=규칙 기반 (AI 키 없음)'), 'rule-based mode shown when no AI key');
  ok(await p.getAttribute('input[name=photo0]', 'capture') === 'environment', 'camera capture supported');
  await p.click('button:has-text("사진으로 진단받기")');
  await p.waitForSelector('text=사진을 한 장 이상 올려주세요');
  ok(true, 'requires at least one photo');

  await p.setInputFiles('input[name=photo0]', IMG);
  await p.setInputFiles('input[name=photo1]', IMG);
  await p.waitForSelector('img[alt="사진 2 미리보기"]');
  await p.fill('input[name=note1]', '겨울마다 벽 모서리에 곰팡이와 결로');
  await p.fill('textarea[name=memo]', '북쪽 방이 유난히 추워요');
  await p.screenshot({ path: `${SP}/shots/p4-01-upload.png`, fullPage: true });
  await p.click('button:has-text("사진으로 진단받기")');
  await p.waitForURL(/\/photo\/c[a-z0-9]+$/, { timeout: 60000 });
  ok(await p.isVisible('text=규칙 기반 추정') && await p.isVisible('text=/정밀 진단을 대체하지 않습니다/'), 'result labelled + disclaimer');
  const loaded = await p.evaluate(() => Promise.all([...document.querySelectorAll('figure img')].map((i) => i.decode().then(() => true, () => false))));
  ok(loaded.length === 2 && loaded.every(Boolean), 'uploaded photos shown (resized in browser)');
  const wall = p.locator('div.rounded-3xl', { hasText: '곰팡이' }).first();
  ok(!(await wall.locator('text=지켜보기').count()), 'wall with mold note not LOW severity');
  ok(await p.isVisible('text=노후도 점수') && await p.isVisible('text=1순위'), 'aging score + prioritized recommendations');
  ok(await p.isVisible('text=/가정 단가/') && await p.isVisible('text=/지원사업 대상 가능성/'), 'cost basis + subsidy possibility');
  ok(await p.isVisible('text=지을 때 단열 기준 vs 지금 기준') && await p.isVisible('text=/가정 기반: 건축물의 에너지절약설계기준/'), 'insulation standards comparison (assumption-labelled)');
  ok(!(await p.isVisible('text=/열화상 모드|IR 모드/')), 'no fake thermal toggle');
  await p.screenshot({ path: `${SP}/shots/p4-02-result.png`, fullPage: true });
  const r = sql("select source, provider from PhotoDiagnosisResult")[0];
  ok(r.source === 'rule' && r.provider === 'rule', 'result stored as rule-based');
  const doc = sql("select id, mimeType from Document where kind='DIAGNOSIS_PHOTO' limit 1")[0];
  ok(doc.mimeType === 'image/jpeg', 'photo converted to JPEG before upload');

  // 다른 사용자는 진단 사진을 볼 수 없다
  const c = await loginAs(browser, 'contractor@demo.kr');
  const resp = await c.goto(B + '/files/' + doc.id);
  ok(resp.status() === 404, 'diagnosis photo private to owner');

  // 성공 가이드
  await p.click('text=📘 전문가 가이드 보기'); await p.waitForURL(/\/guide$/);
  await p.click('label:has-text("단계적 시공형")');
  await p.click('button:has-text("가이드 만들기")'); await p.waitForURL(/guide\?g=/);
  for (const t of ['우리 집 구조 특성과 약한 곳', '숨은 리스크', '성공 핵심 4가지', '단계별 체크리스트', '최종 제언'])
    ok(await p.isVisible(`text=${t}`), 'guide section: ' + t);
  ok(await p.isVisible('text=단계적 시공형') && await p.isVisible('text=규칙 기반 가이드'), 'strategy + source label');
  ok(await p.locator('text=전문가 확인 필요').count() >= 2, 'expert-check items flagged');
  ok(await p.isVisible('text=착공 전') && await p.isVisible('text=시공 중') && await p.isVisible('text=준공 후'), 'three phases');
  await p.screenshot({ path: `${SP}/shots/p4-03-guide.png`, fullPage: true });

  await p.click('button:has-text("내 공사 할 일로 가져가기")'); await p.waitForURL(/projects\?checklist=1/);
  ok(await p.isVisible('text=체크리스트를 할 일로 가져왔어요') && await p.isVisible('text=공사 할 일'), 'checklist imported to 내 공사');
  const total = sql("select count(*) n from ChecklistItem")[0].n;
  ok(total >= 9, 'checklist items saved: ' + total);
  await p.click('button[aria-pressed=false] >> nth=0');
  await p.waitForSelector(`text=1/${total} 완료`);
  ok(true, 'toggle todo done');
  await p.screenshot({ path: `${SP}/shots/p4-04-todos.png`, fullPage: true });

  // 다른 전략으로 다시 만들어 가져오면 끝낸 항목은 남고 나머지는 교체
  await p.goto(B + '/customer/diagnosis'); await p.click('text=성공 가이드'); await p.waitForURL(/\/guide$/);
  await p.click('label:has-text("비용 절감형")'); await p.click('button:has-text("이 전략으로 다시 만들기")'); await p.waitForURL(/guide\?g=/);
  ok(await p.isVisible('text=비용 절감형 >> nth=1') || await p.isVisible('span:has-text("비용 절감형")'), 'regenerated with COST');
  await p.click('button:has-text("내 공사 할 일로 가져가기")'); await p.waitForURL(/projects\?checklist=1/);
  ok(sql("select count(*) n from ChecklistItem where done=1")[0].n === 1, 'done item kept after re-import');
  ok(sql("select count(distinct guideId) n from ChecklistItem")[0].n === 2, 'new guide items replaced open ones');
  ok(p.errors.length === 0, 'no page errors ' + p.errors.join(','));
  await browser.close();
})().catch((e) => { console.error('FAIL: exception', e); process.exit(1); });
