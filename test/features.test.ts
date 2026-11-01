import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseInstallSnippet, npmUrl } from '../src/snippets.ts';
import { targetForNewSite, firstGithubLink, isNotASkill } from '../src/pages.ts';
import { classifyUrl, fetchSkill, githubFromRepository } from '../src/sources.ts';
import { scanFiles } from '../src/engine.ts';

const urls = (t: string) => parseInstallSnippet(t).map((x) => x.url);

describe('install snippet parsing', () => {
  it('reads npx, npm, clawhub, skills and plugin commands', () => {
    expect(urls('npx -y @acme/mcp-server@1.2.0 --port 3')).toEqual(['https://www.npmjs.com/package/@acme/mcp-server']);
    expect(urls('$ npm i ironheights')).toEqual(['https://www.npmjs.com/package/ironheights']);
    expect(urls('pnpm add foo bar')).toEqual(['https://www.npmjs.com/package/foo', 'https://www.npmjs.com/package/bar']);
    expect(urls('clawhub install frank-masciopinto/ironheights')).toEqual(['https://clawhub.ai/frank-masciopinto/skills/ironheights']);
    expect(urls('npx clawhub install weather')).toEqual(['https://clawhub.ai/skills/weather']);
    expect(urls('npx skills add vercel-labs/agent-skills --skill web-design')).toEqual(['https://skills.sh/vercel-labs/agent-skills/web-design']);
    expect(urls('/plugin marketplace add Frank-Masciopinto/ironheights')).toEqual(['https://github.com/Frank-Masciopinto/ironheights']);
  });
  it('reads MCP config JSON', () => {
    const cfg = JSON.stringify({ mcpServers: { a: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'] }, b: { command: 'uvx', args: ['x'] } } });
    expect(urls(cfg)).toEqual(['https://www.npmjs.com/package/@modelcontextprotocol/server-github']);
  });
  it('ignores ordinary text and bad names', () => {
    expect(urls('hello world, npm is great')).toEqual([]);
    expect(urls('')).toEqual([]);
    expect(npmUrl('../evil')).toBeUndefined();
  });
});

describe('new badge sites', () => {
  it('maps pages to scan targets', () => {
    expect(targetForNewSite('https://www.npmjs.com/package/@a/b', [])).toBe('https://www.npmjs.com/package/@a/b');
    expect(targetForNewSite('https://www.npmjs.com/search?q=x', [])).toBe('none');
    expect(targetForNewSite('https://skills.sh/o/r/s', [])).toBe('https://skills.sh/o/r/s');
    expect(targetForNewSite('https://www.skills.sh/o/r/s', [])).toBe('https://skills.sh/o/r/s');
    expect(targetForNewSite('https://smithery.ai/server/x', ['https://github.com/features', 'https://github.com/smithery-ai/cli', 'https://github.com/o/r/tree/main/s'])).toBe('https://github.com/o/r/tree/main/s');
    expect(targetForNewSite('https://smithery.ai/server/x', [])).toBeUndefined();
    expect(targetForNewSite('https://claude-plugins.dev/skills/@o/r/s', [])).toBe('https://claude-plugins.dev/skills/@o/r/s');
    expect(targetForNewSite('https://claude-plugins.dev/plugins/x', ['https://github.com/Kamalnrf/claude-plugins', 'https://github.com/o/r/issues'])).toBe('https://github.com/o/r');
    expect(targetForNewSite('https://claude-plugins.dev/skills', [])).toBe('none');
    expect(targetForNewSite('https://smithery.ai/', [])).toBe('none');
    expect(firstGithubLink(['not a url'])).toBeUndefined();
    expect(isNotASkill('No SKILL.md found at this GitHub location.')).toBe(true);
  });
  it('classifies npm and skills.sh URLs', () => {
    expect(classifyUrl('https://www.npmjs.com/package/@a/b')).toEqual({ kind: 'npm', name: '@a/b' });
    expect(classifyUrl('https://claude-plugins.dev/skills/@anthropics/skills/docx')).toMatchObject({ kind: 'github', owner: 'anthropics', repo: 'skills', skill: 'docx' });
    expect(classifyUrl('https://skills.sh/o/r/s')).toMatchObject({ kind: 'github', owner: 'o', repo: 'r', skill: 's' });
    expect(githubFromRepository({ url: 'git+https://github.com/o/r.git', directory: 'packages/x' })).toEqual({ owner: 'o', repo: 'r', path: 'packages/x' });
    expect(githubFromRepository('github:o/r')).toEqual({ owner: 'o', repo: 'r', path: '' });
    expect(githubFromRepository({ url: 'https://gitlab.com/o/r' })).toBeUndefined();
  });
  const mal = ['SKILL.md', 'setup.sh'].map((f) => readFileSync(join(__dirname, 'fixtures/malicious', f), 'utf8'));
  const tree = (paths: string[]) => JSON.stringify({ truncated: false, tree: paths.map((path) => ({ path, type: 'blob', size: 10 })) });
  it('scans an npm package through its GitHub repository (stub fetch)', async () => {
    const seen: string[] = [];
    const stub = (async (u: string) => {
      seen.push(u);
      if (u.startsWith('https://registry.npmjs.org/')) return new Response(JSON.stringify({ version: '1.0.0', repository: { url: 'git+https://github.com/o/r.git' } }));
      if (u.endsWith('/repos/o/r')) return new Response(JSON.stringify({ default_branch: 'main' }));
      if (u.includes('/git/trees/')) return new Response(tree(['SKILL.md', 'setup.sh']));
      return new Response(u.endsWith('SKILL.md') ? mal[0] : mal[1]);
    }) as typeof fetch;
    const got = await fetchSkill('https://www.npmjs.com/package/@x/y', stub);
    expect(seen[0]).toBe('https://registry.npmjs.org/@x%2Fy/latest');
    expect(got.name).toBe('@x/y@1.0.0');
    expect(scanFiles(got.files).grade).toBe('F');
  });
  it('picks the named skill folder for skills.sh', async () => {
    const stub = (async (u: string) => {
      if (u.endsWith('/repos/o/r')) return new Response(JSON.stringify({ default_branch: 'main' }));
      if (u.includes('/git/trees/')) return new Response(tree(['a/SKILL.md', 'skills/target/SKILL.md']));
      return new Response('---\nname: t\ndescription: d\n---\nhi');
    }) as typeof fetch;
    const got = await fetchSkill('https://skills.sh/o/r/target', stub);
    expect(got.source).toBe('https://github.com/o/r/tree/main/skills/target');
  });
});

describe('manifest', () => {
  const m = JSON.parse(readFileSync(join(__dirname, '../static/manifest.json'), 'utf8'));
  it('keeps permissions narrow', () => {
    expect(m.permissions).toEqual(['contextMenus', 'storage']);
    expect(m.host_permissions.some((h: string) => h.includes('<all_urls>') || h.startsWith('*://') || h === 'https://*/*')).toBe(false);
    expect(m.description.length).toBeLessThanOrEqual(132);
    expect(m.description).toMatch(/any AI bot/);
  });
});
