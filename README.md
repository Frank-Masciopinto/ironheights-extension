# Ironheights browser extension (v0.2.0)

Grade AI agent skills (any folder with a `SKILL.md`: OpenClaw, Claude, Grok Bot, Codex, Cursor, and other AI bots) before you install them. It's the skill-focused counterpart to VirusTotal's VT4Browsers.

- A–F badge on ClawHub skill pages and GitHub folders containing a `SKILL.md`
- Right-click a skill link → **Scan with Ironheights** opens a full report
- Popup with a link box and an auto-badge on/off setting
- Each finding is tagged with its OWASP Top 10 for LLM (2025) id and OpenCRE ids, with static links to the OpenCRE fix guidance (no extra network calls)

Scans are local. Files are fetched as text and never executed, and there is no telemetry. The engine is the Ironheights CLI rule set, vendored unchanged from `vendor/ironheights` (CLI commit in `vendor/ironheights/COMMIT`). Node built-ins are shimmed for the browser. IH-REF-001 (referenced file exists on disk) is turned off because the browser has no disk view of the skill. **No findings is not proof of safety.**

```
npm install
npm test            # engine + source tests (malicious fixture -> F, benign -> A)
npm run build       # dist/ = unpacked extension (chrome://extensions → Load unpacked)
npm run zip         # ironheights-extension-0.2.0.zip
node scripts/e2e.mjs  # loads dist/ in Chromium, scans live pages, writes store/raw screenshots
node scripts/store-art.mjs
```

Firefox: the manifest declares `background.scripts` and a gecko id. Load it from `about:debugging`. Not yet tested in Firefox.
