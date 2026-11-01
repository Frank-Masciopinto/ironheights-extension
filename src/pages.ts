// Decides which skill a supported page is about. Pure: takes the URL and the page's links.
export const BADGE_HOSTS = ['github.com', 'clawhub.ai', 'www.npmjs.com', 'smithery.ai', 'skills.sh', 'www.skills.sh', 'claude-plugins.dev'];

const GH_SKIP = /^https:\/\/github\.com\/(features|about|login|signup|sponsors|orgs|topics|marketplace|settings|site|pricing|enterprise|security|contact|readme|collections|trending)(\/|$)/i;

/** First GitHub repo or folder link on the page, ignoring GitHub's own pages and the site's own repo. */
export function firstGithubLink(links: string[], ignoreOwners: string[] = []): string | undefined {
  for (const raw of links) {
    let u: URL;
    try { u = new URL(raw); } catch { continue; }
    if (u.protocol !== 'https:' || u.hostname !== 'github.com') continue;
    const href = u.origin + u.pathname.replace(/\/$/, '');
    if (GH_SKIP.test(href)) continue;
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length < 2) continue;
    if (ignoreOwners.includes(parts[0]!.toLowerCase())) continue;
    if (parts.length > 2 && parts[2] !== 'tree' && parts[2] !== 'blob') { return `https://github.com/${parts[0]}/${parts[1]}`; }
    return href;
  }
  return undefined;
}

/**
 * For the sites added in 0.3.0. Returns the URL to scan, 'none' when the page is not a skill page,
 * or undefined when the page may still be rendering (keep checking).
 */
export function targetForNewSite(href: string, links: string[]): string | 'none' | undefined {
  const u = new URL(href);
  const parts = u.pathname.split('/').filter(Boolean);
  switch (u.hostname) {
    case 'www.npmjs.com':
      return parts[0] === 'package' && parts[1] ? `https://www.npmjs.com/package/${parts[1].startsWith('@') && parts[2] ? parts[1] + '/' + parts[2] : parts[1]}` : 'none';
    case 'skills.sh':
    case 'www.skills.sh':
      return parts.length === 3 ? `https://skills.sh/${parts.join('/')}` : 'none';
    case 'smithery.ai':
      if (!['server', 'servers', 'skills', 'skill'].includes(parts[0] ?? '') || parts.length < 2) return 'none';
      return firstGithubLink(links, ['smithery-ai']);
    case 'claude-plugins.dev':
      // /skills/@owner/repo/skill names the GitHub repo directly; plugin pages link it.
      if (parts[0] === 'skills' && parts.length === 4 && parts[1]!.startsWith('@')) return `https://claude-plugins.dev/${parts.join('/')}`;
      if (!['plugins', 'plugin'].includes(parts[0] ?? '') || parts.length < 2) return 'none';
      return firstGithubLink(links, ['kamalnrf']);
    default:
      return 'none';
  }
}

/** Errors that only mean "this package is not a skill"; the npm badge stays hidden for them. */
export function isNotASkill(error: string): boolean {
  return /No SKILL\.md found|does not link a GitHub repository/i.test(error);
}
