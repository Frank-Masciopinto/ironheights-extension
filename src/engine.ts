// Ironheights scan engine for the browser. It reuses the CLI's content rules
// (vendor/ironheights, Apache-2.0) unchanged. Files are scanned as text; nothing is executed.
import { scanFile, isInstallToolMetadata } from '../vendor/ironheights/core/scanner.ts';
import { emptyConfig } from '../vendor/ironheights/core/config.ts';
import { classifyFile } from '../vendor/ironheights/core/filetype.ts';
import { gradeRiskFor, scoreFindings, verdictFor } from '../vendor/ironheights/core/verdict.ts';
import { gradeFor } from '../vendor/ironheights/core/grade.ts';
import { parseSkillMarkdown } from '../vendor/ironheights/openclaw/skill.ts';
import { skillHoldsAmbientSecret } from '../vendor/ironheights/rules/ambient-env.ts';
import { SAFETY_REMINDER, TOOL_VERSION } from '../vendor/ironheights/version.ts';
import type { Finding, ScanContext, ScannedFile } from '../vendor/ironheights/core/types.ts';

export { SAFETY_REMINDER };
export const ENGINE_VERSION = TOOL_VERSION;

export interface InputFile {
  path: string;
  text: string;
}

export interface ScanResult {
  skillName: string;
  grade: string; // A-F, or 'incomplete' / 'nothing-scanned'
  score?: number;
  verdict: string;
  findings: Finding[];
  filesScanned: number;
  skipped: { file: string; reason: string }[];
  engineVersion: string;
  disclaimer: string;
}

// IH-REF-001 checks referenced files exist on disk; the browser has no disk view of the skill.
const BROWSER_DISABLED_RULES = ['IH-REF-001'];
const MAX_FILE_BYTES = 1024 * 1024;

export function scanFiles(
  input: InputFile[],
  opts: { name?: string; dirName?: string; skipped?: { file: string; reason: string }[] } = {},
): ScanResult {
  const config = emptyConfig({
    ruleOverrides: Object.fromEntries(BROWSER_DISABLED_RULES.map((id) => [id, { enabled: false }])),
  });
  const skipped = [...(opts.skipped ?? [])];
  const files: ScannedFile[] = [];
  for (const f of input) {
    const bytes = new TextEncoder().encode(f.text);
    if (bytes.length > MAX_FILE_BYTES) {
      skipped.push({ file: f.path, reason: 'larger than 1 MB' });
      continue;
    }
    const head = bytes.subarray(0, 64);
    const { kind, archive } = classifyFile(f.path, head);
    files.push({
      relativePath: f.path,
      kind,
      archive,
      size: bytes.length,
      mode: 0o644,
      text: kind === 'binary' ? '' : f.text,
      head,
      symlinkOutside: false,
      symlinkLoop: false,
      hidden: f.path.split('/').some((p) => p.startsWith('.')),
    });
  }
  const skillFile = files.find((f) => /(^|\/)SKILL\.md$/i.test(f.relativePath));
  const fm = skillFile ? parseSkillMarkdown(skillFile.text, skillFile.relativePath) : undefined;
  const ctx: ScanContext = {
    config,
    root: '(browser)',
    // Only check the folder-name rule when we know the real folder name.
    skillDirName: opts.dirName ?? (fm as { name?: string } | undefined)?.name ?? 'skill',
    skillAllowDomains: fm?.allowDomains ?? [],
    skillDeclaredHosts: (fm as { declaredHosts?: string[] } | undefined)?.declaredHosts ?? [],
    skillHoldsSecret: skillHoldsAmbientSecret(files.filter((f) => !isInstallToolMetadata(f.relativePath))),
  };
  const findings: Finding[] = [];
  for (const file of files) findings.push(...scanFile(file, ctx));
  const order = { critical: 4, high: 3, medium: 2, low: 1, info: 0 } as const;
  findings.sort((a, b) => order[b.severity] - order[a.severity]);
  const verdict = verdictFor(findings, config.thresholds, { filesSkipped: skipped.length });
  let grade = gradeFor(gradeRiskFor(findings), skipped.length);
  if (files.length === 0) grade = { letter: 'nothing-scanned', disclaimer: SAFETY_REMINDER } as typeof grade;
  void scoreFindings;
  return {
    skillName: (fm as { name?: string } | undefined)?.name ?? opts.name ?? 'skill',
    grade: grade.letter,
    ...(grade.score !== undefined ? { score: grade.score } : {}),
    verdict,
    findings,
    filesScanned: files.length,
    skipped,
    engineVersion: TOOL_VERSION,
    disclaimer: SAFETY_REMINDER,
  };
}
