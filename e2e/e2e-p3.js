// P3 커뮤니티: 이웃 커뮤니티(글·사진·공감·저장·댓글·신고·이웃 모집) + 파트너 라운지(규칙 동의·담합 가드·채택) + 운영자 검토
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

  // ── 건물주 ──
  const p = await loginAs(browser, 'customer@demo.kr');
  ok(await p.isVisible('nav[aria-label="주요 메뉴"] >> text=커뮤니티') && await p.isVisible('a[aria-label="마이 페이지"]'), 'tabs: 커뮤니티 tab + 마이 in header');
  await p.click('nav[aria-label="주요 메뉴"] >> text=커뮤니티'); await p.waitForURL(/customer\/community$/);
  ok(await p.isVisible('text=이웃 커뮤니티 이용 안내'), 'notice pinned');
  ok(await p.isVisible('text=대명동 창호 같이 바꾸실 분'), 'seed posts listed');
  await p.screenshot({ path: `${SP}/shots/p3-01-community.png`, fullPage: true });
  await p.click('[role=tab]:has-text("이웃 모집")'); await p.waitForURL(/cat=RECRUIT/);
  ok(!(await p.isVisible('text=결로 줄이려면')) && await p.isVisible('text=침산동 외단열'), 'category filter');

  // 이웃 모집 관심 → 수요에 외단열 추가
  await p.click('text=침산동 외단열 공동구매'); await p.waitForURL(/community\/c/);
  await p.click('button:has-text("이 묶음에 관심 있어요")'); await p.waitForURL(/interest=1/);
  ok(await p.isVisible('text=관심 표시했어요'), 'interest shown');
  const trades = sql("select d.tradesJson t from RetrofitDemand d join Building b on b.id=d.buildingId join User u on u.id=b.ownerId where u.email='customer@demo.kr' and d.status in ('ACTIVE','MATCHED')")[0].t;
  ok(trades.includes('EXT_INSULATION'), 'trade added to my demand');
  await p.screenshot({ path: `${SP}/shots/p3-02-recruit.png`, fullPage: true });

  // 글쓰기: 정확한 주소 차단 → 수정 후 게시 (사진 전/후)
  await p.goto(B + '/customer/community/new');
  await p.click('label:has-text("시공 전·후 후기")');
  await p.fill('input[name=title]', '창호 교체 첫 겨울 후기');
  await p.fill('textarea[name=body]', '대명동 123-4번지 다가구인데 창호 바꾸고 외풍이 확 줄었어요.');
  await p.click('label:has-text("창호") >> input');
  await p.setInputFiles('input[name=before]', IMG); await p.setInputFiles('input[name=after]', IMG);
  await p.fill('input[name=savingsAmount]', '32000');
  await p.fill('input[name=tips] >> nth=0', '실측 날 창틀 사진 남기기');
  await p.click('button:has-text("글 올리기")');
  await p.waitForSelector('text=정확한 주소(번지·도로명 번호·동호수)는 지워주세요');
  ok(await p.inputValue('input[name=title]') === '창호 교체 첫 겨울 후기', 'exact address blocked, input kept');
  await p.fill('textarea[name=body]', '대명동 다가구인데 창호 바꾸고 외풍이 확 줄었어요.');
  await p.setInputFiles('input[name=before]', IMG); await p.setInputFiles('input[name=after]', IMG);
  await p.click('button:has-text("글 올리기")'); await p.waitForURL(/community\/c[a-z0-9]+$/);
  ok(await p.isVisible('h1:has-text("창호 교체 첫 겨울 후기")') && await p.isVisible('text=남구 대명동'), 'post created with 동-level place');
  ok(await p.isVisible('figcaption:has-text("시공 전")') && await p.isVisible('figcaption:has-text("시공 후")'), 'before/after photos');
  ok(await p.isVisible('text=작성자 입력'), 'savings labelled as author input');
  const photoOk = await p.evaluate(() => Promise.all([...document.querySelectorAll('figure img')].map((i) => i.decode().then(() => true, () => false))));
  ok(photoOk.length === 2 && photoOk.every(Boolean), 'photos load');
  const myPost = p.url();

  // 댓글 + 답글
  await p.fill('input[name=body] >> nth=-1', '궁금한 점 있으면 물어보세요!'); await p.click('button:has-text("등록") >> nth=-1');
  await p.waitForSelector('text=궁금한 점 있으면 물어보세요!');
  await p.click('summary:has-text("답글 달기")'); await p.fill('input[aria-label=답글]', '추가로 결로도 줄었어요'); await p.click('details[open] button:has-text("등록")');
  await p.waitForSelector('text=↳');
  ok(await p.isVisible('text=추가로 결로도 줄었어요'), 'comment + reply');
  await p.screenshot({ path: `${SP}/shots/p3-03-post.png`, fullPage: true });

  // 다른 이웃 글: 공감·저장·신고
  await p.goto(B + '/customer/community?cat=TIP');
  await p.click('text=결로 줄이려면'); await p.waitForURL(/community\/c/);
  const likeBtn = 'button[name=kind][value=LIKE]';
  const n0 = Number((await p.textContent(likeBtn)).match(/\d+/)[0]);
  await p.click(likeBtn); await p.waitForSelector(`${likeBtn}[aria-pressed=true]`);
  ok(Number((await p.textContent(likeBtn)).match(/\d+/)[0]) === n0 + 1, 'like +1');
  await p.click('button[name=kind][value=BOOKMARK]'); await p.waitForSelector('text=★ 저장됨');
  await p.click('summary:has-text("신고") >> nth=0'); await p.selectOption('select[name=reason] >> nth=0', '광고·홍보'); await p.click('button:has-text("신고하기") >> nth=0');
  await p.waitForURL(/reported=1/); ok(await p.isVisible('text=신고가 접수됐어요'), 'report submitted');
  await p.goto(B + '/customer/community?saved=1');
  ok(await p.isVisible('text=결로 줄이려면') && !(await p.isVisible('text=침산동 외단열')), 'saved list');
  await p.goto(B + '/contractor/lounge'); ok(!p.url().includes('/contractor/lounge'), 'customer cannot open lounge');
  ok(p.errors.length === 0, 'no page errors (customer) ' + p.errors.join(','));

  // ── 업체: 라운지 ──
  const c = await loginAs(browser, 'c05@demo.kr');
  ok(await c.isVisible('nav[aria-label="주요 메뉴"] >> text=라운지') && await c.isVisible('nav[aria-label="주요 메뉴"] >> text=내 입찰·시공'), 'contractor tabs');
  await c.click('nav[aria-label="주요 메뉴"] >> text=내 입찰·시공'); await c.click('text=🏗️ 시공 관리'); await c.waitForURL(/contractor\/projects/);
  ok(await c.isVisible('nav[aria-label="주요 메뉴"] a[aria-current=page]:has-text("내 입찰·시공")'), 'projects under 내 입찰·시공 tab');
  await c.goto(B + '/contractor/lounge');
  ok(await c.isVisible('text=파트너 라운지 이용 규칙'), 'rules gate on first entry');
  await c.click('input[name=agree] >> nth=0'); await c.click('button:has-text("동의하고")');
  await c.waitForSelector('text=세 가지 모두 동의해야');
  for (let i = 0; i < 3; i++) await c.check(`input[name=agree] >> nth=${i}`);
  await c.click('button:has-text("동의하고")'); await c.waitForSelector('text=진행 중 입찰 이야기는 금지예요');
  ok(sql("select count(*) n from BoardRuleAgreement")[0].n === 1, 'agreement stored');
  ok(!(await c.isVisible('text=이번 서구 창호 건 다들 얼마')), 'held seed post hidden from others');
  await c.screenshot({ path: `${SP}/shots/p3-04-lounge.png`, fullPage: true });

  // 입찰 담합 의심 글 → 보류
  await c.goto(B + '/contractor/lounge/new');
  await c.click('label:has-text("자재·단가 정보")');
  await c.fill('input[name=title]', '보일러 건 같이 맞춰요');
  await c.fill('textarea[name=body]', 'Cluster #3 보일러 대당 120만원에 넣자는 얘기 있던데요');
  await c.click('button:has-text("글 올리기")'); await c.waitForURL(/held=1/);
  ok(await c.isVisible('text=운영자 검토 중이에요'), 'bid-talk post held');
  const flag = sql("select source, kind, status from CollusionFlag where source='BOARD' order by createdAt desc limit 1")[0];
  ok(flag.kind === 'BOARD_KEYWORD' && flag.status === 'OPEN', 'collusion flag created');
  await c.screenshot({ path: `${SP}/shots/p3-05-held.png`, fullPage: true });

  // 일반 질문 글 → 게시, 다른 업체 답변 → 채택
  await c.goto(B + '/contractor/lounge/new');
  await c.click('label:has-text("시공 기술·공법")');
  await c.fill('input[name=title]', '콘덴싱 보일러 배기관 결로 처리');
  await c.fill('textarea[name=body]', '콘덴싱 보일러 교체 때 배기관 응축수 처리 어떻게들 하시나요?');
  await c.setInputFiles('input[name=attachments]', IMG);
  await c.click('button:has-text("글 올리기")'); await c.waitForURL(/lounge\/c[a-z0-9]+$/);
  ok(!(await c.isVisible('text=운영자 검토 중이에요')) && await c.isVisible('text=📎 icon.png'), 'normal post published with attachment');
  const qUrl = c.url();

  const d = await loginAs(browser, 'contractor@demo.kr');
  await d.goto(B + '/contractor/lounge');
  ok(!(await d.isVisible('text=보일러 건 같이 맞춰요')), 'held post invisible to other contractor');
  await d.goto(qUrl);
  await d.fill('input[name=body] >> nth=-1', '응축수 배관은 동결 안 되게 실내 쪽으로 빼고 중화기 다는 편이에요.'); await d.click('button:has-text("등록") >> nth=-1');
  await d.waitForSelector('text=중화기 다는 편이에요');
  await d.fill('input[name=body] >> nth=-1', '이번 건은 양보할게요 다음에 순번 돌려요'); await d.click('button:has-text("등록") >> nth=-1');
  await d.waitForSelector('text=운영자 검토 후 게시돼요');
  ok(true, 'bid-talk comment held');
  await c.reload();
  ok(!(await c.isVisible('text=다음에 순번 돌려요')), 'held comment hidden from post author');
  await c.click('button:has-text("이 답변 채택")'); await c.waitForSelector('text=✔ 채택된 답변');
  ok(await c.isVisible('text=🛠️ 기술 공유'), 'accepted answer + 기술 공유 badge');
  ok(c.errors.length + d.errors.length === 0, 'no page errors (contractor)');

  // ── 운영자 ──
  const a = await loginAs(browser, 'admin@demo.kr', 1100);
  await a.goto(B + '/admin/community');
  ok(await a.isVisible('text=자동 보류된 글·댓글 (3)'), 'admin sees 2 held posts + 1 held comment');
  ok(await a.isVisible('text=광고·홍보'), 'admin sees report');
  await a.screenshot({ path: `${SP}/shots/p3-06-admin.png`, fullPage: true });
  const heldCard = a.locator('div.rounded-3xl', { hasText: '보일러 건 같이 맞춰요' }).first();
  await heldCard.locator('button:has-text("숨김")').click();
  await a.waitForSelector('text=자동 보류된 글·댓글 (2)');
  const commentCard = a.locator('div.rounded-3xl', { hasText: '다음에 순번 돌려요' }).first();
  await commentCard.locator('button:has-text("문제없음 · 게시")').click();
  await a.waitForSelector('text=자동 보류된 글·댓글 (1)');
  ok(sql("select status from CommunityPost where title='보일러 건 같이 맞춰요'")[0].status === 'HIDDEN', 'held post hidden');
  ok(sql("select count(*) n from CollusionFlag where source='BOARD' and status='DISMISSED'")[0].n === 1, 'approved comment flag dismissed');
  await a.click('button:has-text("신고 기각")'); await a.waitForSelector('text=처리할 신고가 없어요');
  ok(true, 'report rejected');
  const bestCard = a.locator('div.rounded-3xl', { hasText: '창호 교체 첫 겨울 후기' }).first();
  await bestCard.locator('button:has-text("BEST 지정")').click();
  await a.waitForSelector('div.rounded-3xl:has-text("창호 교체 첫 겨울 후기") >> text=BEST 해제');
  await a.goto(B + '/admin/monitoring');
  ok(await a.isVisible('text=라운지 게시글'), 'board flags in collusion monitoring');
  ok(a.errors.length === 0, 'no page errors (admin)');

  await p.goto(B + '/customer/community?sort=best');
  ok(await p.isVisible('text=창호 교체 첫 겨울 후기'), 'BEST filter shows promoted post');
  await p.goto(myPost);
  ok(await p.isVisible('text=BEST'), 'BEST badge on post');

  await browser.close();
})().catch((e) => { console.error('FAIL: exception', e); process.exit(1); });
