import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../stores/appStore';
import { chatApi, providersApi } from '../../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Bot, User, Zap, AlertCircle, Sparkles,
  Plug, Trash2, Save, X, Check, KeyRound, Server,
  Cpu, MessageSquare, Command, HelpCircle,
  ChevronDown, Plus, ChevronLeft, Minimize, Briefcase,
  Bug, BookOpen, Search, FileImage, Terminal, Globe,
  Flame, Hexagon, LayoutGrid
} from 'lucide-react';

/* ─── helpers ─── */
function loadNamedProviders(): NamedProvider[] {
  try { return JSON.parse(localStorage.getItem('arch_named_providers') || '[]'); }
  catch { return []; }
}
function saveNamedProviders(list: NamedProvider[]) {
  localStorage.setItem('arch_named_providers', JSON.stringify(list));
}

/* ─── provider data ─── */
const PROVIDER_META: Record<string, { icon: any; color: string; bg: string; desc: string }> = {
  openai:     { icon: Sparkles,  color: '#10a37f', bg: 'rgba(16,163,127,0.08)',  desc: 'GPT-5, GPT-5-mini, GPT-OSS' },
  anthropic:  { icon: Flame,     color: '#d97757', bg: 'rgba(217,119,87,0.08)',  desc: 'Claude Opus 5, Sonnet 5, Haiku 5' },
  gemini:     { icon: Hexagon,   color: '#4285f4', bg: 'rgba(66,133,244,0.08)',  desc: 'Google Gemini 3.5 Pro, Flash, Live' },
  xai:        { icon: Zap,       color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   desc: 'Grok 4, Grok 4 Fast' },
  nvidia:     { icon: Cpu,       color: '#76b900', bg: 'rgba(118,185,0,0.08)',   desc: 'NVIDIA NIM, Llama Nemotron' },
  ollama:     { icon: Server,    color: '#fff',    bg: 'rgba(255,255,255,0.06)', desc: 'Ollama local + cloud models' },
  openrouter: { icon: Globe,     color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)',  desc: 'Unified gateway to all providers' },
};

const PROVIDER_TYPES = [
  { id: 'openai',     name: 'OpenAI',     desc: 'GPT-5, GPT-5-mini, GPT-OSS',       color: '#10a37f', defaultUrl: 'https://api.openai.com/v1',            models: ['gpt-5','gpt-5-mini','gpt-5-nano','gpt-oss-120b','gpt-oss-20b'] },
  { id: 'anthropic',  name: 'Anthropic',  desc: 'Claude Opus 5, Sonnet 5, Haiku 5', color: '#d97757', defaultUrl: 'https://api.anthropic.com',            models: ['claude-opus-5','claude-sonnet-5','claude-haiku-5'] },
  { id: 'gemini',     name: 'Gemini',     desc: 'Google Gemini API',                color: '#4285f4', defaultUrl: 'https://generativelanguage.googleapis.com', models: ['gemini-3.5-pro','gemini-3.5-flash','gemini-3.1-flash','gemini-2.5-pro','gemini-2.5-flash','gemini-live'] },
  { id: 'xai',        name: 'xAI',        desc: 'Grok 4 via xAI',                   color: '#ef4444', defaultUrl: 'https://api.x.ai/v1',                  models: ['grok-4','grok-4-fast'] },
  { id: 'nvidia',     name: 'NVIDIA NIM', desc: 'NIM model endpoints',              color: '#76b900', defaultUrl: 'https://integrate.api.nvidia.com/v1',    models: ['nvidia/llama-nemotron-ultra','nvidia/llama-nemotron-super','meta/llama-4-maverick','meta/llama-4-scout','deepseek-ai/deepseek-r1','deepseek-ai/deepseek-v3'] },
  { id: 'ollama',     name: 'Ollama',     desc: 'Ollama local + cloud',             color: '#ffffff', defaultUrl: 'http://127.0.0.1:11434/v1',              models: ['gpt-oss:20b-cloud','gpt-oss:120b-cloud','gemma4:31b-cloud','deepseek-v3.1:671b-cloud','deepseek-v4-flash:cloud','kimi-k2.6:cloud','minimax-m2:cloud','nemotron-3-nano:30b','qwen3-coder:480b','qwen3-vl:235b'] },
  { id: 'openrouter', name: 'OpenRouter', desc: 'Unified API gateway',              color: '#8b5cf6', defaultUrl: 'https://openrouter.ai/api/v1',           models: ['openai/gpt-5','anthropic/claude-opus-5','google/gemini-3.5-pro','xai/grok-4'] },
];

