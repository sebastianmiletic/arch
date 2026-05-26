import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../stores/appStore';
import { chatApi, providersApi } from '../../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Bot, User, Zap, AlertCircle, Sparkles, Plug,
  Trash2, Save, X, Check, KeyRound, Server, Cpu,
  MessageSquare, Command, HelpCircle, ChevronDown,
  Plus, ChevronLeft, Minimize, Briefcase, Bug,
  BookOpen, Search, FileImage, Terminal, Globe,
  Flame, Hexagon, LayoutGrid, Diamond,
  ChevronUp, Sliders, Pencil
} from 'lucide-react';

/* ═══════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════ */
function loadNamedProviders(): NamedProvider[] {
  try { return JSON.parse(localStorage.getItem('arch_named_providers') || '[]'); }
  catch { return []; }
}
function saveNamedProviders(list: NamedProvider[]) {
  localStorage.setItem('arch_named_providers', JSON.stringify(list));
}

const CHARS_PER_TOKEN = 4;

function estimateTokens(content: string): number {
  return Math.ceil(content.length / CHARS_PER_TOKEN);
}

function getContextWindow(model: string): number {
  if (model.includes('o1') || model.includes('o3') || model.includes('4o') || model.includes('opus') || model.includes('claude-3-5')) return 128000;
  if (model.includes('deepseek') || model.includes('gemini-2.5')) return 256000;
  if (model.includes('kimi') || model.includes('qwen3')) return 200000;
  if (model.includes('llama') || model.includes('nemotron')) return 128000;
  return 128000;
}

/* ═══════════════════════════════════════════════════
   PROVIDER DATA
   ═══════════════════════════════════════════════════ */
const PROVIDER_META: Record<string, any> = {
  openai:     { icon: Sparkles,  color: '#10a37f', bg: 'rgba(16,163,127,0.08)',  desc: 'GPT-5, GPT-5-mini, GPT-OSS' },
  anthropic:  { icon: Flame,     color: '#d97757', bg: 'rgba(217,119,87,0.08)',  desc: 'Claude Opus 5, Sonnet 5, Haiku 5' },
  gemini:     { icon: Hexagon,   color: '#4285f4', bg: 'rgba(66,133,244,0.08)',  desc: 'Google Gemini 3.5 Pro, Flash, Live' },
  xai:        { icon: Zap,       color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   desc: 'Grok 4, Grok 4 Fast' },
  nvidia:     { icon: Cpu,       color: '#76b900', bg: 'rgba(118,185,0,0.08)',   desc: 'NVIDIA NIM, Llama Nemotron' },
  ollama:     { icon: Server,    color: '#fff',    bg: 'rgba(255,255,255,0.06)', desc: 'Ollama local + cloud models' },
  openrouter: { icon: Globe,     color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)',  desc: 'Unified gateway to all providers' },
  opencode:   { icon: Diamond,   color: '#22d3ee', bg: 'rgba(34,211,238,0.08)', desc: 'OpenCode API/CLI' },
};

const PROVIDER_TYPES = [
  { id: 'openai',     name: 'OpenAI',     desc: 'GPT-5, GPT-5-mini, GPT-OSS',       color: '#10a37f', defaultUrl: 'https://api.openai.com/v1',            models: ['gpt-5','gpt-5-mini','gpt-5-nano','gpt-oss-120b','gpt-oss-20b'] },
  { id: 'anthropic',  name: 'Anthropic',  desc: 'Claude Opus 5, Sonnet 5, Haiku 5', color: '#d97757', defaultUrl: 'https://api.anthropic.com',            models: ['claude-opus-5','claude-sonnet-5','claude-haiku-5'] },
  { id: 'gemini',     name: 'Gemini',     desc: 'Google Gemini API',                color: '#4285f4', defaultUrl: 'https://generativelanguage.googleapis.com', models: ['gemini-3.5-pro','gemini-3.5-flash','gemini-3.1-flash','gemini-2.5-pro','gemini-2.5-flash','gemini-live'] },
  { id: 'xai',        name: 'xAI',        desc: 'Grok 4 via xAI',                   color: '#ef4444', defaultUrl: 'https://api.x.ai/v1',                  models: ['grok-4','grok-4-fast'] },
  { id: 'nvidia',     name: 'NVIDIA NIM', desc: 'NIM model endpoints',              color: '#76b900', defaultUrl: 'https://integrate.api.nvidia.com/v1',    models: ['nvidia/llama-nemotron-ultra','nvidia/llama-nemotron-super','meta/llama-4-maverick','meta/llama-4-scout','deepseek-ai/deepseek-r1','deepseek-ai/deepseek-v3'] },
  { id: 'ollama',     name: 'Ollama',     desc: 'Ollama local + cloud',             color: '#ffffff', defaultUrl: 'http://127.0.0.1:11434/v1',              models: ['gpt-oss:20b-cloud','gpt-oss:120b-cloud','gemma4:31b-cloud','deepseek-v3.1:671b-cloud','deepseek-v4-flash:cloud','kimi-k2.6:cloud','minimax-m2:cloud','nemotron-3-nano:30b','qwen3-coder:480b','qwen3-vl:235b'] },
  { id: 'openrouter', name: 'OpenRouter', desc: 'Unified API gateway',              color: '#8b5cf6', defaultUrl: 'https://openrouter.ai/api/v1',           models: ['openai/gpt-5','anthropic/claude-opus-5','google/gemini-3.5-pro','xai/grok-4'] },
  { id: 'opencode',   name: 'OpenCode',   desc: 'OpenCode API/CLI access',            color: '#22d3ee', defaultUrl: 'http://localhost:8080/v1',               models: ['opencode/gpt-5','opencode/claude-sonnet-4','opencode/glm-5.1','opencode/glm-5','opencode/kimi-k2.6','opencode/deepseek-v4-pro','opencode/deepseek-v4-flash','opencode/minimax-m2.7','opencode/minimax-m2.5','opencode/mimo-v2.5','opencode/mimo-v2.5-pro','opencode/qwen3.6-plus','opencode/qwen3.5-plus'] },
];

