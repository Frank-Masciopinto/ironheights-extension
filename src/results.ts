import { scanUrl } from './scan.ts';
import { ENGINE_VERSION, SAFETY_REMINDER } from './engine.ts';

const out = document.getElementById('out')!;
const url = new URLSearchParams(location.search).get('url') ?? '';
document.getElementById('src')!.textContent = url;
document.getElementById('ver')!.textContent = ENGINE_VERSION;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text; // untrusted skill text is only ever set as textContent
  return e;
}

scanUrl(url).then((r) => {
  out.textContent = '';
  const sum = el('section', 'summary');
  const letter = /^[A-F]$/.test(r.grade) ? r.grade : r.grade === 'incomplete' ? 'Incomplete' : 'None';
  sum.append(el('div', `grade ${/^[A-F]$/.test(r.grade) ? 'g-' + r.grade : 'g-x'}`, letter));
  const info = el('div');
  info.append(el('h2', '', r.skillName));
  const v = el('div');
  v.append('Verdict: ', el('span', 'verdict', r.verdict), r.score !== undefined ? ` · trust score ${r.score}/100` : '', ` · ${r.findings.length} finding(s) · ${r.filesScanned} file(s) scanned`);
  info.append(v, el('div', 'meta', 'Scanned: ' + r.source));
  sum.append(info);
  out.append(sum);
  if (r.coverage === 'single-file') out.append(el('div', 'warn', 'Only this one file was scanned, not the whole skill folder. Scripts next to it were not checked.'));
  if (r.skipped.length) {
    const w = el('div', 'warn', `${r.skipped.length} file(s) were not scanned, so there is no letter grade:`);
    const ul = el('ul');
    for (const s of r.skipped.slice(0, 20)) ul.append(el('li', '', `${s.file}: ${s.reason}`));
    w.append(ul);
    out.append(w);
  }
  for (const f of r.findings) {
    const d = el('div', `finding sev-${f.severity}`);
    d.append(el('div', '', `${f.severity.toUpperCase()} · ${f.ruleId} · ${f.message}`));
    d.append(el('div', 'meta', `${f.file}${f.line ? ':' + f.line : ''}${f.note ? ' — ' + f.note : ''}`));
    if (f.evidence) d.append(el('pre', '', f.evidence));
    if (f.remediation) d.append(el('div', 'meta', 'Fix: ' + f.remediation));
    out.append(d);
  }
  out.append(el('p', 'disclaimer', SAFETY_REMINDER + ' Review the skill yourself, and use the Ironheights CLI for baselines and runtime checks.'));
}, (e) => {
  out.textContent = '';
  out.append(el('div', 'warn', 'Could not scan: ' + (e?.message ?? String(e))));
});