/* ─── slash commands (Claude CLI inspired) ─── */
interface SlashCmd {
  name: string;
  desc: string;
  icon: any;
  action: string;
}
const SLASH_COMMANDS: SlashCmd[] = [
  { name: 'clear',   desc: 'Clear this conversation',                          icon: Trash2,      action: 'clear' },
  { name: 'compact', desc: 'Summarize and shorten the conversation',             icon: Minimize,    action: 'compact' },
  { name: 'connect', desc: 'Add or switch to a different provider',              icon: Plug,        action: 'connect' },
  { name: 'cost',    desc: 'Show estimated cost for this conversation',         icon: Briefcase,   action: 'cost' },
  { name: 'debug',   desc: 'Show recent thinking / reasoning chain',            icon: Bug,         action: 'debug' },
  { name: 'doc',     desc: 'Load docs for a library (e.g. /doc react-router)', icon: BookOpen,    action: 'doc' },
  { name: 'help',    desc: 'Show all available commands',                      icon: HelpCircle,  action: 'help' },
  { name: 'image',   desc: 'Attach an image to your next message',              icon: FileImage,   action: 'image' },
  { name: 'ls',      desc: 'List files in the current project directory',      icon: Terminal,    action: 'ls' },
  { name: 'model',   desc: 'Switch the AI model for this chat',                icon: Cpu,         action: 'models' },
  { name: 'models',  desc: 'Show all models for the active provider',           icon: LayoutGrid,  action: 'models' },
  { name: 'search',  desc: 'Search the web (e.g. /search latest React hooks)', icon: Search,      action: 'search' },
  { name: 'web',     desc: 'Fetch a URL and include it as context',              icon: Globe,       action: 'web' },
];

/* ─── types ─── */
interface ChatMessage {
  id: string; role: 'system' | 'user' | 'assistant' | 'error';
  content: string; timestamp: string; provider?: string;
}
interface NamedProvider {
  id: string; name: string; configId: string;
  apiKey?: string; baseUrl?: string; defaultModel?: string;
  enabled: boolean;
}

