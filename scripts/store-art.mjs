// Renders Chrome Web Store screenshots (1280x800) and the small promo tile (440x280) from HTML.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const here = (p) => fileURLToPath(new URL('../' + p, import.meta.url));
const img = (p) => 'data:image/png;base64,' + readFileSync(here(p)).toString('base64');
const icon = img('static/icons/128.png');
const frame = (title, sub, shot, extra = '') => `<html><body style="margin:0;width:1280px;height:800px;background:linear-gradient(135deg,#0b1220,#16243d);font-family:Inter,Segoe UI,sans-serif;color:#fff;display:flex;flex-direction:column;align-items:center">
<div style="display:flex;align-items:center;gap:14px;margin-top:34px"><img src="${icon}" width="52"><div style="font-size:38px;font-weight:800">${title}</div></div>
<div style="font-size:20px;color:#9fb0c3;margin:10px 0 22px">${sub}</div>
<img src="${shot}" style="width:1040px;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.5)">${extra}</body></html>`;
const b = await chromium.launch({ channel: 'chromium' });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const shots = [
  ['screenshot-1-report.png', 'Know before you install', 'Right-click any skill link → Scan with Ironheights. F = do not install.', 'store/raw/results-0.png'],
  ['screenshot-2-badge.png', 'Grades right on the page', 'A badge on GitHub and ClawHub skill pages, for any AI bot’s skills.', 'store/raw/badge-1.png'],
  ['screenshot-3-clawhub.png', 'Works on ClawHub too', 'Same Ironheights rules as the open-source CLI. Scans run in your browser.', 'store/raw/badge-0.png'],
];
for (const [out, t, s, shot] of shots) {
  await p.setContent(frame(t, s, img(shot)));
  await p.screenshot({ path: here('store/' + out) });
}
await p.setContent(frame('Private by design', 'Local scan · files read as text, never run · no telemetry · no account', img('store/raw/popup.png').replace('', ''), ''));
await p.evaluate(() => { const i = document.querySelectorAll('img')[1]; i.style.width = '420px'; });
await p.screenshot({ path: here('store/screenshot-4-popup.png') });
await p.setViewportSize({ width: 440, height: 280 });
await p.setContent(`<html><body style="margin:0;width:440px;height:280px;background:linear-gradient(135deg,#0b1220,#1d3557);font-family:Inter,Segoe UI,sans-serif;color:#fff;display:flex;flex-direction:column;justify-content:center;padding:0 30px;box-sizing:border-box">
<div style="display:flex;align-items:center;gap:12px"><img src="${icon}" width="56"><div style="font-size:32px;font-weight:800">Ironheights</div></div>
<div style="font-size:19px;font-weight:700;margin-top:14px">Scan AI skills before you install them</div>
<div style="font-size:13px;color:#9fb0c3;margin-top:8px">OpenClaw · Claude · Grok Bot · Codex · any AI bot</div>
<div style="display:flex;gap:8px;margin-top:16px">${['A', 'C', 'F'].map((g, i) => `<span style="background:${['#1a7f37', '#b08800', '#cf222e'][i]};border-radius:8px;padding:6px 12px;font-weight:800">${g}</span>`).join('')}</div></body></html>`);
await p.screenshot({ path: here('store/promo-small-440x280.png') });
await b.close();
console.log('ok');
