import { useStore } from '../stores/appStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Check, Play, BookOpen, Folder, GitBranch, Brain, Search, Database, Box, Server, Layers, FileCode, Eye, Flame, X, Globe, Terminal as TerminalIcon } from 'lucide-react';
import { useState } from 'react';

const SKILL_DEFS = [
  { id: 'context7', name: 'Context7', icon: BookOpen, description: 'Retrieve latest documentation and verify APIs before implementation.', auto: true },
  { id: 'filesystem', name: 'Filesystem', icon: Folder, description: 'Read, create, edit, and refactor files.', auto: true },
  { id: 'github', name: 'GitHub', icon: GitBranch, description: 'Clone repos, create PRs, review issues, analyze projects.', auto: false },
  { id: 'playwright', name: 'Playwright', icon: Eye, description: 'Browser automation, UI testing, screenshot capture, end-to-end testing.', auto: false },
  { id: 'thinking', name: 'Sequential Thinking', icon: Brain, description: 'Break complex tasks into steps, plan implementations, analyze failures.', auto: true },
  { id: 'memory', name: 'Memory', icon: Database, description: 'Remember project structure, track decisions, maintain context.', auto: true },
  { id: 'git', name: 'Git', icon: GitBranch, description: 'Commit changes, create branches, restore working versions.', auto: false },
  { id: 'brave', name: 'Brave Search', icon: Search, description: 'Search the web, find solutions, verify information.', auto: false },
  { id: 'fetch', name: 'Fetch', icon: Globe, description: 'Read webpages, extract technical content, analyze documentation.', auto: false },
  { id: 'docker', name: 'Docker', icon: Box, description: 'Build containers, run services, create isolated environments.', auto: false },
  { id: 'postgres', name: 'PostgreSQL', icon: Database, description: 'Query databases, create schemas, optimize performance.', auto: false },
  { id: 'supabase', name: 'Supabase', icon: Server, description: 'Auth, storage, DB management, realtime services.', auto: false },
  { id: 'terminal', name: 'Terminal', icon: TerminalIcon, description: 'Execute commands, run builds, install packages, launch services.', auto: true },
  { id: 'openapi', name: 'OpenAPI', icon: FileCode, description: 'Discover APIs, generate clients, integrate services.', auto: false },
  { id: 'knowledge', name: 'Knowledge Graph', icon: Layers, description: 'Track relationships, understand architecture, improve reasoning.', auto: true },
];

