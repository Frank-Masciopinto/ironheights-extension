// Service worker: context menu, and scans requested by the page badge. No telemetry, no remote code.
import { scanUrl, type FullResult } from './scan.ts';

const api = (globalThis as any).browser ?? chrome;
const TTL = 10 * 60 * 1000;
const cache = new Map<string, { at: number; result: FullResult }>();

api.runtime.onInstalled.addListener(() => {
  api.contextMenus.removeAll(() => {
    api.contextMenus.create({ id: 'ih-scan-link', title: 'Scan with Ironheights', contexts: ['link'] });
    api.contextMenus.create({ id: 'ih-scan-page', title: 'Scan this skill with Ironheights', contexts: ['page'],
      documentUrlPatterns: ['https://github.com/*', 'https://clawhub.ai/*', 'https://grokpot.io/*'] });
  });
  api.storage.sync.get({ autoBadge: true }).then?.((v: any) => api.storage.sync.set(v));
});

api.contextMenus.onClicked.addListener((info: any) => {
  const url = info.menuItemId === 'ih-scan-link' ? info.linkUrl : info.pageUrl;
  if (!url) return;
  api.tabs.create({ url: api.runtime.getURL('results.html?url=' + encodeURIComponent(url)) });
});

export async function cachedScan(url: string): Promise<FullResult> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL) return hit.result;
  const result = await scanUrl(url);
  cache.set(url, { at: Date.now(), result });
  return result;
}

api.runtime.onMessage.addListener((msg: any, _sender: any, send: (r: any) => void) => {
  if (msg?.type === 'ih-scan' && typeof msg.url === 'string') {
    cachedScan(msg.url).then((result) => send({ ok: true, result }), (e) => send({ ok: false, error: String(e?.message ?? e) }));
    return true;
  }
  if (msg?.type === 'ih-open' && typeof msg.url === 'string') {
    api.tabs.create({ url: api.runtime.getURL('results.html?url=' + encodeURIComponent(msg.url)) });
  }
  return false;
});
