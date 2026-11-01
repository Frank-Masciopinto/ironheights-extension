// Turn a skill URL into a list of text files. Files are fetched as text and never executed.
import type { InputFile } from './engine.ts';

export interface Fetched {
  name: string;
  dirName?: string;
  source: string;
  files: InputFile[];
  skipped: { file: string; reason: string }[];
  coverage: 'skill-folder' | 'single-file';
}

type F = typeof fetch;
const MAX_FILES = 80;
const MAX_BYTES = 1024 * 1024;
const TEXTY = /\.(md|markdown|txt|sh|bash|zsh|ps1|py|js|mjs|cjs|ts|tsx|jsx|json|ya?ml|toml|ini|env|conf|rb|go|rs|php|pl|lua|bat|cmd|html?|xml|cfg)$|(^|\/)[^./]+$/i;

export function classifyUrl(raw: string):
  | { kind: 'github'; owner: string; repo: string; ref?: string; path: string; skill?: string }
  | { kind: 'npm'; name: string }
  | { kind: 'raw'; url: string }
  | { kind: 'clawhub'; owner?: string; slug: string }
  | { kind: 'page'; url: string }
  | undefined {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return undefined;
  }
  if (u.protocol !== 'https:') return undefined;
  const parts = u.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (u.hostname === 'github.com' && parts.length >= 2) {
    const [owner, repo, mode, ref, ...rest] = parts;
    if (!mode) return { kind: 'github', owner: owner!, repo: repo!.replace(/\.git$/, ''), path: '' };
    if ((mode === 'tree' || mode === 'blob') && ref) {
      let path = rest.join('/');
      if (mode === 'blob') path = path.split('/').slice(0, -1).join('/');
      return { kind: 'github', owner: owner!, repo: repo!, ref, path };
    }
    return undefined;
  }
  if ((u.hostname === 'www.npmjs.com' || u.hostname === 'npmjs.com') && parts[0] === 'package' && parts[1]) {
    const name = parts[1].startsWith('@') && parts[2] ? `${parts[1]}/${parts[2]}` : parts[1];
    return { kind: 'npm', name };
  }
  // skills.sh/<owner>/<repo>/<skill> lists a skill that lives in a GitHub repo.
  if ((u.hostname === 'skills.sh' || u.hostname === 'www.skills.sh') && parts.length >= 2 && /^[\w.-]+$/.test(parts[0]!) && /^[\w.-]+$/.test(parts[1]!)) {
    return { kind: 'github', owner: parts[0]!, repo: parts[1]!, path: '', ...(parts[2] ? { skill: parts[2] } : {}) };
  }
  if (u.hostname === 'claude-plugins.dev' && parts[0] === 'skills' && parts.length === 4 && parts[1]!.startsWith('@')) {
    return { kind: 'github', owner: parts[1]!.slice(1), repo: parts[2]!, path: '', skill: parts[3]! };
  }
  if (u.hostname === 'raw.githubusercontent.com') return { kind: 'raw', url: u.toString() };
  if (u.hostname === 'clawhub.ai' || u.hostname === 'www.clawhub.ai') {
    if (parts[1] === 'skills' && parts[2]) return { kind: 'clawhub', owner: parts[0], slug: parts[2] };
    if (parts[0] === 'skills' && parts[1]) return { kind: 'clawhub', slug: parts[1] };
    if (parts.length === 2) return { kind: 'clawhub', owner: parts[0], slug: parts[1]! };
    return undefined;
  }
  if (/\.md$/i.test(u.pathname)) return { kind: 'raw', url: u.toString() };
  return { kind: 'page', url: u.toString() };
}

async function getText(f: F, url: string): Promise<string> {
  const res = await f(url, { credentials: 'omit', redirect: 'follow' });
  if (!res.ok) throw new Error(`${new URL(url).hostname} answered ${res.status}`);
  const len = Number(res.headers.get('content-length') ?? 0);
  if (len > MAX_BYTES) throw new Error('file larger than 1 MB');
  return res.text();
}

async function getJson<T>(f: F, url: string): Promise<T> {
  return JSON.parse(await getText(f, url)) as T;
}

export async function fetchSkill(url: string, f: F = fetch): Promise<Fetched> {
  const c = classifyUrl(url);
  if (!c) throw new Error('Not a link Ironheights can read (GitHub, ClawHub, npm, skills.sh, grokpot or a SKILL.md link).');
  if (c.kind === 'raw') {
    const text = await getText(f, c.url);
    const name = c.url.split('/').slice(-2, -1)[0] ?? 'skill';
    return { name, source: c.url, files: [{ path: 'SKILL.md', text }], skipped: [], coverage: 'single-file' };
  }
  if (c.kind === 'github') return fetchGithub(f, c.owner, c.repo, c.ref, c.path, c.skill);
  if (c.kind === 'npm') return fetchNpm(f, c.name);
  if (c.kind === 'clawhub') return fetchClawhub(f, c.slug, c.owner);
  return fetchFromPage(f, c.url);
}

