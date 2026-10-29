// Adds a small grade badge on ClawHub skill pages and GitHub folders that contain a SKILL.md.
// It only reads the URL and file list; scans run in the extension's background worker.
const api = (globalThis as any).browser ?? chrome;
const BADGE_ID = 'ironheights-badge';

function skillUrlForPage(): string | undefined {
  const { hostname, pathname } = location;
  const parts = pathname.split('/').filter(Boolean);
  if (hostname === 'clawhub.ai') {
    if (parts[1] === 'skills' && parts[2] && parts.length === 3) return location.origin + pathname;
    return undefined;
  }
  if (hostname === 'github.com' && parts.length >= 2) {
    if (parts[2] === 'blob' && /\/SKILL\.md$/i.test(pathname)) return location.origin + pathname;
    if (parts.length !== 2 && parts[2] !== 'tree') return undefined;
    const base = `/${parts[0]}/${parts[1]}/blob/`;
    const want = parts.length === 2 ? new RegExp('^' + base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^/]+/SKILL\\.md$', 'i') : undefined;
    const exact = `${base}${parts.slice(3).join('/')}/SKILL.md`.toLowerCase();
    const hasSkill = [...document.querySelectorAll('a[href]')].some((a) => {
      const href = (a.getAttribute('href') || '').split(/[?#]/)[0]!;
      return want ? want.test(href) : href.toLowerCase() === exact;
    });
    return hasSkill ? location.origin + pathname : undefined;
  }
  return undefined;
}

function anchor(): Element | null {
  if (location.hostname === 'github.com') {
    return document.querySelector('#repository-container-header strong[itemprop="name"]')?.parentElement
      ?? document.querySelector('#repo-title-component') ?? document.querySelector('main h1') ?? document.querySelector('h1');
  }
  return document.querySelector('main h1') ?? document.querySelector('h1');
}

const COLORS: Record<string, string> = { A: '#1a7f37', B: '#4c8f2a', C: '#b08800', D: '#d1621f', F: '#cf222e' };

function render(el: HTMLElement, url: string, res: any) {
  el.textContent = '';
  const pill = document.createElement('span');
  pill.className = 'ih-pill';
  const tip = document.createElement('span');
  tip.className = 'ih-tip';
  if (!res.ok) {
    pill.textContent = 'Ironheights: could not scan';
    pill.style.background = '#57606a';
    tip.textContent = res.error;
  } else {
    const r = res.result;
    const g = /^[A-F]$/.test(r.grade) ? r.grade : r.grade === 'incomplete' ? '?' : '–';
    pill.textContent = `Ironheights ${g}${r.score !== undefined ? ` ${r.score}/100` : ''} · ${r.findings.length} finding${r.findings.length === 1 ? '' : 's'}`;
    pill.style.background = COLORS[r.grade] ?? '#57606a';
    const top = r.findings.slice(0, 3).map((f: any) => `${f.severity.toUpperCase()} ${f.ruleId}: ${f.message}`);
    tip.textContent = [...(top.length ? top : ['No findings.']), r.grade === 'incomplete' ? 'Some files were not scanned, so no grade.' : '', r.disclaimer, 'Click for the full report.'].filter(Boolean).join('\n');
  }
  el.append(pill, tip);
  el.onclick = (e) => { e.preventDefault(); api.runtime.sendMessage({ type: 'ih-open', url }); };
}

let state: { pageUrl: string; skillUrl?: string; res?: any; pending: boolean } = { pageUrl: '', pending: false };
let enabled = true;
let timer: number | undefined;

// Pages render late and re-render (React/Turbo), so keep checking and re-insert the badge if it vanishes.
function ensure() {
  if (!enabled) return;
  if (state.pageUrl !== location.href) {
    document.getElementById(BADGE_ID)?.remove();
    state = { pageUrl: location.href, pending: false };
  }
  const url = skillUrlForPage();
  const host = anchor();
  if (!url || !host) return;
  if (state.skillUrl && state.skillUrl !== url) state = { pageUrl: location.href, pending: false };
  state.skillUrl = url;
  let el = document.getElementById(BADGE_ID) as HTMLAnchorElement | null;
  if (!el) {
    el = document.createElement('a');
    el.id = BADGE_ID;
    el.href = '#';
    el.className = 'ih-badge';
    el.textContent = 'Ironheights: scanning…';
    host.appendChild(el);
    if (state.res) render(el, url, state.res);
  }
  if (!state.res && !state.pending) {
    state.pending = true;
    const mine = state;
    api.runtime.sendMessage({ type: 'ih-scan', url }).then(
      (res: any) => { mine.res = res ?? { ok: false, error: 'no response' }; mine.pending = false; if (state === mine) { const b = document.getElementById(BADGE_ID); if (b) render(b, url, mine.res); } },
      (e: any) => { mine.res = { ok: false, error: String(e?.message ?? e) }; mine.pending = false; },
    );
  }
}

function schedule() {
  if (timer !== undefined) return;
  timer = setTimeout(() => { timer = undefined; ensure(); }, 300) as unknown as number;
}

api.storage.sync.get({ autoBadge: true }).then((v: any) => { enabled = v.autoBadge; ensure(); });
api.storage.onChanged.addListener((c: any) => { if (c.autoBadge) { enabled = c.autoBadge.newValue; if (!enabled) document.getElementById(BADGE_ID)?.remove(); else ensure(); } });
document.addEventListener('turbo:load', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
