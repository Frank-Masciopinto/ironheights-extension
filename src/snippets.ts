// Pulls the skill or package an install snippet refers to, so the copy warning can scan it.
// Pure text parsing: nothing here touches the network.
export interface SnippetTarget {
  label: string; // what the toast names, e.g. "npm package foo"
  url: string;   // a URL fetchSkill understands
}

const NPM_NAME = /^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/i;

export function npmUrl(spec: string): string | undefined {
  // strip a version or tag: foo@1.2.3, @scope/foo@latest
  const name = spec.startsWith('@') ? '@' + spec.slice(1).split('@')[0] : spec.split('@')[0]!;
  if (!NPM_NAME.test(name)) return undefined;
  return 'https://www.npmjs.com/package/' + name;
}

function ghShorthand(s: string): string | undefined {
  const m = /^(?:https:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(s);
  return m ? `https://github.com/${m[1]}/${m[2]}` : undefined;
}

const FLAG_WITH_VALUE = new Set(['-p', '--package', '-s', '--skill', '--registry', '--dir', '--workdir', '-a', '--agent']);

function fromCommand(words: string[]): SnippetTarget[] {
  const out: SnippetTarget[] = [];
  const w = words.map((x) => x.replace(/^['"]|['"]$/g, ''));
  const positional = (from: number) => {
    const r: string[] = [];
    let skill: string | undefined;
    for (let i = from; i < w.length; i++) {
      const x = w[i]!;
      if (x === '&&' || x === ';' || x === '|') break;
      if (FLAG_WITH_VALUE.has(x)) { if (x === '-s' || x === '--skill') skill = w[i + 1]; i++; continue; }
      if (x.startsWith('-')) continue;
      r.push(x);
    }
    return { r, skill };
  };
  for (let i = 0; i < w.length; i++) {
    const cmd = w[i]!;
    // clawhub install <slug> / npx clawhub install <slug>
    if (cmd === 'clawhub' && w[i + 1] === 'install') {
      for (const s of positional(i + 2).r) {
        const [owner, slug] = s.includes('/') ? s.split('/') : [undefined, s];
        if (slug && /^[\w.-]+$/.test(slug)) out.push({ label: `ClawHub skill ${s}`, url: owner ? `https://clawhub.ai/${owner}/skills/${slug}` : `https://clawhub.ai/skills/${slug}` });
      }
      return out;
    }
    // npx skills add owner/repo [--skill name]  (skills.sh)
    if (cmd === 'skills' && w[i + 1] === 'add') {
      const { r, skill } = positional(i + 2);
      const gh = r[0] && ghShorthand(r[0]);
      if (gh) {
        const [o, rp] = gh.split('/').slice(-2);
        out.push(skill ? { label: `skill ${skill} from ${o}/${rp}`, url: `https://skills.sh/${o}/${rp}/${skill}` } : { label: `skills in ${o}/${rp}`, url: gh });
      }
      return out;
    }
    // claude plugin marketplace add owner/repo  /  /plugin marketplace add owner/repo
    if ((cmd === 'marketplace' || cmd === 'plugin') && w.includes('add')) {
      const r = positional(w.indexOf('add') + 1).r;
      const gh = r[0] && ghShorthand(r[0]);
      if (gh) { out.push({ label: `plugin repo ${gh.split('/').slice(-2).join('/')}`, url: gh }); return out; }
    }
    if (cmd === 'npx' || cmd === 'bunx' || cmd === 'pnpx' || (cmd === 'pnpm' && w[i + 1] === 'dlx')) {
      const { r } = positional(cmd === 'pnpm' ? i + 2 : i + 1);
      if (r[0] === 'clawhub' || r[0] === 'skills') continue;
      const u = r[0] && npmUrl(r[0]);
      if (u) out.push({ label: `npm package ${r[0]}`, url: u });
      return out;
    }
    if ((cmd === 'npm' || cmd === 'pnpm' || cmd === 'yarn' || cmd === 'bun') && ['i', 'install', 'add'].includes(w[i + 1] ?? '')) {
      for (const p of positional(i + 2).r) { const u = npmUrl(p); if (u) out.push({ label: `npm package ${p}`, url: u }); }
      return out;
    }
  }
  return out;
}

function fromMcpJson(text: string): SnippetTarget[] | undefined {
  const start = text.indexOf('{');
  if (start < 0) return undefined;
  let obj: any;
  try { obj = JSON.parse(text.slice(start, text.lastIndexOf('}') + 1)); } catch { return undefined; }
  const servers = obj?.mcpServers ?? obj?.servers ?? obj?.mcp?.servers ?? (obj?.command ? { server: obj } : undefined);
  if (!servers || typeof servers !== 'object') return undefined;
  const out: SnippetTarget[] = [];
  for (const s of Object.values<any>(servers)) {
    if (!s || typeof s.command !== 'string') continue;
    const args = Array.isArray(s.args) ? s.args.filter((a: unknown) => typeof a === 'string') : [];
    out.push(...fromCommand([s.command, ...args]));
  }
  return out;
}

/** Returns the scannable targets in a copied snippet, at most three, or [] if it is not an install snippet. */
export function parseInstallSnippet(text: string): SnippetTarget[] {
  if (!text || text.length > 20_000) return [];
  const json = fromMcpJson(text);
  let found: SnippetTarget[] = json ?? [];
  if (!json) {
    for (const line of text.split(/\r?\n/)) {
      const words = line.replace(/^\s*[$>#]\s*/, '').trim().split(/\s+/).filter(Boolean);
      if (words.length) found.push(...fromCommand(words));
    }
  }
  const seen = new Set<string>();
  found = found.filter((t) => !seen.has(t.url) && seen.add(t.url));
  return found.slice(0, 3);
}