/* ═══════════════════════════════════════════════════
   SLASH COMMANDS
   ═══════════════════════════════════════════════════ */
interface SlashCmd { name: string; desc: string; icon: any; action: string; }
const SLASH_COMMANDS: SlashCmd[] = [
  { name: 'clear',   desc: 'Clear this conversation',                          icon: Trash2,     action: 'clear' },
  { name: 'compact', desc: 'Summarize and shorten the conversation',             icon: Minimize,   action: 'compact' },
  { name: 'connect', desc: 'Add or switch to a different provider',              icon: Plug,       action: 'connect' },
  { name: 'cost',    desc: 'Show estimated cost for this conversation',         icon: Briefcase,   action: 'cost' },
  { name: 'debug',   desc: 'Show recent thinking / reasoning chain',            icon: Bug,         action: 'debug' },
  { name: 'doc',     desc: 'Load docs for a library (/doc react-router)',      icon: BookOpen,    action: 'doc' },
  { name: 'help',    desc: 'Show all available commands',                      icon: HelpCircle,  action: 'help' },
  { name: 'image',   desc: 'Attach an image to your next message',              icon: FileImage,   action: 'image' },
  { name: 'ls',      desc: 'List files in the current project',                icon: Terminal,    action: 'ls' },
  { name: 'model',   desc: 'Switch the AI model for this chat',                icon: Cpu,         action: 'models' },
  { name: 'models',  desc: 'Show all models for active provider',               icon: LayoutGrid,  action: 'models' },
  { name: 'search',  desc: 'Search the web (/search latest React hooks)',      icon: Search,      action: 'search' },
  { name: 'web',     desc: 'Fetch a URL and include as context',                 icon: Globe,       action: 'web' },
];

/* ═══════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════ */
interface ChatMessage {
  id: string; role: 'system' | 'user' | 'assistant' | 'error';
  content: string; timestamp: string; provider?: string;
}
interface ProviderSettings {
  systemPrompt?: string; temperature: number; maxTokens: number; contextWindow: number; creativeBalance: number; autoCompact: boolean;
}
interface NamedProvider {
  id: string; name: string; configId: string;
  apiKey?: string; baseUrl?: string; defaultModel: string;
  enabled: boolean; settings: ProviderSettings;
}

const DEFAULT_SETTINGS: ProviderSettings = {
  systemPrompt: '', temperature: 0.7, maxTokens: 4096, contextWindow: 128000, creativeBalance: 50, autoCompact: true,
};

