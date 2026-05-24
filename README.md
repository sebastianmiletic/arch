# Arch Code Studio

A professional, native macOS application for AI-assisted software development. Built with Electron, React 19, TypeScript, and Express — packaged as a standalone `.app` that you can launch from Spotlight.

![Arch Code Studio](frontend/src/assets/hero.png)

## Overview

Arch Code Studio is a modular AI development environment that brings together:

- **Extension Store** — Install/uninstall capabilities like a real app marketplace
- **Swarm Engine** — Dispatch a single prompt to multiple AI models simultaneously, each with a specialized role
- **2D Architecture Visualizer** — Explore your codebase as a layered dependency graph
- **Autonomous Loop** — 8-stage iterative development cycle (analyze → plan → build → test → debug → improve → verify → commit)
- **Model Arena** — Compare responses from multiple providers side-by-side
- **Codebase Search** — Search filenames and contents across your entire project
- **Skills Registry** — 15 toggleable capabilities from code generation to Docker
- **Test Runner** — Simulated test suite with pass/fail metrics and retry

## Architecture

- **Frontend**: React 19 + Vite + Tailwind v4 + Framer Motion + Zustand
- **Backend**: Express 5 + better-sqlite3 + WebSocket server
- **Packaging**: Electron Builder → standalone `.app` with embedded backend
- **macOS**: Traffic-light-safe header (`hiddenInset`), draggable regions, 6 theme schemes

## Installation

### Pre-built Binary (Recommended)

