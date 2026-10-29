import { scanFiles, type ScanResult } from './engine.ts';
import { fetchSkill } from './sources.ts';

export interface FullResult extends ScanResult {
  source: string;
  coverage: 'skill-folder' | 'single-file';
  scannedAt: string;
}

export async function scanUrl(url: string): Promise<FullResult> {
  const got = await fetchSkill(url);
  const r = scanFiles(got.files, { name: got.name, ...(got.dirName ? { dirName: got.dirName } : {}), skipped: got.skipped });
  return { ...r, skillName: r.skillName || got.name, source: got.source, coverage: got.coverage, scannedAt: new Date().toISOString() };
}
