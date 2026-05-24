# Arch Code Studio

<p align="center">
  <img src="build/logo.png" width="120" alt="Arch Code Studio Logo" />
</p>

A professional, native macOS application for AI-assisted software development. Built with Electron, React 19, TypeScript, and Express — packaged as a standalone `.app` that you can launch from Spotlight.

## Overview

Arch Code Studio is a modular AI development environment that brings together:

- **Home Dashboard** — Project overview with directory picker, file stats, language breakdown, and recent projects
- **Extension Store** — Install/uninstall capabilities like a real app marketplace
- **Swarm Engine** — Dispatch a single prompt to multiple AI models simultaneously, each with a specialized role
- **2D Architecture Visualizer** — Explore your codebase as a layered dependency graph
- **Model Arena** — Compare responses from multiple providers side-by-side
- **Codebase Search** — Search filenames and contents across your entire project
- **Skills Registry** — 15 toggleable capabilities from code generation to Docker
- **Test Runner** — Simulated test suite with pass/fail metrics and retry
- **GitHub Viewer** — Browse repos, commits, file trees, and READMEs
- **Custom Themes** — 6 built-in presets plus a full custom theme editor with JSON import/export

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
- npm

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

# 7. Copy server node_modules into bundle (required for backend to start)
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

### Home Dashboard

The Home tab is your landing screen:
- **Open a Project** — Click the directory picker to select any folder on your Mac
- **Project Stats** — Once opened, see file count, line count, language breakdown, git commits, and last modified date
- **Recent Projects** — Previously opened projects are saved and clickable
- **Quick Start** — Jump to Search, Settings, Swarm, or Store

### Main Panels

| Panel | Description |
|-------|-------------|
| **Left** | File tree, change feed, action log |
| **Center** | Dynamic workspace tabs — Home, Search, Arch Viz, Swarm, Models, Skills, Tests, Settings, Store |
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

6 built-in color schemes + 1 fully customizable preset:

- **Orion** — Monochrome dark (default)
- **Midnight** — Deep blue accent
- **Solar** — Warm light
- **Forest** — Green accent
- **Ocean** — Cyan accent
- **Cyber** — Purple/pink neon
- **Custom** — Build your own with 6 color pickers + JSON import/export

To create a custom theme:
1. Go to **Settings** → **Theme**
2. Select the **Custom** preset
3. Use the color pickers to adjust Background, Surface, Text, Accent, Border, and Danger
4. Or paste a full JSON theme object and click **Apply JSON**
5. Export your creation with the **Export JSON** button

## Project Structure

```
arch/
├── main.js                 # Electron main process (spawns backend)
├── electron/
│   └── preload.js          # Context bridge (select-project IPC)
├── electron-builder.yml    # Packaging configuration
├── build/
│   ├── logo.svg            # App logo (purple diamond layers)
│   └── icon.icns           # macOS dock icon
├── frontend/
│   ├── src/
│   │   ├── App.tsx         # Root layout with themed logo
│   │   ├── main.tsx        # React entry
│   │   ├── index.css       # Theme CSS variables
│   │   ├── stores/
│   │   │   └── appStore.ts # Zustand global state (themes, extensions, agents)
│   │   ├── types/
│   │   │   └── index.ts    # Shared TypeScript types
│   │   ├── components/
│   │   │   ├── center/
│   │   │   │   └── CenterPanel.tsx  # Dynamic tab router
│   │   │   ├── left/
│   │   │   │   └── LeftPanel.tsx
│   │   │   └── right/
│   │   │       ├── RightPanel.tsx
│   │   │       └── ChatPanel.tsx
│   │   ├── features/
│   │   │   ├── HomeScreen.tsx       # Project dashboard
│   │   │   ├── SwarmPanel.tsx       # Multi-model orchestration
│   │   │   ├── ArchitectureViz.tsx  # 2D dependency graph
│   │   │   ├── ExtensionStore.tsx   # Marketplace
│   │   │   ├── SettingsPanel.tsx    # Theme editor + custom presets
│   │   │   ├── GitHubViewer.tsx     # Repo browser
│   │   │   ├── CodebaseSearch.tsx
│   │   │   ├── ModelComparison.tsx
│   │   │   ├── TestingDashboard.tsx
│   │   │   └── SkillsPanel.tsx
│   │   └── services/
│   │       ├── api.ts      # REST API client
│   │       └── ws.ts       # WebSocket client
│   └── vite.config.ts      # Vite build config
├── server/
│   ├── src/
│   │   ├── server.ts       # Express entry
│   │   ├── routes.ts       # REST API routes (incl. /api/swarm, /api/project-stats)
│   │   ├── providers.ts    # LLM provider integrations
│   │   ├── db.ts           # SQLite schema + queries
│   │   ├── ws.ts           # WebSocket server
│   │   ├── features.ts     # Feature seeding
│   │   ├── fs-utils.ts     # File tree scanner + project stats
│   │   └── types.ts        # Backend types
│   ├── dist/               # Compiled JavaScript
│   ├── public/             # Frontend production build
│   └── package.json
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
npx electron .     # from project root
```

### Build for Production

```bash
npm run build      # builds frontend + compiles server TypeScript
```

### Package as .app

```bash
npx electron-builder --mac --arm64
# Then copy node_modules manually:
cp -R server/node_modules release/mac-arm64/Arch.app/Contents/Resources/server/
codesign --force --deep --sign - release/mac-arm64/Arch.app
cp -R release/mac-arm64/Arch.app /Applications/
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
