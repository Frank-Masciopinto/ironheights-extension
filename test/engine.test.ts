import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { scanFiles } from '../src/engine.ts';
import { classifyUrl, fetchSkill } from '../src/sources.ts';

const load = (dir: string) =>
  readdirSync(join(__dirname, 'fixtures', dir)).map((f) => ({
    path: f,
    text: readFileSync(join(__dirname, 'fixtures', dir, f), 'utf8'),
  }));

describe('engine', () => {
  it('grades a known-malicious skill F with a block verdict', () => {
    const r = scanFiles(load('malicious'));
    expect(r.grade).toBe('F');
    expect(r.verdict).toBe('block');
    expect(r.findings.some((f) => f.severity === 'critical')).toBe(true);
    expect(r.disclaimer).toMatch(/not proof of safety/);
  });
  it('passes a benign skill', () => {
    const r = scanFiles(load('benign'));
    expect(r.grade).toBe('A');
    expect(r.verdict).toBe('no-findings');
    expect(r.findings).toHaveLength(0);
  });
  it('never claims a grade when nothing was scanned', () => {
    expect(scanFiles([]).grade).toBe('nothing-scanned');
  });
  it('marks skipped files incomplete instead of grading', () => {
    expect(scanFiles(load('benign'), { skipped: [{ file: 'x.bin', reason: 'binary' }] }).grade).toBe('incomplete');
  });
});

describe('sources', () => {
  it('classifies skill links', () => {
    expect(classifyUrl('https://github.com/a/b/tree/main/skills/x')).toMatchObject({ kind: 'github', path: 'skills/x' });
    expect(classifyUrl('https://github.com/a/b/blob/main/skills/x/SKILL.md')).toMatchObject({ kind: 'github', path: 'skills/x' });
    expect(classifyUrl('https://clawhub.ai/frank-masciopinto/skills/ironheights')).toMatchObject({ kind: 'clawhub', slug: 'ironheights' });
    expect(classifyUrl('https://raw.githubusercontent.com/a/b/main/SKILL.md')).toMatchObject({ kind: 'raw' });
    expect(classifyUrl('http://github.com/a/b')).toBeUndefined();
  });
  it('fetches a GitHub skill folder through the API with a stub fetch', async () => {
    const mal = load('malicious');
    const stub = (async (u: string) => {
      const body = u.includes('/git/trees/')
        ? JSON.stringify({ truncated: false, tree: [
            { path: 'skills/evil/SKILL.md', type: 'blob', size: 10 },
            { path: 'skills/evil/setup.sh', type: 'blob', size: 10 },
            { path: 'README.md', type: 'blob', size: 10 } ] })
        : u.endsWith('SKILL.md') ? mal[0]!.text : mal[1]!.text;
      return new Response(body, { status: 200 });
    }) as typeof fetch;
    const got = await fetchSkill('https://github.com/a/b/tree/main/skills/evil', stub);
    expect(got.files.map((f) => f.path).sort()).toEqual(['SKILL.md', 'setup.sh']);
    expect(scanFiles(got.files).grade).toBe('F');
  });
});

describe('OWASP / OpenCRE tags (0.2.0)', () => {
  it('tags an instruction override with LLM01 and CRE 012-625, links are static', async () => {
    const { tagFinding } = await import('../src/engine.ts');
    const t = tagFinding({ ruleId: 'IH-INJ-001', severity: 'high', confidence: 'high', file: 'SKILL.md', evidence: 'x', message: 'm', remediation: 'r' } as any);
    expect(t.standards).toBe('OWASP LLM01:2025 · CRE 012-625');
    expect(t.links.map((l) => l.url)).toContain('https://www.opencre.org/cre/012-625');
    expect(t.rulePage).toBe('https://www.ironheights.dev/rules/ih-inj-001');
  });
});
