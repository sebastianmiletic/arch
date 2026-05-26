# Arch Code Studio — Agent Context

## Project
Professional native macOS application (`.app`) for AI-assisted software development. Electron + React 19 + TypeScript frontend. Node.js + Express 5 + SQLite backend. Packaged by `electron-builder`.

## Architecture
- **Frontend**: `frontend/` — Vite, Tailwind v4, Framer Motion, Lucide icons, Zustand store.
- **Backend**: `server/` — Express 5 on port 3000, WebSocket on 3001, `better-sqlite3` with WAL mode.
- **Electron**: `main.js` spawns backend as subprocess (`node dist/server.js`), then loads `http://localhost:3000`.
- **macOS**: `pl-20` draggable header for traffic-light safety. `asar: false` so server files are directly accessible.

## Build
```bash
cd /Users/sebastianmiletic/Arch
npm run build          # builds frontend → server/public + tsc server
npx electron-builder --mac --arm64
codesign --force --deep --sign - release/mac-arm64/Arch.app
```

## Theme System
- **35+ curated themes** in `frontend/src/stores/themeGallery.ts` (rose, amber, emerald, violet, coral, slate, nord, dracula, monokai, gruvbox, tokyo, one_dark, pastel, paper, coffee, neon, matrix, cherry, peach, mint, lavender, gold, ice, rust, teal, bubblegum, high_contrast, warm, cool, sunset, dawn, sky, + more).
- Theme persistence via `localStorage` key `arch_settings`.
- Transparency support: `settings.transparency` sets CSS `opacity` on the app root and `--app-opacity` custom property.
- Theme gallery accessed via **Settings → View All** or the theme selector in `SettingsPanel.tsx`.

## Extension System
- All extensions are **pre-installed** — users **pin/unpin** to toolbar, not install/uninstall.
- `appStore.ts` has `togglePinExtension(id)` which adds/removes extension IDs from `settings.pinnedAddons`.
- `CenterPanel.tsx` renders pinned extension tabs from `settings.pinnedAddons`. No pinned tabs in the header bar.
- `ExtensionStore.tsx` shows all extensions with Pin/Unpin and Open buttons.

## Chat / Sessions (General AI Chat)
- `ChatPanel.tsx` provides a general-purpose AI chat with multi-provider support (OpenAI, Anthropic, Gemini, xAI, NVIDIA, Ollama, OpenRouter, OpenCode).
- **Persistent sessions** stored in Zustand + `localStorage` key `arch_sessions`.
- Sessions support **rename** (pencil icon) and **delete** (trash icon) via the session dropdown.
- Model name + context window shown under the ask bar.
- Slash commands: `/clear`, `/compact`, `/connect`, `/cost`, `/debug`, `/doc`, `/help`, `/image`, `/ls`, `/model`, `/models`, `/search`, `/web`.

## OpenCode CLI Integration (Right Panel)
- **RightPanel.tsx** houses the `OpenCodePanel.tsx` — a terminal-native CLI integration.
- Uses **`opencode run --format json`** via server routes:
  - `GET /api/opencode/models` — lists available models via `opencode models`
  - `GET /api/opencode/agents` — lists agents via `opencode agent list`
  - `GET /api/opencode/sessions` — lists sessions via `opencode session list --format json`
  - `POST /api/opencode/run` — **streaming** NDJSON via `spawn('opencode', ['run', '--format', 'json', ...])`
- The `run` route pipes stdout directly to response (application/x-ndjson), supports abort via `req.on('close', () => child.kill())`.
- Frontend parses line-delimited JSON events: `text`, `tool_use`, `tool_result`, `step_start`, `step_finish`, `error`.
- UI includes model/agent/session dropdowns, expanded/compact event views, session list drawer, and auto-expanding textarea input.
- OpenCode CLI is local — no API key required. Located at `/opt/homebrew/bin/opencode`.

## Providers (`server/src/providers.ts`)
- `chatWithProvider()` routes to `chatOpencode()` for `provider.id === 'opencode'`.
- `chatOpencode()` uses `spawn('opencode', ['run', '--format', 'json'])`, writes prompt to stdin, reads line-delimited JSON from stdout, concatenates `obj.part.text` fields.
- `sendSingleMessage()` wraps `chatWithProvider()` for swarm/one-shot calls.
- `listOllamaModels()` fetches from `/api/tags` or `/v1/models`.
- `testProvider()` supports all providers including opencode (uses `--version` check).

## Agent System (`server/src/agent.ts`)
- `runAgentChat()` executes the agent loop: analyze → plan → execute → verify.
- Uses `SYSTEM_PROMPT` that instructs the model to **never send code in text responses**, **never wrap tool calls in markdown**, and **always use tools** to edit files.
- Tools: `readFile`, `writeFile`, `editFile`, `deleteFile`, `runCommand`, `searchFiles`, `listFiles`.
- Each tool invocation returns structured data; agent decides next action based on tool results.

## File System Integration
- `LeftPanel.tsx` file tree — clicking a file navigates to `CodeViewer` in center panel (`setCenterTab('CodeViewer')`).
- `CodeViewer.tsx` (646KB gzipped, lazy loaded) shows file content with syntax highlighting.
- `GitHubViewer.tsx` provides full repo browsing, commit history, file tree, README rendering, and **repository creation**.

## Transparency
- Slider in SettingsPanel with presets: Solid, 90%, 75%, 60%, 40%.
- Applied as inline `style={{ opacity: transparency }}` on root App div.
- All themes must have visible/legible text and buttons at all opacity levels.

## Next Steps
1. ⬜ Verify OpenCode panel streams correctly in packaged `.app` (opencode binary in PATH).
2. ⬜ Consider adding opencode `attach` mode for connecting to existing server instances.
3. ⬜ Add opencode `export`/`import` session buttons in the panel.
4. ⬜ Test multi-provider swarm engine with Ollama + cloud providers in parallel.

## Critical Files
- `frontend/src/stores/appStore.ts` — Zustand store with themes, pinned extensions, settings, sessions, version.
- `frontend/src/stores/themeGallery.ts` — 35+ extended theme definitions.
- `frontend/src/types/index.ts` — Extended `ThemeId` (now `string`), `Message.role` includes `'error'`, `AppSettings` has `transparency`.
- `frontend/src/components/right/OpenCodePanel.tsx` — Terminal-native OpenCode CLI integration.
- `frontend/src/components/right/RightPanel.tsx` — Wrapper for OpenCodePanel.
- `frontend/src/features/SettingsPanel.tsx` — Theme selector, View All gallery, transparency slider.
- `frontend/src/features/ExtensionStore.tsx` — Pin-only extension UI.
- `server/src/routes.ts` — REST API including `/api/opencode/*` routes.
- `server/src/providers.ts` — `chatWithProvider`, `chatOpencode` (spawn), `sendSingleMessage`, `testProvider`.
- `server/src/agent.ts` — Agent loop with strict tool-based file editing prompt.
- `server/src/agent-tools.ts` — `readFile`, `writeFile`, `editFile`, `deleteFile`, `runCommand`, `searchFiles`, `listFiles`.
- `electron-builder.yml` — Packaging config (`asar: false`, `mac-arm64` target).
- `main.js` — Electron main process with backend subprocess spawn.
