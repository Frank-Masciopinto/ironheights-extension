# Chrome Web Store listing draft — Ironheights 0.1.0 (NOT submitted)

**Title (≤75):** Ironheights – AI Skill Scanner

**Short description (≤132):** Grade AI agent skills before you install them. A–F badges on GitHub and ClawHub. Local scan, no telemetry.

**Category:** Developer Tools · **Language:** English

## Long description
Ironheights grades AI agent skills before you install them, right in your browser.

A "skill" is any folder with a SKILL.md: the add-ons that OpenClaw, Claude, Grok Bot, Codex, Cursor and other AI bots load as instructions and scripts. A malicious one can tell your agent to run a remote installer, read your SSH keys or API tokens, or send them somewhere. Ironheights protects any AI bot's skills, whichever marketplace they come from.

What it does
• Grade badge (A–F) next to the title on ClawHub skill pages and on GitHub folders that contain a SKILL.md. Hover for the top findings, click for the full report.
• Right-click any skill link (GitHub, ClawHub, grokpot, or a raw SKILL.md) → "Scan with Ironheights" for a full report: severity, rule, file and line, the exact evidence, and how to fix it.
• Paste a link in the popup to scan it.

How it checks
• The same rule engine as the open-source Ironheights CLI (npm: ironheights): pipe-to-shell installers, encoded payloads, credential and secret access, exfiltration, prompt injection, persistence, privilege escalation, risky MCP config and more.
• Skill files are downloaded as plain text and never executed.
• If any file could not be scanned (binaries, very large files), you get "Incomplete" instead of a letter. Ironheights won't give a grade for a review it didn't do.

Privacy
• Scans run on your device. Nothing about you, your browsing or the skills you scan is sent to Ironheights. There's no account, no analytics and no telemetry.
• The only network requests fetch the skill files you asked about, directly from GitHub, ClawHub or grokpot.

No findings is not proof of safety. Ironheights catches known patterns, so still read what a skill does before you install it. For install-time baselines and a runtime guard, use the CLI: https://ironheights.dev

Open source (Apache-2.0): https://github.com/Frank-Masciopinto/ironheights

## Single purpose
Shows a security grade for AI agent skills (SKILL.md folders) on skill pages and links, so users can check a skill before installing it.

## Permission justifications
- **contextMenus:** adds "Scan with Ironheights" to the right-click menu on links and skill pages.
- **storage:** saves one setting, whether badges are shown automatically. Nothing else is stored.
- **Host permission https://github.com/\*:** the content script shows the badge on GitHub folders that contain a SKILL.md.
- **Host permission https://api.github.com/\*:** lists the files in the skill folder being scanned. Requests are anonymous.
- **Host permission https://raw.githubusercontent.com/\*:** downloads those skill files as text so they can be scanned.
- **Host permission https://clawhub.ai/\*:** shows the badge on ClawHub skill pages and downloads the skill's files through ClawHub's public API.
- **Host permission https://grokpot.io/\*:** reads a grokpot listing page to find its SKILL.md or source link when the user right-clicks it.
- **Remote code:** None. All JavaScript is in the package. Downloaded skill files are treated as text and never run.

## Privacy practices tab
- Data collected: **none** (leave every category unchecked).
- Certify: data is not sold, not used or transferred for purposes unrelated to the single purpose, and not used for creditworthiness or lending.
- Privacy policy URL: https://ironheights.dev/privacy. **This page needs to exist before you submit** (add an "Extension" section saying no data is collected).

## Assets
- Icon 128: static/icons/128.png
- Screenshots 1280x800: store/screenshot-1-report.png, -2-badge.png, -3-clawhub.png, -4-popup.png
- Small promo tile 440x280: store/promo-small-440x280.png