1. Download the latest `Arch.app` from the [Releases](https://github.com/sebastianmiletic/arch/releases) page
2. Move `Arch.app` to your `/Applications` folder
3. Launch via Spotlight (`Cmd+Space`, type "Arch") or double-click in Finder

> **Note**: Since the app is not signed with an Apple Developer ID, macOS may show a security warning on first launch. Right-click the app and select **Open**, or go to **System Settings → Privacy & Security → Security** and click **Open Anyway**.

### Build from Source

#### Prerequisites

- macOS (arm64 or x64)
- Node.js 20+
- npm or yarn

#### Steps

```bash
# 1. Clone the repository
git clone https://github.com/sebastianmiletic/arch.git
cd arch

# 2. Install root dependencies
npm install

# 3. Install frontend dependencies
cd frontend && npm install && cd ..

# 4. Install backend dependencies
cd server && npm install && cd ..

# 5. Build frontend + compile server
npm run build

# 6. Package as .app
npx electron-builder --mac --arm64

# 7. (Optional) Copy server node_modules into bundle for offline use
cp -R server/node_modules release/mac-arm64/Arch.app/Contents/Resources/server/

# 8. Ad-hoc sign the app
codesign --force --deep --sign - release/mac-arm64/Arch.app

# 9. Move to Applications
cp -R release/mac-arm64/Arch.app /Applications/Arch.app
```

## Usage

### First Launch

When you open Arch, the app:
1. Starts an embedded Express server on `localhost:3000`
2. Opens a WebSocket on `localhost:3001`
3. Renders the React UI in a native macOS window

The first launch may take 5–10 seconds while the backend initializes the SQLite database.

### Main Panels

| Panel | Description |
|-------|-------------|
| **Left** | File tree, change feed, action log |
| **Center** | Dynamic workspace tabs — Loop, Search, Arch Viz, Swarm, Models, Skills, Tests, Settings, Store |
| **Right** | Chat console + provider settings |

### Swarm Engine

1. Go to the **Swarm** tab
2. Select agents (Debugger, Refactorer, Test Writer, etc.)
3. Enter a prompt describing the task
4. Click **Run Swarm**
5. Each agent dispatches to its configured model in parallel
6. Results appear with latency, token count, and per-agent output

### Extension Store

1. Go to the **Store** tab
2. Browse built-in and optional extensions
3. Click **Install** to add a new tab to the center panel
4. Click **Uninstall** to remove it
5. All extensions are dynamically loaded with lazy imports

### Themes

6 color schemes available in **Settings**:
- **Orion** — Monochrome dark (default)
- **Midnight** — Deep blue accent
- **Solar** — Warm light
- **Forest** — Green accent
- **Ocean** — Cyan accent
- **Cyber** — Purple/pink neon

## Project Structure

```
arch/
├── main.js                 # Electron main process (spawns backend)
├── electron/
│   ├── main.js             # Dev entry point
│   └── preload.js          # Context bridge
├── electron-builder.yml    # Packaging configuration
├── frontend/
│   ├── src/
│   │   ├── App.tsx         # Root layout
│   │   ├── main.tsx        # React entry
│   │   ├── index.css       # Theme CSS variables
│   │   ├── stores/
│   │   │   └── appStore.ts # Zustand global state
│   │   ├── types/
│   │   │   └── index.ts    # Shared TypeScript types
│   │   ├── components/
│   │   │   ├── center/
│   │   │   │   └── CenterPanel.tsx  # Dynamic tab router
│   │   │   ├── left/
│   │   │   │   └── LeftPanel.tsx
│   │   │   └── right/
│   │   │       ├── RightPanel.tsx
│   │   │       ├── ChatPanel.tsx
│   │   │       └── ProviderSettings.tsx
│   │   ├── features/
│   │   │   ├── SwarmPanel.tsx       # Multi-model orchestration
│   │   │   ├── ArchitectureViz.tsx  # 2D dependency graph
│   │   │   ├── ExtensionStore.tsx   # Marketplace
│   │   │   ├── CodebaseSearch.tsx
│   │   │   ├── ModelComparison.tsx
│   │   │   ├── TestingDashboard.tsx
│   │   │   ├── SkillsPanel.tsx
│   │   │   └── SettingsPanel.tsx
│   │   └── services/
│   │       ├── api.ts      # REST API client
│   │       └── ws.ts       # WebSocket client
│   └── vite.config.ts      # Vite build config
├── server/
│   ├── src/
│   │   ├── server.ts       # Express entry
│   │   ├── routes.ts       # REST API routes (incl. /api/swarm)
│   │   ├── providers.ts    # LLM provider integrations
│   │   ├── db.ts           # SQLite schema + queries
│   │   ├── ws.ts           # WebSocket server
│   │   ├── features.ts     # Feature seeding
│   │   ├── fs-utils.ts     # File tree scanner
│   │   ├── loop.ts         # Autonomous loop logic
│   │   └── types.ts        # Backend types
│   ├── dist/               # Compiled JavaScript
│   ├── public/             # Frontend production build
│   └── package.json
├── build/
│   └── icon.icns           # macOS app icon
└── AGENTS.md               # Agent context for AI assistants
```

## Configuration

### AI Providers

Arch supports 7 provider backends out of the box:

| Provider | Default Base URL | Required |
|----------|------------------|----------|
| Ollama | `http://localhost:11434` | — |
| OpenAI | `https://api.openai.com/v1` | API key |
| Anthropic | `https://api.anthropic.com` | API key |
| Gemini | `https://generativelanguage.googleapis.com` | API key |
| OpenRouter | `https://openrouter.ai/api/v1` | API key |
| NVIDIA NIM | `https://integrate.api.nvidia.com/v1` | API key |
| Local Endpoint | `http://localhost:8000/v1` | — |

Enable/disable providers and set API keys in the **Provider Settings** panel (right sidebar).

### Swarm Agents

Default agents are configured in `frontend/src/stores/appStore.ts`:

| Agent | Role | Model | System Prompt |
|-------|------|-------|---------------|
| Debugger | `debug` | `codellama` | Find and explain bugs |
| Refactorer | `refactor` | `llama3.2` | Improve structure safely |
| Test Writer | `test` | `llama3.1` | Write comprehensive tests |
| Documenter | `docs` | `llama3.2` | Write clear documentation |
| Security | `security` | `llama3.1` | Scan for vulnerabilities |
| Optimizer | `optimize` | `codellama` | Find bottlenecks |

## Development

### Run in Development Mode

```bash
# Terminal 1 — start backend
cd server
npm run dev        # tsx src/server.ts

# Terminal 2 — start frontend
cd frontend
npm run dev        # vite dev server on :5173

# Terminal 3 — start Electron shell
npm run dev        # electron . with NODE_ENV=development
```

### Build for Production

```bash
npm run build      # builds frontend + compiles server TypeScript
```

### Package as .app

```bash
npx electron-builder --mac --arm64
```

## Troubleshooting

### App shows a black screen

This usually means the backend failed to start. Check logs:

```bash
cat ~/Library/Application\ Support/Arch/logs/main-*.log
```

Common causes:
- **Port 3000 already in use** — Kill the existing process: `lsof -ti:3000 | xargs kill -9`
- **Server node_modules missing** — Copy them into the app bundle: `cp -R server/node_modules /Applications/Arch.app/Contents/Resources/server/`
- **GPU sandbox crash** — Already mitigated with `--disable-gpu-sandbox` in `main.js`

### macOS Gatekeeper blocks the app

Since the app is ad-hoc signed (not Apple Developer signed):

```bash
xattr -cr /Applications/Arch.app
```

Or go to **System Settings → Privacy & Security** and click **Open Anyway**.

### Backend health check fails

The frontend polls `localhost:3000/api/health`. If it fails after 30 seconds:

1. Check if the backend process is running: `lsof -i:3000`
2. Try running the backend manually: `node /Applications/Arch.app/Contents/Resources/server/dist/server.js`
3. Look for `better-sqlite3` native module errors — it may need rebuilding for Electron's Node version

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI Framework | React 19, TypeScript |
| Styling | Tailwind CSS v4, CSS custom properties |
| State | Zustand |
| Animation | Framer Motion |
| Icons | Lucide React |
| Syntax Highlight | PrismJS |
| Backend | Express 5, better-sqlite3 |
| Real-time | WebSocket (`ws`) |
| Bundling | Vite |
| Packaging | Electron Builder |
| Database | SQLite (WAL mode) |

## License

MIT © 2026 Arch Team

## Contributing

Pull requests welcome. Please read `AGENTS.md` for agent-focused context on the codebase architecture.
