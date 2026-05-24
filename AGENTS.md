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

## Key Decisions
- 6 theme system via CSS custom properties + Zustand (`orion`, `midnight`, `solar`, `forest`, `ocean`, `cyber`).
- Every feature is an `Extension` with `installed`, `category`, `component` fields. CenterPanel renders tabs dynamically from installed extensions list using `lazy()` + `Suspense`.
- Extension Store with 9 built-in + 7 optional extensions (install/uninstall toggle).
- Swarm Engine (`SwarmPanel.tsx`) dispatches a single prompt to multiple agents in parallel via `/api/swarm`. Each agent binds to a provider + model + systemPrompt + role.
- 6 default swarm agents: Debugger (codellama), Refactorer (llama3.2), Test Writer (llama3.1), Documenter, Security, Optimizer.
- ArchitectureViz is strictly 2D layered dependency graph (7 layers, 28 nodes). No 3D/Neural mode.
- `sendSingleMessage()` in `providers.ts` added for swarm single-shot calls with system prompt.

## Next Steps (from session)
1. ✅ Write `SwarmPanel.tsx` with job queue, agent selection, parallel execution UI.
2. ✅ Add `/api/swarm` POST endpoint that dispatches to multiple providers concurrently.
3. ✅ Rewrite `CenterPanel.tsx` to dynamically render tabs from `extensions.filter(e => e.installed)`.
4. ✅ Rebuild frontend and repackage macOS `.app`.
5. ⬜ Verify Swarm Engine dispatches to multiple Ollama models in parallel (requires Ollama running).

## Critical Files
- `frontend/src/stores/appStore.ts` — Zustand store with themes, extensions, swarm agents, skills.
- `frontend/src/types/index.ts` — Shared types: `Extension`, `SwarmAgent`, `SwarmJob`, `SwarmResult`.
- `frontend/src/components/center/CenterPanel.tsx` — Dynamic extension tab router with lazy loading.
- `frontend/src/features/SwarmPanel.tsx` — Swarm UI.
- `server/src/routes.ts` — REST API including `/api/swarm`.
- `server/src/providers.ts` — `chatWithProvider`, `sendSingleMessage`, `testProvider`.
- `electron-builder.yml` — Packaging config (`asar: false`, `mac-arm64` target).
- `main.js` — Electron main process with backend subprocess spawn.
- `release/mac-arm64/Arch.app/` — Packaged native macOS application.
