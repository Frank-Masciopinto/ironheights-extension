# Ironheights browser extension (v0.3.0)

**Ironheights: The Immune System for AI Agents.** Catch bad skills before they spread.

Grade AI agent skills (any folder with a `SKILL.md`: OpenClaw, Claude, Grok Bot, Codex, Cursor, and other AI bots) before you install them. It's the skill-focused counterpart to VirusTotal's VT4Browsers.

Ironheights protects any AI bot that installs it, and this extension checks skills before they reach your bot.

- A–F badge on ClawHub skill pages and GitHub folders containing a `SKILL.md`
- **New in 0.3.0:** badge on npmjs.com package pages (when the package's GitHub repo has a `SKILL.md`), smithery.ai skill/server pages, skills.sh and claude-plugins.dev skill pages
- **New in 0.3.0: copy warning.** Copy an install snippet (`npx …`, `npm i …`, `clawhub install …`, `npx skills add …`, `/plugin marketplace add …`, or MCP config JSON) on one of those sites and a toast shows the verdict before you paste. It never blocks the copy. Turn it off in the popup.
- Right-click a skill link → **Scan with Ironheights** opens a full report
- Popup with a link box and an auto-badge on/off setting
- Each finding is tagged with its OWASP Top 10 for LLM (2025) id and OpenCRE ids, with static links to the OpenCRE fix guidance (no extra network calls)

Scans are local. Files are fetched as text and never executed, and there is no telemetry. The engine is the Ironheights CLI rule set, vendored unchanged from `vendor/ironheights` (CLI commit in `vendor/ironheights/COMMIT`). Node built-ins are shimmed for the browser. IH-REF-001 (referenced file exists on disk) is turned off because the browser has no disk view of the skill. **No findings is not proof of safety.**

```
npm install
npm test            # engine + source tests (malicious fixture -> F, benign -> A)
npm run build       # dist/ = unpacked extension (chrome://extensions → Load unpacked)
npm run zip         # ironheights-extension-0.3.0.zip
node scripts/e2e.mjs  # loads dist/ in Chromium, scans live pages, writes store/raw screenshots
node scripts/store-art.mjs
```

Firefox: the manifest declares `background.scripts` and a gecko id. Load it from `about:debugging`. Not yet tested in Firefox.

## Permissions and data (0.3.0)

- New host permission: `https://registry.npmjs.org/*`, used only to read an npm package's public `repository` field so the extension knows which GitHub folder to scan. The request contains only the package name, with no cookies.
- Content scripts now also run on `www.npmjs.com`, `smithery.ai`, `skills.sh`/`www.skills.sh` and `claude-plugins.dev`. No `<all_urls>`, no `clipboardRead`. The copy warning only works on supported sites.
- A small script in the page's own context (`copyhook.js`, on the same sites only) passes text given to `navigator.clipboard.writeText` to the extension, because copy buttons don't fire a copy event. The text is parsed locally and never stored or sent anywhere. Only the parsed package/skill name is looked up on the sources above.
