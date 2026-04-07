# Style Inspector — Reference Documentation

The Claude Code skill definition lives at:
```
.claude/skills/style-inspector/SKILL.md
```

This file is a human-readable reference only. See the skill file for the authoritative instructions Claude uses.

---

## Server

```bash
cd /home/minh-ngu/LLMbrowserExtension/tools
server/venv/bin/python3 server/server.py   # port 5001
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/status` | `{"connected": bool}` — is extension connected |
| POST | `/inspect` | Extract styles for a CSS selector on a URL; optional `property` field to return a single value |
| POST | `/execute` | Run JS in a page, return value + console logs |
| POST | `/reload` | Reload a page and return its `<title>` once loaded |

## `/inspect` — `property` field

Pass `property` to return a single value instead of the full response:

```bash
# single value
curl -s -X POST http://localhost:5001/inspect \
  -H 'Content-Type: application/json' \
  -d '{"url": "http://localhost:8001", "path": "img.hero", "property": "[\"box\"][\"width\"]"}'
# → 1265

# sub-object
  -d '{"url": "...", "path": "...", "property": "[\"computed\"]"}'
# → { "font-size": "16px", "color": "...", ... }
```

Uses bracket notation: `["topKey"]["subKey"]`. If omitted, the full `{ box, computed, rules }` object is returned.

---

## Files

| File | Role |
|------|------|
| `server/server.py` | Flask server — WebSocket bridge + HTTP endpoints |
| `src/background.js` | Chrome service worker — WS client, tab management, script injection |
| `src/content.jsx` | Content script — style extraction, message listener |
| `src/styleExtractor.js` | `getComputedStyle`, `getBoundingClientRect`, `css-tree` parsing |
| `src/Panel.jsx` | React floating inspector UI |
| `dist/` | Bundled output (esbuild) — loaded by Chrome |
| `manifest.json` | Chrome MV3 manifest |
