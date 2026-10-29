// Loads dist/ as an unpacked extension in Chromium and checks the results page, badge and popup.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
const dist = fileURLToPath(new URL('../dist', import.meta.url));
const shots = fileURLToPath(new URL('../store/raw', import.meta.url));
mkdirSync(shots, { recursive: true });
const ctx = await chromium.launchPersistentContext('', {
  headless: true, channel: 'chromium', viewport: { width: 1280, height: 800 },
  args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
});
let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent('serviceworker');
const id = sw.url().split('/')[2];
console.log('extension id', id);
const errors = [];
// Demo repo served from the test fixtures, so screenshots never depend on a real malicious repo.
import { readFileSync } from 'node:fs';
const fx = (n) => readFileSync(fileURLToPath(new URL('../test/fixtures/malicious/' + n, import.meta.url)), 'utf8');
await ctx.route(/demo-org\/crypto-price-helper/, (route) => {
  const u = route.request().url();
  if (u.includes('/git/trees/')) return route.fulfill({ json: { truncated: false, tree: [
    { path: 'SKILL.md', type: 'blob', size: 400 }, { path: 'setup.sh', type: 'blob', size: 200 } ] } });
  if (u.startsWith('https://api.github.com/repos/')) return route.fulfill({ json: { default_branch: 'main' } });
  if (u.endsWith('/SKILL.md')) return route.fulfill({ body: fx('SKILL.md') });
  if (u.endsWith('/setup.sh')) return route.fulfill({ body: fx('setup.sh') });
  return route.continue();
});
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(e.message));
const targets = (process.env.TARGETS ?? 'https://clawhub.ai/frank-masciopinto/skills/ironheights').split(',');
for (const [i, t] of targets.entries()) {
  await page.goto(`chrome-extension://${id}/results.html?url=${encodeURIComponent(t)}`);
  await page.waitForSelector('.summary, .warn', { timeout: 60000 });
  console.log('RESULT', t, '=>', (await page.locator('main').innerText()).slice(0, 300).replace(/\n/g, ' | '));
  await page.screenshot({ path: `${shots}/results-${i}.png` });
}
if (process.env.BADGE) {
  for (const [i, b] of process.env.BADGE.split(',').entries()) {
    await page.goto(b);
    try {
      await page.waitForSelector('#ironheights-badge .ih-pill', { timeout: 45000 });
      await page.waitForFunction(() => !document.querySelector('#ironheights-badge')?.textContent?.includes('scanning'), null, { timeout: 60000 });
      console.log('BADGE', b, '=>', await page.locator('#ironheights-badge .ih-pill').innerText());
      await page.locator('#ironheights-badge').hover();
      await page.waitForTimeout(300);
    } catch (e) { console.log('BADGE', b, 'missing', e.message.split('\n')[0]); }
    await page.screenshot({ path: `${shots}/badge-${i}.png` });
  }
}
await page.setViewportSize({ width: 360, height: 420 });
await page.goto(`chrome-extension://${id}/popup.html`);
await page.screenshot({ path: `${shots}/popup.png` });
console.log('page errors', errors);
await ctx.close();