// npm: read the package's repository field from the public registry and scan that GitHub folder.
// Only the package name is sent, to registry.npmjs.org.
export function githubFromRepository(repo: unknown): { owner: string; repo: string; path: string } | undefined {
  const r = typeof repo === 'string' ? { url: repo } : (repo as { url?: string; directory?: string } | undefined);
  const url = r?.url;
  if (typeof url !== 'string') return undefined;
  const m = /^(?:github:)?([\w.-]+)\/([\w.-]+)$/.exec(url) ?? /github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[#/].*)?$/.exec(url);
  if (!m) return undefined;
  return { owner: m[1]!, repo: m[2]!, path: (r?.directory ?? '').replace(/^\.?\/|\/$/g, '') };
}

async function fetchNpm(f: F, name: string): Promise<Fetched> {
  const meta = await getJson<{ version?: string; repository?: unknown }>(f, `https://registry.npmjs.org/${name.replace('/', '%2F')}/latest`);
  const gh = githubFromRepository(meta.repository);
  if (!gh) throw new Error(`npm package ${name} does not link a GitHub repository, so there are no skill files to read.`);
  const got = await fetchGithub(f, gh.owner, gh.repo, undefined, gh.path);
  return { ...got, name: `${name}@${meta.version ?? 'latest'}` };
}

async function fetchGithub(f: F, owner: string, repo: string, ref: string | undefined, path: string, skill?: string): Promise<Fetched> {
  const api = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  if (!ref) ref = (await getJson<{ default_branch: string }>(f, api)).default_branch;
  const tree = await getJson<{ tree: { path: string; type: string; size?: number }[]; truncated: boolean }>(
    f,
    `${api}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
  );
  const blobs = tree.tree.filter((t) => t.type === 'blob');
  const skillDirs = blobs
    .filter((b) => /(^|\/)SKILL\.md$/i.test(b.path))
    .map((b) => b.path.split('/').slice(0, -1).join('/'));
  // Use the folder in the URL when it has a SKILL.md; else the SKILL.md folder under it closest to the top.
  const prefix = path.replace(/\/$/, '');
  let dir = skillDirs.find((d) => d === prefix);
  if (dir === undefined && skill) dir = skillDirs.find((d) => d.split('/').pop()?.toLowerCase() === skill.toLowerCase());
  if (dir === undefined) {
    const under = skillDirs.filter((d) => prefix === '' || d.startsWith(prefix + '/')).sort((a, b) => a.length - b.length);
    dir = under[0];
  }
  if (dir === undefined) throw new Error('No SKILL.md found at this GitHub location.');
  const inDir = blobs.filter((b) => dir === '' || b.path.startsWith(dir + '/'));
  const files: InputFile[] = [];
  const skipped: Fetched['skipped'] = [];
  if (tree.truncated) skipped.push({ file: '(repository)', reason: 'GitHub truncated the file list' });
  for (const b of inDir) {
    const rel = dir === '' ? b.path : b.path.slice(dir.length + 1);
    if (/(^|\/)(\.git|node_modules)\//.test(b.path)) continue;
    if (!TEXTY.test(rel)) {
      skipped.push({ file: rel, reason: 'not a text file; the extension does not download binaries' });
      continue;
    }
    if ((b.size ?? 0) > MAX_BYTES) {
      skipped.push({ file: rel, reason: 'larger than 1 MB' });
      continue;
    }
    if (files.length >= MAX_FILES) {
      skipped.push({ file: rel, reason: `over the ${MAX_FILES}-file limit` });
      continue;
    }
    const raw = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(ref)}/${b.path.split('/').map(encodeURIComponent).join('/')}`;
    files.push({ path: rel, text: await getText(f, raw) });
  }
  return {
    name: dir.split('/').pop() || repo,
    dirName: dir.split('/').pop() || repo,
    source: `https://github.com/${owner}/${repo}/tree/${ref}/${dir}`,
    files,
    skipped,
    coverage: 'skill-folder',
  };
}

async function fetchClawhub(f: F, slug: string, owner?: string): Promise<Fetched> {
  const base = 'https://clawhub.ai/api/v1/skills/' + encodeURIComponent(slug);
  const q = owner ? `?owner=${encodeURIComponent(owner)}` : '';
  const meta = await getJson<{ latestVersion: { version: string }; owner: { handle: string } }>(f, base + q);
  const version = meta.latestVersion.version;
  const own = owner ?? meta.owner.handle;
  const v = await getJson<{ version: { files: { path: string; size: number }[] } }>(
    f,
    `${base}/versions/${encodeURIComponent(version)}?owner=${encodeURIComponent(own)}`,
  );
  const files: InputFile[] = [];
  const skipped: Fetched['skipped'] = [];
  for (const file of v.version.files) {
    if (!TEXTY.test(file.path)) {
      skipped.push({ file: file.path, reason: 'not a text file; the extension does not download binaries' });
      continue;
    }
    if (file.size > MAX_BYTES || files.length >= MAX_FILES) {
      skipped.push({ file: file.path, reason: 'over the size or file-count limit' });
      continue;
    }
    const u = `${base}/file?owner=${encodeURIComponent(own)}&path=${encodeURIComponent(file.path)}&version=${encodeURIComponent(version)}`;
    files.push({ path: file.path, text: await getText(f, u) });
  }
  return { name: `${own}/${slug}@${version}`, source: `https://clawhub.ai/${own}/skills/${slug}`, files, skipped, coverage: 'skill-folder', dirName: slug };
}

// grokpot, Claude Duet and other listing pages: follow a GitHub or SKILL.md link on the page.
async function fetchFromPage(f: F, url: string): Promise<Fetched> {
  const html = await getText(f, url);
  const abs = (h: string) => {
    try {
      return new URL(h, url).toString();
    } catch {
      return '';
    }
  };
  const links = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => abs(m[1]!.replace(/&amp;/g, '&')));
  const skillMd = links.find((l) => /SKILL\.md(\?|$)/i.test(l));
  if (skillMd) return fetchSkill(skillMd, f);
  const gh = links.find((l) => {
    const c = classifyUrl(l);
    return c?.kind === 'github' && !/github\.com\/(features|about|login|sponsors|orgs)\b/.test(l);
  });
  if (gh) return fetchSkill(gh, f);
  const ch = links.find((l) => classifyUrl(l)?.kind === 'clawhub');
  if (ch) return fetchSkill(ch, f);
  throw new Error('This page does not link to the skill files (no SKILL.md, GitHub or ClawHub link found).');
}