export default function ChatPanel() {
  const version = useStore(s => s.version as unknown as number);
  const setVersion = useStore(s => s.setVersion);
  const projectRoot = useStore(s => s.projectRoot);
  const setProviders = useStore(s => s.setProviders);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [namedProviders, setNamedProviders] = useState<NamedProvider[]>(loadNamedProviders);
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectStep, setConnectStep] = useState<0 | 1>(0);
  const [showSettings, setShowSettings] = useState(false);
  const [newConfig, setNewConfig] = useState({ configId: 'openai', name: '', apiKey: '', baseUrl: '', defaultModel: '', saveKey: true });
  const [newSettings, setNewSettings] = useState<ProviderSettings>(DEFAULT_SETTINGS);
  const [modelsOpen, setModelsOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [slashOpen, setSlashOpen] = useState(false);
  const [selectedSlash, setSelectedSlash] = useState(0);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const storeSessions = useStore(s => s.sessions);
  const setStoreSessions = useStore(s => s.setSessions);
  const activeSessionId = useStore(s => s.activeSessionId);
  const setActiveSessionId = useStore(s => s.setActiveSessionId);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPollCount = useRef(0);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  useEffect(() => {
    if (storeSessions.length === 0) {
      fetch('/api/sessions').then(r => r.json()).then(s => setStoreSessions(s));
    }
    providersApi.list().then(setProviders);
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!activeSessionId) { setMessages([]); return; }
    const sess = storeSessions.find(s => s.id === activeSessionId);
    if (sess) {
      setMessages(sess.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })));
    }
  }, [activeSessionId]);

  const activeNamed = namedProviders.find(p => p.enabled);

  const totalContent = messages.reduce((acc, m) => acc + m.content, '');
  const estimatedTokens = estimateTokens(totalContent);
  const contextWindow = getContextWindow(activeNamed?.defaultModel || '');
  const contextPct = Math.min(100, Math.round((estimatedTokens / contextWindow) * 100));

  const addMsg = (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMsg: ChatMessage = {
      ...msg,
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, newMsg]);
    if (activeSessionId) {
      const next = storeSessions.map(s => s.id === activeSessionId ? { ...s, messages: [...s.messages, { ...newMsg, timestamp: new Date().toISOString() } as typeof s.messages[0]], updatedAt: new Date().toISOString() } : s);
      setStoreSessions(next);
    }
  };

  const handleCompact = () => {
    if (messages.length <= 3) { addMsg({ role: 'system', content: 'Not enough messages to compact.' }); return; }
    addMsg({ role: 'system', content: '*Compacting conversation to reduce context usage...*' });
    setMessages(prev => {
      const first = prev[0];
      const lastThree = prev.slice(-3);
      return [first, { role: 'system', content: `*[Compacted: ${prev.length - 4} messages removed, ${estimatedTokens.toLocaleString()} tokens reduced]*`, id: 'compact', timestamp: '' }, ...lastThree];
    });
  };

  const runSlash = (cmd: SlashCmd, rest = '') => {
    setInput(''); setSlashOpen(false); setSelectedSlash(0);
    switch (cmd.action) {
      case 'clear': setMessages([]); addMsg({ role: 'system', content: 'Chat history cleared.' }); break;
      case 'compact': handleCompact(); break;
      case 'connect': setConnectOpen(true); setConnectStep(0); break;
      case 'models': setModelsOpen(true); break;
      case 'help':  addMsg({ role: 'system', content: SLASH_COMMANDS.map(c => `**/${c.name}** — ${c.desc}`).join('\n') }); break;
      case 'cost':  addMsg({ role: 'system', content: `Estimated tokens: **${estimatedTokens.toLocaleString()}** / **${contextWindow.toLocaleString()}**\nContext usage: **${contextPct}%**` }); break;
      case 'debug': addMsg({ role: 'system', content: '*Debug: last reasoning chain shown in console.*' }); break;
      case 'ls':    addMsg({ role: 'system', content: `Project root: \`${projectRoot || '—'}\`` }); break;
      case 'doc':   addMsg({ role: 'system', content: rest ? `*Loading docs for **${rest}**…*` : 'Usage: **/doc** <library>' }); break;
      case 'web':   addMsg({ role: 'system', content: rest ? `*Fetching **${rest}**…*` : 'Usage: **/web** <url>' }); break;
      case 'search':addMsg({ role: 'system', content: rest ? `*Searching web for **${rest}**…*` : 'Usage: **/search** <query>' }); break;
      case 'image': addMsg({ role: 'system', content: 'Image upload coming soon.' }); break;
    }
    inputRef.current?.focus();
  };

  const onInputChange = (val: string) => {
    setInput(val);
    if (val.startsWith('/')) {
      const q = val.slice(1).trim().split(' ')[0];
      setSlashQuery(q);
      setSlashOpen(true);
      setSelectedSlash(0);
      if (/^\/\w+\s/.test(val)) {
        const cmdName = val.slice(1).split(' ')[0];
        const cmd = SLASH_COMMANDS.find(c => c.name === cmdName);
        if (cmd) { runSlash(cmd, val.slice(1 + cmdName.length).trim()); return; }
      }
    } else {
      setSlashOpen(false);
    }
  };

  const [slashQuery, setSlashQuery] = useState('');
  const slashMatches = slashQuery ? SLASH_COMMANDS.filter(c => c.name.startsWith(slashQuery)) : SLASH_COMMANDS;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ') {
      const m = input.match(/^\/(\w+)/);
      if (m) { const cmd = SLASH_COMMANDS.find(c => c.name === m[1]); if (cmd) { e.preventDefault(); runSlash(cmd); return; } }
    }
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
      setSlashOpen(false); setConnectOpen(false); setModelsOpen(false); setSessionOpen(false); setRenamingId(null);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    if (text.startsWith('/')) {
      const cmdName = text.slice(1).split(' ')[0];
      const cmd = SLASH_COMMANDS.find(c => c.name === cmdName);
      const rest = text.slice(1 + cmdName.length).trim();
      if (cmd) { runSlash(cmd, rest); setInput(''); return; }
    }
    setInput(''); addMsg({ role: 'user', content: text });
    if (!activeNamed) { addMsg({ role: 'system', content: 'No provider active. Type **/connect** to set up your API key.' }); return; }

    setSending(true); lastPollCount.current = 0;
    if (pollRef.current) clearInterval(pollRef.current);

    try {
      const providerId = activeNamed.configId;
      const sessionRes = await fetch('/api/sessions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: text.slice(0, 30), providerId, model: activeNamed.defaultModel || 'default' }),
      });
      const session = await sessionRes.json();
      setActiveSessionId(session.id);
      setStoreSessions([session, ...storeSessions]);

      const poll = async () => {
        try {
          const msgs = await (await fetch(`/api/sessions/${session.id}/messages`)).json();
          if (msgs.length > lastPollCount.current) {
            lastPollCount.current = msgs.length;
            const last = msgs[msgs.length - 1];
            if (last.role === 'assistant') {
              setMessages(prev => prev.some(m => m.id === last.id) ? prev : [...prev, {
                role: 'assistant', content: last.content, provider: last.provider || providerId,
                id: last.id, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }]);
              setVersion(version + 0.01);
            }
          }
        } catch {}
      };
      await chatApi.send({ sessionId: session.id, content: text, providerId, projectRoot });
      pollRef.current = setInterval(poll, 1500);
      setTimeout(() => { if (pollRef.current) clearInterval(pollRef.current); setSending(false); }, 30000);
    } catch (err: any) {
      addMsg({ role: 'error', content: `Error: ${err.message}` });
      setSending(false);
    }
  };

  const enableNamed = async (np: NamedProvider) => {
    const updated = namedProviders.map(p => ({ ...p, enabled: p.id === np.id }));
    setNamedProviders(updated); saveNamedProviders(updated);
    const pt = PROVIDER_TYPES.find(t => t.id === np.configId);
    await providersApi.update(np.configId, {
      enabled: true, apiKey: np.apiKey,
      baseUrl: np.baseUrl || pt?.defaultUrl,
      defaultModel: np.defaultModel || pt?.models[0],
      temperature: np.settings.temperature,
      maxTokens: np.settings.maxTokens,
    });
    addMsg({ role: 'system', content: `Connected to **${np.name}** (${pt?.name}).` });
    setConnectOpen(false);
  };
  const deleteNamed = (id: string) => { const next = namedProviders.filter(p => p.id !== id); setNamedProviders(next); saveNamedProviders(next); };
  const saveNew = () => {
    const t = PROVIDER_TYPES.find(x => x.id === newConfig.configId);
    const needsKey = newConfig.configId !== 'opencode' && newConfig.configId !== 'ollama';
    if (!newConfig.name.trim() || (needsKey && !newConfig.apiKey.trim()) || !newConfig.defaultModel) return;
    const np: NamedProvider = {
      id: `named-${Date.now()}`, name: newConfig.name, configId: newConfig.configId,
      apiKey: needsKey ? (newConfig.saveKey ? newConfig.apiKey : undefined) : undefined,
      baseUrl: t?.defaultUrl, defaultModel: newConfig.defaultModel, enabled: true,
      settings: newSettings,
    };
    const next = namedProviders.filter(p => p.id !== np.id).map(p => ({ ...p, enabled: false }));
    next.push(np); setNamedProviders(next); saveNamedProviders(next); enableNamed(np);
    setNewConfig({ configId: 'openai', name: '', apiKey: '', baseUrl: '', defaultModel: '', saveKey: true });
    setNewSettings(DEFAULT_SETTINGS); setConnectStep(0); setShowSettings(false);
  };
  const setModel = (model: string) => {
    if (!activeNamed) return;
    const updated = namedProviders.map(p => p.id === activeNamed.id ? { ...p, defaultModel: model } : p);
    setNamedProviders(updated); saveNamedProviders(updated);
    addMsg({ role: 'system', content: `Model switched to **${model}**.` });
    setModelsOpen(false);
  };

  const activeSession = storeSessions.find(s => s.id === activeSessionId);

  const createNewSession = () => {
    const id = Date.now().toString();
    const newSession = { id, name: 'New Chat', messages: [] as any[], providerId: activeNamed?.configId || '', model: activeNamed?.defaultModel || '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setStoreSessions([newSession, ...storeSessions]);
    setActiveSessionId(id);
    setMessages([]);
    setSessionOpen(false);
  };

  const deleteSession = (id: string) => {
    const next = storeSessions.filter(s => s.id !== id);
    setStoreSessions(next);
    if (activeSessionId === id) { setActiveSessionId(null); setMessages([]); }
  };

  const renameSession = (id: string, newName: string) => {
    const next = storeSessions.map(s => s.id === id ? { ...s, name: newName } : s);
    setStoreSessions(next);
    setRenamingId(null);
  };

  return (
    <div className="flex flex-col h-full bg-bg text-text relative">
      
      <AnimatePresence>{connectOpen && (
        <motion.div key="connect" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}
          className="absolute inset-x-2 top-3 bottom-20 z-50 rounded-2xl bg-bg-surface/95 backdrop-blur-md border border-border shadow-[0_0_40px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col"
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-bg-panel/60">
            <div className="w-6 h-6 rounded-md bg-accent-bg flex items-center justify-center"><Plug size={12} className="text-accent" /></div>
            <span className="text-[11px] font-bold">{connectStep === 0 ? 'Providers' : 'Add Connection'}</span>
            <button onClick={() => { setConnectOpen(false); setConnectStep(0); setShowSettings(false); }} className="ml-auto p-1 text-text-dim hover:text-text"><X size={12} /></button>
          </div>
          {connectStep === 0 && (
            <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
              {PROVIDER_TYPES.map(t => {
                const m = PROVIDER_META[t.id]; const Icon = m?.icon || Server;
                return (
                  <button key={t.id} onClick={() => { setNewConfig(c => ({ ...c, configId: t.id, baseUrl: t.defaultUrl, defaultModel: '' })); setConnectStep(1); }}
                    className="w-full flex items-center gap-2.5 p-2.5 rounded-xl border border-border bg-bg-panel hover:border-accent/30 hover:bg-bg-hover transition-all text-left"
                  >
                    <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: m?.bg }}><Icon size={14} style={{ color: m?.color }} /></div>
                    <div className="flex-1"><p className="text-[11px] font-semibold">{t.name}</p><p className="text-[9px] text-text-dim">{m?.desc}</p></div>
                    <ChevronDown size={10} className="text-text-dim rotate-[-90deg]" />
                  </button>
                );
              })}
              {namedProviders.length > 0 && <>
                <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider mt-3 pt-2 border-t border-border">Saved</p>
                <div className="space-y-1 mt-1.5">{namedProviders.map(np => {
                  const m = PROVIDER_META[np.configId]; const Icon = m?.icon || Server;
                  return (
                    <div key={np.id} className={`flex items-center gap-2 p-2 rounded-xl border ${np.enabled ? 'border-accent/25 bg-accent-bg/15' : 'border-border bg-bg-panel'}`}>
                      <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: m?.bg }} ><Icon size={11} style={{ color: m?.color }} /></div>
                      <p className="text-[10px] font-semibold flex-1 truncate">{np.name}</p>
                      <button onClick={() => enableNamed(np)} className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${np.enabled ? 'bg-accent text-bg' : 'bg-bg-hover text-text-secondary'}`}>{np.enabled ? 'Active' : 'Use'}</button>
                      <button onClick={() => deleteNamed(np.id)} className="p-1 text-text-dim hover:text-danger"><Trash2 size={10} /></button>
                    </div>
                  );
                })}</div>
              </>}
            </div>
          )}
          {connectStep === 1 && (
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {(() => {
                const t = PROVIDER_TYPES.find(x => x.id === newConfig.configId);
                const m = PROVIDER_META[newConfig.configId]; const Icon = m?.icon || Server;
                return (
                  <div className="space-y-3">
                    <button onClick={() => setConnectStep(0)} className="flex items-center text-[10px] text-text-dim hover:text-text"><ChevronLeft size={10} /> Back</button>
                    <div className="flex items-center gap-2"><div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: m?.bg }} ><Icon size={14} style={{ color: m?.color }} /></div>
                      <div><p className="text-[12px] font-bold">{t?.name}</p><p className="text-[10px] text-text-dim">{m?.desc}</p></div>
                    </div>
                    <div><label className="text-[9px] font-bold text-text-muted mb-1 block">Name</label>
                      <input value={newConfig.name} placeholder="e.g. My OpenAI Key" onChange={e => setNewConfig(c => ({ ...c, name: e.target.value }))} className="w-full bg-bg-panel border border-border rounded-xl px-3 py-1.5 text-[11px] focus:outline-none focus:border-accent/50" />
                    </div>
                    <div><label className="text-[9px] font-bold text-text-muted mb-1 block">API Key</label>
                      <div className="relative"><KeyRound size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim/40" />
                        <input value={newConfig.apiKey} onChange={e => setNewConfig(c => ({ ...c, apiKey: e.target.value }))} type="password" placeholder="Paste API key" className="w-full bg-bg-panel border border-border rounded-xl pl-8 pr-3 py-1.5 text-[11px] focus:outline-none focus:border-accent/50 font-mono" />
                      </div>
                      <label className="flex items-center gap-2 mt-1 text-[9px] text-text-secondary cursor-pointer">
                        <div className={`w-3 h-3 rounded border flex items-center justify-center ${newConfig.saveKey ? 'bg-accent border-accent' : 'border-text-dim/30'}`}>{newConfig.saveKey && <Check size={8} className="text-bg" />}</div>
                        <input type="checkbox" checked={newConfig.saveKey} onChange={e => setNewConfig(c => ({ ...c, saveKey: e.target.checked }))} className="hidden" /> Save <span className="hidden sm:inline">for next time</span>
                      </label>
                    </div>
                    <div><label className="text-[9px] font-bold text-text-muted mb-1 block">Model</label>
                      <select value={newConfig.defaultModel} onChange={e => setNewConfig(c => ({ ...c, defaultModel: e.target.value }))} className="w-full bg-bg-panel border border-border rounded-xl px-3 py-2 text-[11px] text-text appearance-none focus:outline-none focus:border-accent/50">
                        <option value="" disabled>Choose model…</option>
                        {(t?.models || []).map(md => <option key={md} value={md}>{md}</option>)}
                      </select>
                    </div>
                    <div className="border border-border rounded-xl bg-bg-panel overflow-hidden">
                      <button onClick={() => setShowSettings(s => !s)} className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-bold text-text-muted hover:text-text transition-colors">
                        <span className="flex items-center gap-1.5"><Sliders size={12} /> Settings</span>
                        {showSettings ? <ChevronDown size={10} /> : <ChevronUp size={10} />}
                      </button>
                      <AnimatePresence>
                        {showSettings && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <div className="p-3 space-y-3 border-t border-border" onClick={e => e.stopPropagation()}>
                              <div><label className="text-[9px] font-bold text-text-muted mb-1 block">Temperature <span className="font-mono text-text-secondary">{newSettings.temperature}</span></label>
                                <input type="range" min="0" max="1" step="0.01" value={newSettings.temperature} onChange={e => setNewSettings(s => ({ ...s, temperature: parseFloat(e.target.value) }))} className="w-full accent-accent h-1" />
                                <div className="flex justify-between text-[9px] text-text-dim mt-1"><span>Precise</span><span>Creative</span></div>
                              </div>
                              <div><label className="text-[9px] font-bold text-text-muted mb-1 block">Max Context Window <span className="font-mono text-text-secondary">{(newSettings.contextWindow / 1000).toFixed(0)}k</span></label>
                                <input type="range" min="32000" max="2000000" step="8000" value={newSettings.contextWindow} onChange={e => setNewSettings(s => ({ ...s, contextWindow: parseInt(e.target.value) }))} className="w-full accent-accent h-1" />
                              </div>
                              <div><label className="text-[9px] font-bold text-text-muted mb-1 block">Max Tokens <span className="font-mono text-text-secondary">{newSettings.maxTokens.toLocaleString()}</span></label>
                                <input type="range" min="512" max="65536" step="512" value={newSettings.maxTokens} onChange={e => setNewSettings(s => ({ ...s, maxTokens: parseInt(e.target.value) }))} className="w-full accent-accent h-1" />
                              </div>
                              <div><label className="text-[9px] font-bold text-text-muted mb-1 block">Creative Balance <span className="font-mono text-text-secondary">{newSettings.creativeBalance}%</span></label>
                                <input type="range" min="0" max="100" step="1" value={newSettings.creativeBalance} onChange={e => setNewSettings(s => ({ ...s, creativeBalance: parseInt(e.target.value) }))} className="w-full accent-accent h-1" />
                              </div>
                              <div><label className="text-[9px] font-bold text-text-muted mb-1 block">System Prompt</label>
                                <textarea value={newSettings.systemPrompt} onChange={e => setNewSettings(s => ({ ...s, systemPrompt: e.target.value }))} rows={3} placeholder="Optional custom system prompt…" className="w-full bg-bg-panel border border-border rounded-lg px-3 py-2 text-[11px] focus:outline-none focus:border-accent/50 resize-none" />
                              </div>
                              <label className="flex items-center gap-2 text-[10px] text-text-secondary cursor-pointer">
                                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${newSettings.autoCompact ? 'bg-accent border-accent' : 'border-text-dim/30'}`}>{newSettings.autoCompact && <Check size={8} className="text-bg" />}</div>
                                <input type="checkbox" checked={newSettings.autoCompact} onChange={e => setNewSettings(s => ({ ...s, autoCompact: e.target.checked }))} className="hidden" />
                                Auto-compact at 80% context
                              </label>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <button onClick={saveNew} disabled={(()=>{const needsKey=newConfig.configId!=='opencode'&&newConfig.configId!=='ollama';return!newConfig.name.trim()||(needsKey&&!newConfig.apiKey.trim())||!newConfig.defaultModel;})()} className="w-full py-2 bg-accent text-bg text-[11px] font-bold rounded-xl hover:opacity-90 disabled:opacity-20 transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-accent/10">
                      <Save size={12} /> Connect
                    </button>
                  </div>
                );
              })()}
            </div>
          )}
        </motion.div>
      )}</AnimatePresence>

      <AnimatePresence>{modelsOpen && (
        <motion.div key="models" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}
          className="absolute inset-x-2 top-3 bottom-20 z-50 rounded-2xl bg-bg-surface/95 backdrop-blur-md border border-border shadow-[0_0_40px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col"
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-bg-panel/60">
            <div className="w-6 h-6 rounded-md bg-accent-bg flex items-center justify-center "><Cpu size={12} className="text-accent" /></div>
            <span className="text-[11px] font-bold">Models</span>
            <button onClick={() => setModelsOpen(false)} className="ml-auto p-1 text-text-dim hover:text-text"><X size={12} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {activeNamed && (() => {
              const pt = PROVIDER_TYPES.find(t => t.id === activeNamed.configId);
              return (
                <div className="flex flex-wrap gap-1">
                  {(pt?.models || []).map(md => (
                    <button key={md} onClick={() => setModel(md)} className={`px-2.5 py-1 text-[9px] rounded-lg border transition-all ${activeNamed.defaultModel === md ? 'bg-accent text-bg border-accent shadow-sm' : 'border-border bg-bg-panel text-text-secondary hover:bg-bg-hover'}`}>{md}</button>
                  ))}
                </div>
              );
            })()}
            {!activeNamed && (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-text-dim"><Cpu size={20} className="opacity-20" /><p className="text-[11px]">No provider connected.</p><button className="text-[11px] text-accent" onClick={() => { setModelsOpen(false); setConnectOpen(true); }}>Use /connect</button></div>
            )}
          </div>
        </motion.div>
      )}</AnimatePresence>

      {/* ═══════════════════════════════════════════════════
         TOOLBAR - Full width session bar only
         ═══════════════════════════════════════════════════ */}
      <div className="shrink-0 flex items-center gap-0.5 px-2.5 py-1.5 border-b border-border bg-bg-panel relative">

        {/* Session chooser - takes full width */}
        <div className="flex-1 relative flex items-center gap-1 min-w-0">
          <button onClick={() => setSessionOpen(o => !o)} className="flex items-center gap-1.5 flex-1 px-2 py-1 text-[10px] font-semibold text-text-secondary hover:text-text rounded-lg hover:bg-bg-hover transition-all min-w-0">
            <MessageSquare size={12} />
            <span className="truncate">{activeSession?.name || 'New Chat'}</span>
            <ChevronDown size={10} className={sessionOpen ? 'rotate-180' : ''} />
          </button>
        </div>

        {/* New chat */}
        <button onClick={createNewSession} className="p-1.5 text-text-muted hover:text-accent hover:bg-accent-bg rounded-lg transition-colors shrink-0" title="New Chat">
          <Plus size={13} />
        </button>

        {/* Delete current chat */}
        <button
          onClick={() => { if (activeSessionId) deleteSession(activeSessionId); }}
          disabled={!activeSessionId}
          className="p-1.5 text-text-muted hover:text-danger hover:bg-danger-bg rounded-lg transition-colors shrink-0 disabled:opacity-20"
          title="Delete this chat"
        >
          <Trash2 size={13} />
        </button>

        {sessionOpen && (
          <div className="absolute top-[38px] left-2.5 right-2.5 bg-bg-surface border border-border rounded-xl shadow-xl z-40 py-1 max-h-60 overflow-y-auto"
            onMouseLeave={() => setSessionOpen(false)}
          >
            {storeSessions.length === 0 && <div className="px-3 py-2 text-[10px] text-text-dim">No chats yet</div>}
            {storeSessions.map((s: any) => (
              <div key={s.id} className={`flex items-center gap-1 px-2 py-1.5 hover:bg-bg-hover transition-colors ${activeSessionId === s.id ? 'bg-accent-bg/20' : ''}`}>
                <button onClick={() => { setActiveSessionId(s.id); setSessionOpen(false); }}
                  className="flex-1 flex items-center gap-2 text-left text-[10px] min-w-0"
                >
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeSessionId === s.id ? 'bg-accent' : 'bg-text-dim'}`} />
                  <span className="truncate text-text">{s.name || 'Untitled'}</span>
                </button>
                {renamingId === s.id ? (
                  <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)} onBlur={() => renameSession(s.id, renameValue)} onKeyDown={e => { if (e.key === 'Enter') renameSession(s.id, renameValue); if (e.key === 'Escape') setRenamingId(null); }}
                    className="w-24 bg-bg-panel border border-border rounded px-1.5 py-0.5 text-[9px] text-text focus:outline-none focus:border-accent" />
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); setRenamingId(s.id); setRenameValue(s.name || ''); }} className="p-0.5 text-text-dim hover:text-accent rounded"><Pencil size={10} /></button>
                )}
                <button onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }} className="p-0.5 text-text-dim hover:text-danger rounded"><Trash2 size={10} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════
         MESSAGES
         ═══════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-text-muted select-none">
              <div className="w-14 h-14 rounded-2xl bg-accent-bg flex items-center justify-center"><Bot size={28} className="text-accent/40" /></div>
              <div className="text-center space-y-1">
                <p className="text-text-secondary font-semibold text-[13px]">Start a conversation</p>
                <p className="text-[11px] opacity-60">Press <kbd className="px-1.5 py-0.5 rounded bg-bg-hover text-text-secondary text-[10px] font-mono">/</kbd> for commands</p>
              </div>
            </div>
          ) : (
            <div className="p-3 space-y-3">
              {messages.map(msg => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                  className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${msg.role === 'user' ? 'bg-accent text-bg' : msg.role === 'assistant' ? 'bg-bg-surface border border-border' : 'bg-danger-bg border border-danger/30'}`}>
                    {msg.role === 'user' ? <User size={13} /> : msg.role === 'assistant' ? <Bot size={13} className="text-accent" /> : msg.role === 'error' ? <AlertCircle size={13} className="text-danger" /> : <Sparkles size={13} className="text-warning" />}
                  </div>
                  <div className="flex flex-col gap-0.5 max-w-[82%]">
                    <div className={`rounded-2xl px-3.5 py-2.5 text-[12px] leading-relaxed ${msg.role === 'user' ? 'bg-accent text-bg rounded-tr-sm' : msg.role === 'assistant' ? 'bg-bg-surface border border-border text-text rounded-tl-sm' : 'bg-danger-bg/40 border border-danger/20 text-danger rounded-tl-sm'}`}>
                      <MessageContent content={msg.content} />
                    </div>
                    {msg.provider && <div className="flex items-center gap-1 px-1"><Zap size={8} className="text-accent/60" /><span className="text-[9px] text-text-dim">{msg.provider} &middot; {msg.timestamp}</span></div>}
                  </div>
                </motion.div>
              ))}
              {sending && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 pl-9">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-surface border border-border rounded-full">{[0, 1, 2].map(i => <div key={i} className="w-1 h-1 rounded-full bg-accent animate-bounce" style={{ animationDelay: `${120 * i}ms` }} />)}</div>
                </motion.div>
              )}
              <div ref={scrollRef} />
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════
           BOTTOM INFO: provider name, model, context window
           ═══════════════════════════════════════════════════ */}
        <div className="shrink-0 border-t border-border bg-bg-panel/80 backdrop-blur-sm px-3 pt-2 pb-2.5">
          {/* Prompt bar */}
          <div className="relative">
            {slashOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 max-h-56 overflow-y-auto bg-bg-surface border border-border rounded-xl shadow-2xl overflow-hidden z-30">
                {slashMatches.length === 0 ? (
                  <div className="px-3 py-2 text-[11px] text-text-dim">No commands match &quot;{slashQuery}&quot;</div>
                ) : (
                  slashMatches.map((cmd: any, idx: number) => {
                    const Icon = cmd.icon;
                    return (
                      <button key={cmd.name} onClick={() => runSlash(cmd)}
                        className={`w-full flex items-center gap-3 px-3 py-2 transition-colors text-left ${idx === selectedSlash ? 'bg-bg-hover' : ''}`}
                        onMouseDown={e => e.preventDefault()}
                      >
                        <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${idx === selectedSlash ? 'bg-accent-bg' : 'bg-bg-hover'}`}><Icon size={13} className={idx === selectedSlash ? 'text-accent' : 'text-text-dim'} /></div>
                        <div className="flex-1 min-w-0"><p className="text-[11px] font-semibold">/{cmd.name}</p><p className="text-[10px] text-text-dim truncate">{cmd.desc}</p></div>
                        {idx === selectedSlash && <div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            )}
            <div className="flex gap-2 items-end bg-bg-surface border border-border/80 rounded-2xl px-3 py-2.5 focus-within:border-accent/60 focus-within:shadow-[0_0_0_3px_rgba(168,85,247,0.08)] transition-all">
              <div className="shrink-0 pt-2"><Command size={11} className="text-text-dim/40" /></div>
              <input ref={inputRef} value={input} onChange={e => onInputChange(e.target.value)} onKeyDown={onKeyDown}
                placeholder={activeNamed ? `Ask ${activeNamed.name}...` : "Ask anything or press / for commands..."}
                className="flex-1 bg-transparent text-[12px] text-text placeholder:text-text-dim/70 focus:outline-none leading-relaxed py-0.5"
                spellCheck={false} autoComplete="off" />
              <button onClick={handleSend} disabled={sending || !input.trim()} className="p-2 bg-accent text-bg rounded-xl hover:opacity-90 disabled:opacity-15 transition-all shrink-0">
                <Send size={13} />
              </button>
            </div>
          </div>

          {/* Provider, model, context info */}
          <div className="flex items-center justify-between mt-2 px-1">
            <div className="flex items-center gap-2">
              {activeNamed ? (
                <>
                  {/* Provider name */}
                  <div className="flex items-center gap-1 text-[9px]">
                    {(() => {
                      const meta = PROVIDER_META[activeNamed.configId];
                      const Icon = meta?.icon || Server;
                      return (
                        <>
                          <div className="w-4 h-4 rounded-sm flex items-center justify-center shrink-0" style={{ background: meta?.bg }}>
                            <Icon size={9} style={{ color: meta?.color }} />
                          </div>
                          <span className="text-text-secondary font-semibold">{meta?.desc ? meta.desc.split(',')[0] : activeNamed.name}</span>
                        </>
                      );
                    })()}
                  </div>
                  <span className="text-text-dim/30">|</span>
                  {/* Model name */}
                  <div className="flex items-center gap-1 text-[9px]" title={`${activeNamed.defaultModel}`}>
                    <Cpu size={9} className="text-text-dim/60" />
                    <span className="text-text-dim font-mono max-w-[120px] truncate">{activeNamed.defaultModel}</span>
                  </div>
                  <span className="text-text-dim/30">|</span>
                  {/* Context window */}
                  <div className="flex items-center gap-1 text-[9px]">
                    <span className="text-text-dim font-mono">{(contextWindow / 1000).toFixed(0)}k ctx</span>
                    {/* Context usage bar */}
                    <div className="w-12 h-1 rounded-full bg-bg-hover overflow-hidden">
                      <div className="h-full transition-all duration-300" style={{ width: `${Math.min(contextPct, 100)}%`, backgroundColor: contextPct > 80 ? '#ef4444' : contextPct > 60 ? '#eab308' : '#a855f7' }} />
                    </div>
                    <span className={`font-mono tabular-nums ${contextPct > 80 ? 'text-danger' : contextPct > 60 ? 'text-warning' : 'text-text-dim'}`}>{contextPct}%</span>
                    {contextPct >= 80 && (
                      <button onClick={handleCompact} className="p-0.5 rounded bg-warning/10 text-warning hover:bg-warning/20 transition-colors" title="Compact context"><Minimize size={8} /></button>
                    )}
                  </div>
                </>
              ) : (
                <span className="text-[9px] text-text-dim/60">No Provider · /connect</span>
              )}
            </div>
            <span className="text-[9px] text-text-dim/40 font-mono">{input.length}/{estimatedTokens.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MESSAGE CONTENT RENDERER
   ═══════════════════════════════════════════════════ */
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