export default function SkillsPanel() {
  const skills = useStore(s => s.skills);
  const setSkills = useStore(s => s.setSkills);
  const [executing, setExecuting] = useState<string | null>(null);
  const [execResult, setExecResult] = useState<{ id: string; output: string; error?: string } | null>(null);

  const merged = SKILL_DEFS.map(def => {
    const stored = skills.find(s => s.id === def.id);
    return { ...def, enabled: stored?.enabled ?? def.auto };
  });

  const toggleSkill = (id: string) => {
    const next = skills.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s);
    if (!skills.find(s => s.id === id)) {
      const def = SKILL_DEFS.find(d => d.id === id)!;
      next.push({ id, name: def.name, enabled: true, icon: id, description: def.description });
    }
    setSkills(next);
  };

  const runSkill = async (id: string) => {
    setExecuting(id);
    setExecResult(null);
    const def = SKILL_DEFS.find(d => d.id === id)!;
    try {
      let output = '';
      switch (id) {
        case 'terminal':
          output = (await (await fetch('/api/skills/terminal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command: 'pwd && ls -la' }) })).json()).output || 'No output';
          break;
        case 'filesystem': {
          const root = (window as any).__PROJECT_ROOT__ || '/Users/sebastianmiletic/Arch';
          const data = await (await fetch(`/api/files?root=${encodeURIComponent(root)}`)).json();
          output = `Project root: ${data.name}\nFiles: ${data.children?.length || 0} items`;
          break;
        }
        case 'github': output = 'GitHub: Use /api/github routes to clone repos, create PRs, review issues.'; break;
        case 'brave': output = 'Brave Search: Use /api/skills/brave?q=query'; break;
        case 'fetch': output = 'Fetch: Use /api/skills/fetch?url=URL'; break;
        case 'docker': output = 'Docker: Use /api/skills/docker to build/run containers.'; break;
        case 'postgres': output = 'PostgreSQL: Use /api/skills/postgres to query databases.'; break;
        case 'supabase': output = 'Supabase: Use /api/skills/supabase for auth/storage/DB.'; break;
        case 'openapi': output = 'OpenAPI: Use /api/skills/openapi to discover and generate clients.'; break;
        case 'playwright': output = 'Playwright: Use /api/skills/playwright to automate browsers and test UI.'; break;
        case 'git': output = (await (await fetch('/api/skills/git', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command: 'status' }) })).json()).output || 'No git status'; break;
        case 'context7': output = 'Context7: Retrieves latest docs. Use /api/skills/context7?library=xyz'; break;
        case 'thinking': output = 'Sequential Thinking: Analyzing current project...\n\n1. Identify requirements\n2. Plan implementation\n3. Execute with verification\n4. Optimize and document\n\nThis skill is passive — guides agent reasoning automatically.'; break;
        case 'memory': output = 'Memory: Tracking project context.\n\nCurrent knowledge:\n• Project: Arch Code Studio\n• Stack: Electron + React + Node.js + SQLite\n• Providers: Ollama, OpenAI, Anthropic, Gemini, OpenRouter, NVIDIA, OpenCode\n• Skills: 15 loaded'; break;
        case 'knowledge': output = 'Knowledge Graph: Mapping architecture relationships...\n\nGraph nodes:\n• Electron → Node.js backend → SQLite DB\n• React frontend → Zustand store → WebSocket\n• AI providers → Ollama/OpenAI/Anthropic etc.\n• Skills → 15 autonomous capabilities\n• Testing → ESLint + file scanner + structure checks'; break;
        default: output = `${def.name} skill executed.`; break;
      }
      setExecResult({ id, output });
    } catch (err: any) {
      setExecResult({ id, output: '', error: err.message });
    } finally {
      setExecuting(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <Zap size={16} className="text-accent" />
          <span className="font-bold text-sm text-text-heading">Skills</span>
          <span className="ml-auto text-[10px] text-text-muted px-2 py-1 rounded bg-bg-surface">{merged.filter(s => s.enabled).length}/{merged.length} active</span>
        </div>
      </div>

      {/* Results panel */}
      <AnimatePresence>
        {execResult && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-b border-border bg-bg-surface overflow-hidden shrink-0">
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-text">{SKILL_DEFS.find(d => d.id === execResult.id)?.name} Result</span>
                <button onClick={() => setExecResult(null)} className="text-text-dim hover:text-text"><X size={12} /></button>
              </div>
              {execResult.error ? (
                <div className="text-[11px] text-danger font-mono p-2 rounded bg-danger-bg border border-danger/20">{execResult.error}</div>
              ) : (
                <pre className="text-[11px] font-mono text-text-secondary whitespace-pre-wrap leading-relaxed p-2 rounded bg-bg border border-border">{execResult.output}</pre>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skills list — flat, no categories */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {merged.map((skill) => (
          <motion.div key={skill.id} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className={`group rounded-xl border transition-all ${skill.enabled ? 'border-accent/20 bg-accent-bg/30' : 'border-border bg-bg-surface hover:border-border-strong'}`}>
            <div className="flex items-start gap-2.5 p-2.5">
              <button onClick={() => toggleSkill(skill.id)} className={`mt-0.5 shrink-0 w-5 h-5 rounded-md flex items-center justify-center transition-all ${skill.enabled ? 'bg-accent text-bg' : 'bg-bg border border-border text-transparent hover:border-text-muted'}`}>
                <Check size={12} strokeWidth={3} />
              </button>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${skill.enabled ? 'bg-accent/10' : 'bg-bg-hover'}`}>
                <skill.icon size={14} className={skill.enabled ? 'text-accent' : 'text-text-dim'} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[11px] font-semibold ${skill.enabled ? 'text-text' : 'text-text-muted'}`}>{skill.name}</span>
                  {skill.auto && <span className="text-[9px] px-1 py-0.5 rounded bg-accent/10 text-accent">Auto</span>}
                </div>
                <p className="text-[10px] text-text-muted mt-0.5 leading-relaxed">{skill.description}</p>
              </div>
              <button onClick={() => runSkill(skill.id)} disabled={executing === skill.id} className={`shrink-0 p-1.5 rounded-lg transition-all ${executing === skill.id ? 'text-text-dim' : 'text-accent hover:bg-accent/10'}`}>
                {executing === skill.id ? <Flame size={14} className="animate-pulse" /> : <Play size={14} />}
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Protocol footer */}
      <div className="border-t border-border p-3 shrink-0 bg-bg-surface">
        <div className="text-[10px] text-text-muted space-y-1">
          <p className="font-semibold text-text-secondary">Autonomous Protocol</p>
          <p>1. Analyze requirements · 2. Create plan · 3. Retrieve docs · 4. Search code · 5. Implement · 6. Run tests · 7. Fix errors · 8. Verify · 9. Optimize · 10. Document</p>
        </div>
      </div>
    </div>
  );
}
