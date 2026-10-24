// 테스트 도우미: 페이지 이동 후 loading.tsx 스켈레톤이 사라질 때까지 기다린다
const { chromium } = require('playwright');
const settle = (page) => page.waitForSelector('[aria-busy=true]', { state: 'detached', timeout: 15000 }).catch(() => {});
const origLaunch = chromium.launch.bind(chromium);
chromium.launch = async (...a) => {
  const b = await origLaunch(...a);
  const ctx = await b.newContext();
  const pg = await ctx.newPage();
  const proto = Object.getPrototypeOf(pg);
  if (!proto.__gtPatched) {
    for (const m of ['goto', 'waitForURL', 'reload']) {
      const orig = proto[m];
      proto[m] = async function (...x) { const r = await orig.apply(this, x); await settle(this); return r; };
    }
    const click = proto.click;
    proto.click = async function (...x) { const r = await click.apply(this, x); await this.waitForTimeout(150); await settle(this); return r; };
    proto.__gtPatched = true;
  }
  await ctx.close();
  return b;
};
