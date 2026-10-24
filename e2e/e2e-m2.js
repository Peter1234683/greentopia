const { chromium } = require('playwright');
require('./patch.js');
const { execSync } = require('child_process');
const SP = __dirname;
const B = 'http://localhost:3000';
const ok = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
const sql = (q) => execSync("python3 " + __dirname + "/q.py " + JSON.stringify(q)).toString();
(async () => {
  const browser = await chromium.launch();
  const ctx = () => browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR' });
  const shot = (p, n) => p.screenshot({ path: `${SP}/shots/m2-${n}.png`, fullPage: true });

  let c = await ctx(); let p = await c.newPage();
  const email = `m2-${Date.now()}@test.kr`;
  await p.goto(B + '/signup/customer');
  await p.fill('input[name=name]', '박테스트'); await p.fill('input[name=phone]', '010-2222-3333');
  await p.fill('input[name=email]', email); await p.fill('input[name=password]', 'abcdefgh');
  await p.fill('input[name=address]', '대구 남구 대명동 1520-3');
  await p.click('button[type=submit]'); await p.waitForURL(/\/customer\?address=/);
  await p.click('text=내 건물 등록하기'); await p.waitForURL(/buildings\/new/);
  ok(await p.inputValue('input[placeholder^="대구"]') === '대구 남구 대명동 1520-3', 'signup address carried over');

  await p.fill('input[placeholder^="대구"]', '서울 강남구 역삼동 1');
  await p.click('text=건축물대장에서 불러오기'); await p.waitForSelector('text=대구광역시 주소만 지원해요');
  ok(true, 'non-Daegu address rejected');
  await p.fill('input[placeholder^="대구"]', '대구 남구 대명동 1520-3');
  await p.click('text=건축물대장에서 불러오기'); await p.waitForSelector('text=데모용 가상 정보');
  await shot(p, '01-registry');
  const area = await p.inputValue('input[name=grossArea]');
  const win = await p.inputValue('input[name=windowArea]');
  ok(Number(win) === Math.round(Number(area) * 0.15), `window area estimated (${area}→${win})`);
  await p.fill('input[name=nickname]', '대명동 본가');
  await p.click('text=이 정보로 등록하기'); await p.waitForURL(/\/demand$/);

  // 위저드
  await p.click('text=다음'); // 증상 없이 다음
  await p.click('text=다음'); await p.waitForSelector('text=필요한 공사를 하나 이상');
  ok(true, 'trade required');
  await p.click('text=이전');
  await p.click('text=겨울철 실내가 춥다'); await p.click('text=보일러 교체를 고민 중이다');
  await shot(p, '02-symptoms');
  await p.click('text=다음');
  const checked = await p.$$eval('section:not([hidden]) [role=checkbox][aria-checked=true]', (els) => els.map((e) => e.textContent));
  ok(checked.length === 4, `trades auto-suggested: ${checked.map(t=>t.split('·')[0].trim()).join(',')}`);
  await p.click('section:not([hidden]) >> text=내단열'); // 해제
  await shot(p, '03-trades');
  await p.click('text=다음');
  await p.click('text=다음'); await p.waitForSelector('text=시기·예산·공동공사 의향을 모두');
  await p.selectOption('section:not([hidden]) select', { index: 3 });
  await p.click('text=1,000만 ~ 2,000만 원'); await p.click('text=이웃과 함께 공사할래요');
  await shot(p, '04-timing');
  await p.click('text=다음');
  ok(await p.isVisible('button:has-text("건너뛰기")'), 'bill step skippable');
  await p.fill('input[name=billGas]', '210000');
  await p.setInputFiles('input[name=billPhoto]', { name: 'bill.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) });
  await p.click('text=다음');
  await shot(p, '05-summary');
  await p.click('text=등록 완료'); await p.waitForURL(/diagnosis\?saved=/);
  ok(await p.isVisible('text=공사 수요가 저장됐어요'), 'saved banner');
  await shot(p, '06-hub');

  const row = JSON.parse(sql(`select d.tradesJson, d.symptomsJson, d.billElectric, d.billGas, d.budgetMin, d.jointIntent, b.windowArea, b.registrySource, b.nickname, (select count(*) from Document x where x.buildingId=b.id and x.kind='BILL') bills from RetrofitDemand d join Building b on b.id=d.buildingId join User u on u.id=b.ownerId where u.email='${email}'`))[0];
  console.log('   db:', JSON.stringify(row));
  ok(row.billElectric === null && row.billGas === 210000, 'blank bill stored as null, gas stored');
  ok(JSON.parse(row.tradesJson).join() === 'WINDOW,EXT_INSULATION,BOILER', 'trades saved without unchecked one');
  ok(row.bills === 1 && row.registrySource === 'MOCK', 'bill photo + registry source saved');

  // 수정: 기존 값 채워짐 + 같은 수요 갱신
  await p.click('text=수정 ›'); await p.waitForURL(/\/demand$/);
  ok(await p.isVisible('[role=checkbox][aria-checked=true]:has-text("겨울철 실내가 춥다")'), 'demand prefilled for edit');
  for (let i = 0; i < 4; i++) await p.click('button:has-text("다음"), button:has-text("건너뛰기")');
  await p.click('text=등록 완료'); await p.waitForURL(/diagnosis\?saved=/);
  ok(JSON.parse(sql(`select count(*) n from RetrofitDemand d join Building b on b.id=d.buildingId join User u on u.id=b.ownerId where u.email='${email}'`))[0].n === 1, 'edit updates, no duplicate demand');

  // 직접 입력: 빈 필수값 검증
  await p.goto(B + '/customer/buildings/new');
  await p.fill('input[placeholder^="대구"]', '대구 수성구 범어동 9');
  await p.click('text=직접 입력하기');
  await p.click('text=이 정보로 등록하기'); await p.waitForSelector('text=연면적을 입력해주세요');
  ok(await p.isVisible('text=층수를 입력해주세요'), 'manual entry required-field errors');
  await shot(p, '07-manual-errors');
  const myBuilding = JSON.parse(sql(`select b.id from Building b join User u on u.id=b.ownerId where u.email='${email}'`))[0].id;
  await c.close();

  // 다른 고객은 남의 건물 접근 불가
  c = await ctx(); p = await c.newPage();
  await p.goto(B + '/login'); await p.click('text=건물주'); await p.click('button[type=submit]'); await p.waitForURL(B + '/customer');
  await p.goto(B + `/customer/buildings/${myBuilding}/edit`);
  ok(await p.isVisible('text=찾는 화면이 없어요') && !(await p.isVisible('text=대명동 본가')), 'other customer gets not-found on foreign building');
  await p.goto(B + '/customer/diagnosis'); await shot(p, '08-demo-hub');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