export default function ChatPanel() {
  const version       = useStore(s => s.version as unknown as number);
  const setVersion    = useStore(s => s.setVersion);
  const projectRoot   = useStore(s => s.projectRoot);
  const setProviders  = useStore(s => s.setProviders);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<any>(null);

  const [namedProviders, setNamedProviders] = useState<NamedProvider[]>(loadNamedProviders);
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectStep, setConnectStep] = useState<0 | 1>(0);
  const [newConfig, setNewConfig] = useState({ configId: 'openai', name: '', apiKey: '', baseUrl: '', defaultModel: '', saveKey: true });
  const [modelsOpen, setModelsOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [slashOpen, setSlashOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPollCount = useRef(0);
  const [selectedSlash, setSelectedSlash] = useState(0);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);
  useEffect(() => {
    fetch('/api/sessions').then(r => r.json()).then(s => { setSessions(s); if (s[0]) setActiveSession(s[0]); });
    providersApi.list().then(setProviders);
  }, []);

  const activeNamed = namedProviders.find(p => p.enabled);

  const addMsg = (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    setMessages(prev => [...prev, { ...msg, id: Date.now().toString() + Math.random().toString(36).slice(2), timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
  };

  /* ─── slash handling ─── */
  const runSlash = (cmd: SlashCmd, rest = '') => {
    setInput(''); setSlashOpen(false); setSelectedSlash(0);
    if (cmd.action === 'clear') { setMessages([]); addMsg({ role: 'system', content: 'Chat history cleared.' }); }
    if (cmd.action === 'connect') { setConnectOpen(true); setConnectStep(0); }
    if (cmd.action === 'models') { setModelsOpen(true); }
    if (cmd.action === 'help')  { addMsg({ role: 'system', content: `**Available commands**\n\n${SLASH_COMMANDS.map(c => `**/${c.name}** — ${c.desc}`).join('\n')}` }); }
    if (cmd.action === 'compact'){ addMsg({ role: 'system', content: '*Compact mode: conversation summarized.*' }); }
    if (cmd.action === 'cost')  { addMsg({ role: 'system', content: '*Cost tracking not yet implemented.*' }); }
    if (cmd.action === 'debug') { addMsg({ role: 'system', content: '*Debug mode: last reasoning chain shown in console.*' }); }
    if (cmd.action === 'ls')    { addMsg({ role: 'system', content: `Project root: \`${projectRoot || '../'}\`\nUse the left Files panel to browse.` }); }
    if (cmd.action === 'doc')   { addMsg({ role: 'system', content: rest ? `Fetching docs for **${rest}**…` : 'Usage: **/doc** <library>' }); }
    if (cmd.action === 'web')   { addMsg({ role: 'system', content: rest ? `Fetching **${rest}**…` : 'Usage: **/web** <url>' }); }
    if (cmd.action === 'search'){ addMsg({ role: 'system', content: rest ? `Searching web for **${rest}**…` : 'Usage: **/search** <query>' }); }
    if (cmd.action === 'image') { addMsg({ role: 'system', content: 'Image upload coming soon. Drop a file onto the chat.' }); }
    inputRef.current?.focus();
  };

  const slashQuery = input.startsWith('/') ? input.slice(1).trim().split(' ')[0] : '';
  const slashMatches = slashQuery ? SLASH_COMMANDS.filter(c => c.name.startsWith(slashQuery)) : SLASH_COMMANDS;

  /* ─── input events ─── */
  const onInputChange = (val: string) => {
    setInput(val);
    if (val.startsWith('/')) {
      setSlashOpen(true);
      setSelectedSlash(0);
    } else {
      setSlashOpen(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (slashOpen && slashMatches.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedSlash(p => (p + 1) % slashMatches.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedSlash(p => (p - 1 + slashMatches.length) % slashMatches.length); return; }
      if (e.key === 'Enter') { e.preventDefault(); runSlash(slashMatches[selectedSlash]); return; }
      if (e.key === 'Escape') { setSlashOpen(false); setSelectedSlash(0); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      if (slashOpen) { e.preventDefault(); runSlash(slashMatches[selectedSlash]); return; }
      e.preventDefault(); handleSend();
    }
    if (e.key === 'Escape') {
      setSlashOpen(false); setConnectOpen(false); setModelsOpen(false); setSessionOpen(false);
    }
  };

  /* ─── send ─── */
  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();

    if (text.startsWith('/')) {
      const cmdName = text.slice(1).split(' ')[0];
      const cmd = SLASH_COMMANDS.find(c => c.name === cmdName);
      const rest = text.slice(1 + cmdName.length).trim();
      if (cmd) { runSlash(cmd, rest); setInput(''); return; }
    }

    setInput('');
    addMsg({ role: 'user', content: text });
    if (!activeNamed) { addMsg({ role: 'system', content: 'No provider active. Type **/connect** to set up your API key.' }); return; }

    setSending(true); lastPollCount.current = 0;
    if (pollRef.current) clearInterval(pollRef.current);

    try {
      const providerId = activeNamed.configId;
      const sessionRes = await fetch('/api/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: text.slice(0, 30), providerId, model: activeNamed?.defaultModel || 'default' }) });
      const session = await sessionRes.json();
      setActiveSession(session); setSessions(prev => [session, ...prev]);

      const poll = async () => {
        try {
          const msgs = await (await fetch(`/api/sessions/${session.id}/messages`)).json();
          if (msgs.length > lastPollCount.current) {
            lastPollCount.current = msgs.length;
            const last = msgs[msgs.length - 1];
            if (last.role === 'assistant') {
              setMessages(prev => prev.some(m => m.id === last.id) ? prev : [...prev, { role: 'assistant', content: last.content, provider: last.provider || providerId, id: last.id, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
              setVersion(version + 0.01);
            }
          }
        } catch {}
      };

      await chatApi.send({ sessionId: session.id, content: text, providerId, projectRoot });
      pollRef.current = setInterval(poll, 1500);
      setTimeout(() => { if (pollRef.current) clearInterval(pollRef.current); setSending(false); }, 30000);
    } catch (err: any) {
      addMsg({ role: 'error', content: `Chat error: ${err.message}` });
      setSending(false);
    }
  };

  /* ─── provider management ─── */
  const enableNamed = async (np: NamedProvider) => {
    const updated = namedProviders.map(p => ({ ...p, enabled: p.id === np.id }));
    setNamedProviders(updated); saveNamedProviders(updated);
    const pt = PROVIDER_TYPES.find(t => t.id === np.configId);
    await providersApi.update(np.configId, { enabled: true, apiKey: np.apiKey, baseUrl: np.baseUrl || pt?.defaultUrl, defaultModel: np.defaultModel || pt?.models[0] });
    addMsg({ role: 'system', content: `Connected to **${np.name}** (${pt?.name}).` });
    setConnectOpen(false);
  };
  const deleteNamed = (id: string) => { const next = namedProviders.filter(p => p.id !== id); setNamedProviders(next); saveNamedProviders(next); };
  const saveNew = () => {
    if (!newConfig.name.trim() || !newConfig.apiKey.trim()) return;
    const t = PROVIDER_TYPES.find(x => x.id === newConfig.configId);
    const np: NamedProvider = { id: `named-${Date.now()}`, name: newConfig.name, configId: newConfig.configId,
      apiKey: newConfig.saveKey ? newConfig.apiKey : undefined, baseUrl: t?.defaultUrl,
      defaultModel: newConfig.defaultModel || t?.models[0], enabled: true,
    };
    const next = namedProviders.filter(p => p.id !== np.id).map(p => ({ ...p, enabled: false }));
    next.push(np); setNamedProviders(next); saveNamedProviders(next); enableNamed(np);
    setNewConfig({ configId: 'openai', name: '', apiKey: '', baseUrl: '', defaultModel: '', saveKey: true });
    setConnectStep(0);
  };
  const setModel = (model: string) => {
    if (!activeNamed) return;
    const updated = namedProviders.map(p => p.id === activeNamed.id ? { ...p, defaultModel: model } : p);
    setNamedProviders(updated); saveNamedProviders(updated);
    addMsg({ role: 'system', content: `Model switched to **${model}**.` });
    setModelsOpen(false);
  };

  /* ─── render ─── */
  return (
    <div className="flex flex-col h-full bg-bg text-text relative">

      {/* ══ CONNECT POPUP ══ */}
      <AnimatePresence>{connectOpen && (
        <motion.div key="connect" initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }}
          className="absolute inset-x-3 top-3 bottom-28 z-50 rounded-2xl bg-bg-surface/95 backdrop-blur-md border border-border shadow-2xl overflow-hidden flex flex-col"
          transition={{ duration: 0.12 }}>
          <header className="shrink-0 flex items-center gap-2 px-3 py-2.5 border-b border-border bg-bg-panel/50">
            <div className="w-6 h-6 rounded-md bg-accent-bg flex items-center justify-center"><Plug size={12} className="text-accent" /></div>
            <span className="text-[11px] font-bold">{connectStep === 0 ? 'Add Provider' : 'Enter API Key'}</span>
            <button onClick={() => { setConnectOpen(false); setConnectStep(0); }} className="ml-auto p-1 text-text-dim hover:text-text rounded"><X size={11} /></button>
          </header>

          {connectStep === 0 && (
            <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
              {PROVIDER_TYPES.map(t => {
                const m = PROVIDER_META[t.id];
                const I = m?.icon || Server;
                return (
                  <button key={t.id} onClick={() => { setNewConfig(c => ({ ...c, configId: t.id, baseUrl: t.defaultUrl, defaultModel: '' })); setConnectStep(1); }}
                    className="w-full flex items-center gap-2.5 p-2.5 rounded-xl border border-border bg-bg-panel hover:border-accent/30 hover:bg-bg-hover transition-all text-left">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: m?.bg }}><I size={15} style={{ color: m?.color }} /></div>
                    <div><p className="text-[11px] font-semibold">{t.name}</p><p className="text-[9px] text-text-dim">{m?.desc}</p></div>
                  </button>
                );
              })}
              {namedProviders.length > 0 && (
                <div className="mt-3 pt-2 border-t border-border space-y-1">
                  <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider px-1 mb-1">Saved</p>
                  {namedProviders.map(np => {
                    const m = PROVIDER_META[np.configId]; const I = m?.icon || Server;
                    return (
                      <div key={np.id} className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${np.enabled ? 'border-accent/25 bg-accent-bg/15' : 'border-border bg-bg-panel'}`}>
                        <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: m?.bg }}><I size={12} style={{ color: m?.color }} /></div>
                        <p className="text-[10px] font-semibold flex-1 truncate">{np.name}</p>
                        <button onClick={() => enableNamed(np)} className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${np.enabled ? 'bg-accent text-bg' : 'bg-bg-hover text-text-secondary'}`}>{np.enabled ? 'Active' : 'Use'}</button>
                        <button onClick={() => deleteNamed(np.id)} className="p-1 text-text-dim hover:text-danger"><Trash2 size={10} /></button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {connectStep === 1 && (
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
              {(() => {
                const t = PROVIDER_TYPES.find(x => x.id === newConfig.configId);
                const m = PROVIDER_META[newConfig.configId];
                const I = m?.icon || Server;
                return (
                  <div className="space-y-3">
                    <button onClick={() => setConnectStep(0)} className="flex items-center text-[10px] text-text-dim hover:text-text"><ChevronLeft size={10} /> Back</button>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: m?.bg }} ><I size={15} style={{ color: m?.color }} /></div>
                      <div><p className="text-[12px] font-bold">{t?.name}</p><p className="text-[10px] text-text-dim">{m?.desc}</p></div>
                    </div>

                    <div className="space-y-2.5">
                      <div><label className="text-[9px] font-bold text-text-muted mb-1 block">Name</label>
                        <input value={newConfig.name} onChange={e => setNewConfig(c => ({ ...c, name: e.target.value }))} placeholder="e.g. My OpenAI Key" className="w-full bg-bg-panel border border-border rounded-xl px-3 py-1.5 text-[11px] text-text focus:outline-none focus:border-accent/50 transition-colors" />
                      </div>
                      <div><label className="text-[9px] font-bold text-text-muted mb-1 block">API Key</label>
                        <div className="relative"><KeyRound size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim/40" />
                          <input value={newConfig.apiKey} onChange={e => setNewConfig(c => ({ ...c, apiKey: e.target.value }))} type="password" placeholder="Paste API key" className="w-full bg-bg-panel border border-border rounded-xl pl-8 pr-3 py-1.5 text-[11px] text-text focus:outline-none focus:border-accent/50 transition-colors font-mono" />
                        </div>
                        <label className="flex items-center gap-2 mt-1.5 text-[9px] text-text-secondary cursor-pointer">
                          <div className={`w-3 h-3 rounded border flex items-center justify-center transition-colors ${newConfig.saveKey ? 'bg-accent border-accent' : 'border-text-dim/30'}`}>{newConfig.saveKey && <Check size={8} className="text-bg" />}</div>
                          <input type="checkbox" checked={newConfig.saveKey} onChange={e => setNewConfig(c => ({ ...c, saveKey: e.target.checked }))} className="hidden" /> Save for next time
                        </label>
                      </div>
                      <div><label className="text-[9px] font-bold text-text-muted mb-1 block">Model</label>
                        <select value={newConfig.defaultModel} onChange={e => setNewConfig(c => ({ ...c, defaultModel: e.target.value }))} className="w-full bg-bg-panel border border-border rounded-xl px-3 py-1.5 text-[11px] text-text focus:outline-none focus:border-accent/50 transition-colors appearance-none">
                          <option value="">Choose a model…</option>
                          {(t?.models || []).map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                    </div>

                    <button onClick={saveNew} disabled={!newConfig.name.trim() || !newConfig.apiKey.trim()} className="w-full py-2 bg-accent text-bg text-[11px] font-bold rounded-xl hover:opacity-90 disabled:opacity-20 transition-all flex items-center justify-center gap-1.5">
                      <Save size={11} /> Connect
                    </button>
                  </div>
                );
              })()}
            </div>
          )}
        </motion.div>
      )}</AnimatePresence>

      {/* ══ MODELS POPUP ══ */}
      <AnimatePresence>{modelsOpen && (
        <motion.div key="models" initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }}
          className="absolute inset-x-3 top-3 bottom-28 z-50 rounded-2xl bg-bg-surface/95 backdrop-blur-md border border-border shadow-2xl overflow-hidden flex flex-col"
          transition={{ duration: 0.12 }}>
          <header className="shrink-0 flex items-center gap-2 px-3 py-2.5 border-b border-border bg-bg-panel/50">
            <div className="w-6 h-6 rounded-md bg-accent-bg flex items-center justify-center"><Cpu size={12} className="text-accent" /></div>
            <span className="text-[11px] font-bold">Models</span>
            <button onClick={() => setModelsOpen(false)} className="ml-auto p-1 text-text-dim hover:text-text rounded"><X size={11} /></button>
          </header>
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {namedProviders.filter(p => p.enabled).map(np => {
              const pt = PROVIDER_TYPES.find(t => t.id === np.configId);
              const m = PROVIDER_META[np.configId];
              const I = m?.icon || Server;
              return (
                <div key={np.id} className="border border-border rounded-xl p-2.5 bg-bg-panel">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: m?.bg }} ><I size={11} style={{ color: m?.color }} /></div>
                    <p className="text-[11px] font-bold">{np.name} <span className="text-text-dim font-normal">· {pt?.name}</span></p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(pt?.models || []).map(md => (
                      <button key={md} onClick={() => setModel(md)} className={`px-2 py-0.5 text-[9px] rounded-md border transition-all ${np.defaultModel === md ? 'bg-accent text-bg border-accent' : 'text-text-secondary hover:bg-bg-hover border-border'}`}>{md}</button>
                    ))}
                  </div>
                </div>
              );
            })}
            {namedProviders.filter(p => p.enabled).length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-text-dim">
                <Cpu size={20} className="opacity-30" />
                <p className="text-[11px]">Connect a provider first</p>
                <button onClick={() => { setModelsOpen(false); setConnectOpen(true); }} className="text-[11px] text-accent">Open /connect</button>
              </div>
            )}
          </div>
        </motion.div>
      )}</AnimatePresence>

      {/* ══ TOOLBAR ══ */}
      <div className="shrink-0 flex items-center gap-0.5 px-2.5 py-1.5 border-b border-border bg-bg-panel">

        {/* session dropdown */}
        <div className="relative">
          <button onClick={() => setSessionOpen(o => !o)} className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-text-secondary hover:text-text rounded-lg hover:bg-bg-hover transition-all">
            <MessageSquare size={12} />
            <span className="max-w-[50px] truncate">{activeSession?.name || 'Chat'}</span>
            <ChevronDown size={10} className={sessionOpen ? 'rotate-180' : ''} />
          </button>
          {sessionOpen && (
            <div className="absolute top-full left-0 mt-1 w-44 bg-bg-surface border border-border rounded-xl shadow-xl z-40 py-1">
              {sessions.length === 0 && <div className="px-3 py-2 text-[10px] text-text-dim">No sessions yet</div>}
              {sessions.map((s: any) => (
                <button key={s.id} onClick={() => { setActiveSession(s); setSessionOpen(false); fetch(`/api/sessions/${s.id}/messages`).then(r => r.json()).then(msgs => setMessages(msgs.map((m: any) => ({ ...m, timestamp: '' })))); }}
                  className={`w-full text-left px-3 py-1 text-[10px] flex items-center gap-2 hover:bg-bg-hover transition-colors ${activeSession?.id === s.id ? 'text-accent' : 'text-text'}`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${activeSession?.id === s.id ? 'bg-accent' : 'bg-text-dim'}`} />
                  <span className="truncate flex-1">{s.name || 'Untitled'}</span>
                </button>
              ))}
              <div className="border-t border-border mt-1 pt-1 px-1">
                <button onClick={() => { setActiveSession(null); setSessionOpen(false); setMessages([]); }} className="w-full text-left px-3 py-1 text-[10px] text-text-dim hover:text-text hover:bg-bg-hover rounded-lg transition-colors flex items-center gap-1"><Plus size={10} /> New chat</button>
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-4 bg-border mx-1" />

        <button onClick={() => { setConnectOpen(true); setConnectStep(0); }} className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-text-secondary hover:text-text rounded-lg hover:bg-bg-hover transition-all">
          <Plug  size={12} /> Providers
        </button>
        <button onClick={() => setModelsOpen(true)} className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-text-secondary hover:text-text rounded-lg hover:bg-bg-hover transition-all">
          <Cpu   size={12} /> Model
        </button>

        <div className="ml-auto flex items-center gap-1.5">
          {activeNamed ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1.5 text-[9px] px-2 py-0.5 rounded-full bg-accent-bg border border-accent/20 text-accent">
              <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" /> {activeNamed.name}
            </motion.div>
          ) : (
            <span className="text-[9px] text-text-dim/40">No AI</span>
          )}
          <span className="text-[9px] text-text-dim/30 font-mono">v{version.toFixed(2)}</span>
        </div>
      </div>

      {/* ══ MESSAGES ══ */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-text-muted">
              <div className="w-14 h-14 rounded-2xl bg-accent-bg flex items-center justify-center"><Bot size={28} className="text-accent/40" /></div>
              <div className="text-center space-y-1">
                <p className="text-text-secondary font-semibold text-[13px]">Start a conversation</p>
                <p className="text-[11px] opacity-60">Type <code className="text-accent bg-accent-bg px-1 py-0.5 rounded text-[10px] font-mono">/ </code> for commands</p>
              </div>
            </div>
          ) : (
            <div className="p-3 space-y-4">
              {messages.map(msg => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${msg.role === 'user' ? 'bg-accent text-bg' : msg.role === 'assistant' ? 'bg-bg-surface border border-border' : msg.role === 'error' ? 'bg-danger-bg border border-danger/30' : 'bg-bg-surface border border-border'}`}>
                    {msg.role === 'user' ? <User size={13} /> : msg.role === 'assistant' ? <Bot size={13} className="text-accent" /> : msg.role === 'error' ? <AlertCircle size={13} className="text-danger" /> : <Sparkles size={13} className="text-warning" />}
                  </div>
                  <div className="flex flex-col gap-0.5 max-w-[82%]">
                    <div className={`rounded-2xl px-3.5 py-2.5 text-[12px] leading-relaxed ${msg.role === 'user' ? 'bg-accent text-bg rounded-tr-sm' : msg.role === 'assistant' ? 'bg-bg-surface border border-border text-text rounded-tl-sm' : 'bg-bg-surface/50 border border-border/50 text-text-secondary rounded-tl-sm'}`}>
                      <MessageContent content={msg.content} />
                    </div>
                    {msg.provider && <div className="flex items-center gap-1 px-1"><Zap size={8} className="text-accent/60" /><span className="text-[9px] text-text-dim">{msg.provider} · {msg.timestamp}</span></div>}
                  </div>
                </motion.div>
              ))}
              {sending && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 pl-9">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-surface border border-border rounded-full">
                    {Array(3).fill(0).map((_, i) => <div key={i} className="w-1 h-1 rounded-full bg-accent animate-bounce" style={{ animationDelay: `${120 * i}ms` }} />)}
                  </div>
                </motion.div>
              )}
              <div ref={scrollRef} />
            </div>
          )}
        </div>

        {/* ══ INPUT ══ */}
        <div className="shrink-0 border-t border-border bg-bg-panel/80 backdrop-blur-sm p-2.5 relative z-20">
          <div className="relative">
            {
              /* slash autocomplete */
            }
            {slashOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 max-h-56 overflow-y-auto bg-bg-surface border border-border rounded-xl shadow-2xl overflow-hidden z-30">
                {slashMatches.length === 0 ? (
                  <div className="px-3 py-2 text-[11px] text-text-dim">No commands match `/`{slashQuery}</div>
                ) : (
                  slashMatches.map((cmd, idx) => {
                    const Icon = cmd.icon;
                    return (
                      <button key={cmd.name} onClick={() => runSlash(cmd)}
                        className={`w-full flex items-center gap-3 px-3 py-2 transition-colors text-left ${idx === selectedSlash ? 'bg-bg-hover' : 'hover:bg-bg-hover'}`}
                        onMouseDown={e => e.preventDefault()}
                      >
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${idx === selectedSlash ? 'bg-accent-bg' : 'bg-bg-hover'}`}>
                          <Icon size={12} className={idx === selectedSlash ? 'text-accent' : 'text-text-dim'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold">/{cmd.name}</p>
                          <p className="text-[10px] text-text-dim truncate">{cmd.desc}</p>
                        </div>
                        {idx === selectedSlash && <span className="text-[9px] text-accent font-medium shrink-0"><div className="w-1.5 h-1.5 rounded-full bg-accent" /></span>}
                      </button>
                    );
                  })
                )}
              </div>
            )}

            <div className="flex gap-2 items-end bg-bg-surface border border-border/80 rounded-2xl px-3.5 py-2.5 focus-within:border-accent/60 focus-within:shadow-[0_0_0_3px_rgba(168,85,247,0.08)] transition-all">
              <div className="shrink-0 pt-2"><Command size={11} className="text-text-dim/40" /></div>
              <input ref={inputRef} value={input} onChange={e => onInputChange(e.target.value)} onKeyDown={onKeyDown}
                placeholder={activeNamed ? `Ask ${activeNamed.name}…` : "Ask anything or type / for commands…"}
                className="flex-1 bg-transparent text-[12px] text-text placeholder:text-text-dim/70 focus:outline-none leading-relaxed py-0.5"
                spellCheck={false} autoComplete="off"
              />
              <button onClick={handleSend} disabled={sending || !input.trim()} className="p-2 bg-accent text-bg rounded-xl hover:opacity-90 disabled:opacity-15 transition-all shrink-0 shadow-sm shadow-accent/10">
                <Send size={13} />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between mt-1 px-1">
            <span className="text-[9px] text-text-dim/60">{activeNamed ? `${activeNamed.name} · ${activeNamed.defaultModel || ''}` : 'No provider · /connect'}</span>
            <span className="text-[9px] text-text-dim/40">{input.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══ message renderer ══ */
function MessageContent({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => {
        const bolded = line.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>');
        const coded = bolded.replace(/`(.+?)`/g, '<code class="px-1 py-0.5 rounded-md bg-bg-hover text-accent text-[11px] font-mono">$1</code>');
        if (line.trim().startsWith('•') || line.trim().startsWith('-')) return <div key={i} className="pl-2.5 text-[11px] text-text-secondary" dangerouslySetInnerHTML={{ __html: coded }} />;
        return <div key={i} className="text-[12px] leading-relaxed" dangerouslySetInnerHTML={{ __html: coded }} />;
      })}
    </div>
  );
}
