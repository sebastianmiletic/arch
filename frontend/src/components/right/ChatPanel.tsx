import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '../../stores/appStore';
import { chatApi, providersApi } from '../../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Bot, User, Zap, AlertCircle, Sparkles,
  Plug, Trash2, Save, X, ChevronRight, Check,
  KeyRound, Server, Cpu, Clock, MessageSquare,
  Shield, Globe, Flame, Hexagon
} from 'lucide-react';

function loadNamedProviders(): NamedProvider[] {
  try { return JSON.parse(localStorage.getItem('arch_named_providers') || '[]'); }
  catch { return []; }
}
function saveNamedProviders(list: NamedProvider[]) {
  localStorage.setItem('arch_named_providers', JSON.stringify(list));
}
function maskKey(key?: string): string {
  if (!key) return '';
  if (key.length <= 12) return '••••••••';
  return key.slice(0, 4) + '••••••••••••' + key.slice(-4);
}

// ─── Provider metadata with brand colors ───
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

type ChatView = 'messages' | 'connect' | 'providers' | 'models' | 'sessions';

interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'error';
  content: string;
  timestamp: string;
  provider?: string;
}

interface NamedProvider {
  id: string;
  name: string;
  configId: string;
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  enabled: boolean;
}

export default function ChatPanel() {
  const providers = useStore(s => s.providers);
  const setProviders = useStore(s => s.setProviders);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const version = useStore(s => s.version as unknown as number);
  const setVersion = useStore(s => s.setVersion);
  const [view, setView] = useState<ChatView>('messages');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [namedProviders, setNamedProviders] = useState<NamedProvider[]>(loadNamedProviders);
  const [connectStep, setConnectStep] = useState<0 | 1 | 2>(0);
  const [newConfig, setNewConfig] = useState({
    configId: 'openai', name: '', apiKey: '', baseUrl: '', defaultModel: '', saveKey: true
  });
  const [sessions, setSessions] = useState<any[]>([]);
  const [models, setModels] = useState<Record<string, string[]>>({});
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPollCount = useRef(0);

  useEffect(() => {
    providersApi.list().then(setProviders);
    fetch('/api/sessions').then(r => r.json()).then(setSessions);
  }, []);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, [view]);

  const addMsg = useCallback((msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    setMessages(prev => [...prev, {
      ...msg,
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
  }, []);

  const getActiveNamed = () => namedProviders.find(p => p.enabled);
  const getActiveBackend = () => providers.find(p => p.enabled);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput('');

    if (text === '/connect') {
      setView('connect');
      setConnectStep(0);
      addMsg({ role: 'system', content: '**Provider Setup** — Choose a provider below to connect.' });
      return;
    }
    if (text === '/clear') {
      setMessages([]);
      setTimeout(() => addMsg({ role: 'system', content: 'Chat history cleared.' }), 50);
      return;
    }

    addMsg({ role: 'user', content: text });

    const active = getActiveNamed() || getActiveBackend();
    if (!active) {
      addMsg({ role: 'system', content: 'No provider active. Type **/connect** to set up your API key.' });
      return;
    }

    // ─── Start agent chat with project context ───
    setSending(true);
    lastPollCount.current = 0;
    if (pollRef.current) clearInterval(pollRef.current);

    try {
      const named = getActiveNamed();
      const backend = getActiveBackend();
      const providerId = named ? named.configId : (backend?.id || 'ollama');
      const projectRoot = useStore.getState().projectRoot;

      const sessionRes = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: text.slice(0, 30),
          providerId,
          model: named?.defaultModel || backend?.defaultModel || 'default'
        }),
      });
      const session = await sessionRes.json();

      const poll = async () => {
        try {
          const msgs = await (await fetch(`/api/sessions/${session.id}/messages`)).json();
          if (msgs.length > lastPollCount.current) {
            lastPollCount.current = msgs.length;
            const last = msgs[msgs.length - 1];
            if (last.role === 'assistant') {
              setMessages(prev => {
                if (prev.some(m => m.id === last.id)) return prev;
                return [...prev, {
                  role: 'assistant', content: last.content,
                  provider: last.provider || providerId,
                  id: last.id,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }];
              });
              setVersion(version + 0.01);
            }
          }
        } catch {}
      };

      // Fire agent
      await chatApi.send({ sessionId: session.id, content: text, providerId, projectRoot });

      // Poll every 1.5s for results
      pollRef.current = setInterval(poll, 1500);
      // Auto-stop after 30s
      setTimeout(() => { if (pollRef.current) clearInterval(pollRef.current); setSending(false); }, 30000);
    } catch (err: any) {
      addMsg({ role: 'error', content: `Chat error: ${err.message}` });
      setSending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const enableNamedProvider = async (np: NamedProvider) => {
    const updated = namedProviders.map(p => ({ ...p, enabled: p.id === np.id }));
    setNamedProviders(updated);
    saveNamedProviders(updated);
    const pt = PROVIDER_TYPES.find(t => t.id === np.configId);
    await providersApi.update(np.configId, {
      enabled: true, apiKey: np.apiKey,
      baseUrl: np.baseUrl || pt?.defaultUrl,
      defaultModel: np.defaultModel || pt?.models[0]
    });
    const refreshed = await providersApi.list();
    setProviders(refreshed);
    addMsg({ role: 'system', content: `Connected to **${np.name}** (${pt?.name}).` });
    setView('messages');
  };

  const deleteNamedProvider = (id: string) => {
    const next = namedProviders.filter(p => p.id !== id);
    setNamedProviders(next);
    saveNamedProviders(next);
  };

  const fetchModels = async (providerId: string) => {
    try {
      const data = await providersApi.models(providerId);
      setModels(prev => ({ ...prev, [providerId]: data.models }));
    } catch {}
  };

  // ─── Active provider chip for header ───
  const activeNamed = getActiveNamed();
  const activeBackend = getActiveBackend();
  const activeProvider = activeNamed || activeBackend;

  // ─── Message area ───
  const messageArea = (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-text-muted select-none">
            <div className="w-14 h-14 rounded-2xl bg-accent-bg flex items-center justify-center">
              <Bot size={28} className="text-accent/40" />
            </div>
            <div className="text-center space-y-1.5">
              <p className="text-text-secondary font-semibold text-[13px]">Start a conversation</p>
              <p className="text-[11px] opacity-60">Type <code className="text-accent bg-accent-bg px-1 py-0.5 rounded text-[10px] font-mono">/connect</code> to add your API key</p>
            </div>
          </div>
        ) : (
          <div className="p-3 space-y-4">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                  msg.role === 'user' ? 'bg-accent text-bg' :
                  msg.role === 'assistant' ? 'bg-bg-surface border border-border' :
                  msg.role === 'error' ? 'bg-danger-bg border border-danger/30' :
                  'bg-bg-surface border border-border'
                }`}>
                  {msg.role === 'user' ? <User size={13} /> :
                   msg.role === 'assistant' ? <Bot size={13} className="text-accent" /> :
                   msg.role === 'error' ? <AlertCircle size={13} className="text-danger" /> :
                   <Sparkles size={13} className="text-warning" />}
                </div>

                {/* Bubble */}
                <div className="flex flex-col gap-0.5 max-w-[82%]">
                  <div className={`rounded-2xl px-3.5 py-2.5 text-[12px] leading-relaxed ${
                    msg.role === 'user' ? 'bg-accent text-bg rounded-tr-sm' :
                    msg.role === 'assistant' ? 'bg-bg-surface border border-border text-text rounded-tl-sm' :
                    msg.role === 'error' ? 'bg-danger-bg/50 border border-danger/20 text-danger rounded-tl-sm' :
                    'bg-bg-surface/50 border border-border/50 text-text-secondary rounded-tl-sm'
                  }`}>
                    <MessageContent content={msg.content} />
                  </div>
                  {msg.provider && (
                    <div className="flex items-center gap-1 px-1">
                      <Zap size={8} className="text-accent/60" />
                      <span className="text-[9px] text-text-dim">{msg.provider} · {msg.timestamp}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
            {sending && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2.5 pl-9.5">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-surface border border-border rounded-full">
                  <div className="w-1 h-1 rounded-full bg-accent animate-bounce" />
                  <div className="w-1 h-1 rounded-full bg-accent animate-bounce" style={{ animationDelay: '120ms' }} />
                  <div className="w-1 h-1 rounded-full bg-accent animate-bounce" style={{ animationDelay: '240ms' }} />
                </div>
              </motion.div>
            )}
            <div ref={scrollRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border bg-bg-panel/80 backdrop-blur-sm">
        <div className="p-2.5">
          <div className="flex gap-2 items-end bg-bg-surface border border-border/80 rounded-2xl px-3.5 py-2.5 focus-within:border-accent/60 focus-within:shadow-[0_0_0_3px_rgba(168,85,247,0.08)] transition-all">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={activeProvider ? `Ask ${activeProvider.name}…` : "Ask anything or type /connect…"}
              className="flex-1 bg-transparent text-[12px] text-text placeholder:text-text-dim/70 focus:outline-none leading-relaxed py-0.5"
              spellCheck={false} autoComplete="off"
            />
            <button
              onClick={handleSend}
              disabled={sending || !input.trim()}
              className="p-2 bg-accent text-bg rounded-xl hover:opacity-90 disabled:opacity-15 transition-all shrink-0 shadow-sm shadow-accent/10"
            >
              <Send size={13} />
            </button>
          </div>
          <div className="flex items-center justify-between mt-1.5 px-1">
            <span className="text-[9px] text-text-dim/60">
              {(() => {
                if (activeNamed) return `Connected to ${activeNamed.name}`;
                if (activeBackend) return `Connected to ${activeBackend.name}`;
                return 'No provider — type /connect';
              })()} · <span className="font-mono">v{version.toFixed(2)}</span>
            </span>
            <span className="text-[9px] text-text-dim/40">{input.length}</span>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── CONNECT PANEL ───
  const connectPanel = (
    <div className="flex flex-col h-full bg-bg-panel">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-bg-panel">
        <div className="flex items-center gap-2.5 px-4 py-3">
          <div className="w-7 h-7 rounded-lg bg-accent-bg flex items-center justify-center">
            <Plug size={14} className="text-accent" />
          </div>
          <div className="flex-1">
            <h3 className="text-[12px] font-bold text-text">Connect Provider</h3>
            <p className="text-[10px] text-text-dim">Add an AI API key to start chatting</p>
          </div>
          <button onClick={() => setView('messages')} className="p-1.5 text-text-dim hover:text-text hover:bg-bg-hover rounded-lg transition-colors">
            <X size={13} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Step 1: Choose provider */}
        {connectStep === 0 && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="p-3 space-y-2">
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider px-1">Choose Provider</p>
            <div className="grid grid-cols-1 gap-1.5">
              {PROVIDER_TYPES.map(t => {
                const meta = PROVIDER_META[t.id];
                const Icon = meta?.icon || Server;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setNewConfig(c => ({ ...c, configId: t.id, baseUrl: t.defaultUrl, defaultModel: t.models[0] }));
                      setConnectStep(1);
                    }}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border bg-bg-surface hover:border-accent/30 hover:bg-bg-hover transition-all text-left group"
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors" style={{ background: meta?.bg }}>
                      <Icon size={18} style={{ color: meta?.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-text">{t.name}</p>
                      <p className="text-[10px] text-text-dim truncate">{meta?.desc || t.models[0]}</p>
                    </div>
                    <ChevronRight size={14} className="text-text-dim group-hover:text-text transition-colors" />
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Step 2: Configure */}
        {connectStep === 1 && (
          <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="p-4 space-y-4">
            {(() => {
              const t = PROVIDER_TYPES.find(x => x.id === newConfig.configId);
              const meta = PROVIDER_META[newConfig.configId];
              const Icon = meta?.icon || Server;
              return (
                <>
                  <button onClick={() => setConnectStep(0)} className="flex items-center gap-1 text-[10px] text-text-dim hover:text-text transition-colors">
                    <ChevronRight size={11} className="rotate-180" /> Back
                  </button>

                  <div className="flex items-center gap-3 pb-3 border-b border-border">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: meta?.bg }}>
                      <Icon size={20} style={{ color: meta?.color }} />
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-text">{t?.name}</p>
                      <p className="text-[10px] text-text-dim">{meta?.desc}</p>
                    </div>
                  </div>

                  <div className="space-y-3.5">
                    <div>
                      <label className="text-[10px] font-semibold text-text-muted mb-1.5 block">Connection Name</label>
                      <input
                        value={newConfig.name}
                        onChange={e => setNewConfig(c => ({ ...c, name: e.target.value }))}
                        placeholder="e.g. My OpenAI Key"
                        className="w-full bg-bg-surface border border-border rounded-xl px-3.5 py-2 text-[12px] text-text placeholder:text-text-dim/50 focus:outline-none focus:border-accent/50 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold text-text-muted mb-1.5 block">API Key</label>
                      <div className="relative">
                        <KeyRound size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim/40" />
                        <input
                          value={newConfig.apiKey}
                          onChange={e => setNewConfig(c => ({ ...c, apiKey: e.target.value }))}
                          type="password"
                          placeholder="Paste API key"
                          className="w-full bg-bg-surface border border-border rounded-xl pl-9 pr-3.5 py-2 text-[12px] text-text placeholder:text-text-dim/40 focus:outline-none focus:border-accent/50 transition-colors font-mono"
                        />
                      </div>
                      <label className="flex items-center gap-2 mt-2 text-[10px] text-text-secondary cursor-pointer">
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${newConfig.saveKey ? 'bg-accent border-accent' : 'border-text-dim/30'}`}>
                          {newConfig.saveKey && <Check size={9} className="text-bg" />}
                        </div>
                        <input type="checkbox" checked={newConfig.saveKey} onChange={e => setNewConfig(c => ({ ...c, saveKey: e.target.checked }))} className="hidden" />
                        Save API key for next time
                      </label>
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold text-text-muted mb-1.5 block">Model</label>
                      <select
                        value={newConfig.defaultModel}
                        onChange={e => setNewConfig(c => ({ ...c, defaultModel: e.target.value }))}
                        className="w-full bg-bg-surface border border-border rounded-xl px-3.5 py-2 text-[12px] text-text focus:outline-none focus:border-accent/50 transition-colors appearance-none cursor-pointer"
                      >
                        {(t?.models || []).map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (!newConfig.name.trim() || !newConfig.apiKey.trim()) return;
                      const np: NamedProvider = {
                        id: `named-${Date.now()}`,
                        name: newConfig.name,
                        configId: newConfig.configId,
                        apiKey: newConfig.saveKey ? newConfig.apiKey : undefined,
                        baseUrl: t?.defaultUrl,
                        defaultModel: newConfig.defaultModel || t?.models[0],
                        enabled: true,
                      };
                      const next = namedProviders.filter(p => p.id !== np.id).map(p => ({ ...p, enabled: false }));
                      next.push(np);
                      setNamedProviders(next);
                      saveNamedProviders(next);
                      enableNamedProvider(np);
                      setNewConfig({ configId: 'openai', name: '', apiKey: '', baseUrl: '', defaultModel: '', saveKey: true });
                      setConnectStep(0);
                    }}
                    disabled={!newConfig.name.trim() || !newConfig.apiKey.trim()}
                    className="w-full py-2.5 bg-accent text-bg text-[12px] font-bold rounded-xl hover:opacity-90 disabled:opacity-20 transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent/10"
                  >
                    <Save size={13} /> Connect & Save
                  </button>
                </>
              );
            })()}          
          </motion.div>
        )}

        {/* Saved APIs section */}
        {namedProviders.length > 0 && (
          <div className="p-4 border-t border-border">
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2.5">Your Saved APIs</p>
            <div className="space-y-2">
              {namedProviders.map(np => {
                const meta = PROVIDER_META[np.configId];
                const pt = PROVIDER_TYPES.find(t => t.id === np.configId);
                const Icon = meta?.icon || Server;
                const isActive = np.enabled;
                return (
                  <div
                    key={np.id}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                      isActive ? 'border-accent/25 bg-accent-bg/20' : 'border-border bg-bg-surface'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: meta?.bg }}>
                      <Icon size={15} style={{ color: meta?.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-text truncate">{np.name}</p>
                      <p className="text-[9px] text-text-dim font-mono">{maskKey(np.apiKey)} · {np.defaultModel || pt?.models[0]}</p>
                    </div>
                    <button
                      onClick={() => enableNamedProvider(np)}
                      className={`shrink-0 px-2.5 py-1 text-[9px] font-bold rounded-lg transition-all ${
                        isActive ? 'bg-accent text-bg' : 'bg-bg-hover text-text-secondary hover:text-text'
                      }`}
                    >
                      {isActive ? 'Active' : 'Use'}
                    </button>
                    <button onClick={() => deleteNamedProvider(np.id)} className="shrink-0 p-1.5 text-text-dim hover:text-danger rounded-lg hover:bg-danger-bg transition-colors">
                      <Trash2 size={11} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ─── PROVIDERS LIST ───
  const providersView = (
    <div className="flex flex-col h-full bg-bg-panel">
      <div className="shrink-0 border-b border-border bg-bg-panel">
        <div className="flex items-center gap-2.5 px-4 py-3">
          <div className="w-7 h-7 rounded-lg bg-accent-bg flex items-center justify-center">
            <Shield size={14} className="text-accent" />
          </div>
          <div className="flex-1">
            <h3 className="text-[12px] font-bold text-text">Your APIs</h3>
            <p className="text-[10px] text-text-dim">Manage saved connections</p>
          </div>
          <button onClick={() => setView('messages')} className="p-1.5 text-text-dim hover:text-text hover:bg-bg-hover rounded-lg transition-colors"><X size={13} /></button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {namedProviders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-text-dim">
            <Plug size={24} className="opacity-30" />
            <p className="text-[11px]">No saved APIs yet</p>
            <button onClick={() => { setView('connect'); setConnectStep(0); }} className="text-[11px] text-accent hover:underline">Add your first provider</button>
          </div>
        )}
        {namedProviders.map(np => {
          const meta = PROVIDER_META[np.configId];
          const pt = PROVIDER_TYPES.find(t => t.id === np.configId);
          const Icon = meta?.icon || Server;
          return (
            <div key={np.id} className={`p-3 rounded-xl border transition-all ${np.enabled ? 'border-accent/25 bg-accent-bg/15' : 'border-border bg-bg-surface'}`}>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: meta?.bg }}>
                  <Icon size={14} style={{ color: meta?.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-text">{np.name}</p>
                  <p className="text-[9px] text-text-dim">{pt?.name}</p>
                </div>
                {np.enabled && <span className="px-1.5 py-0.5 rounded-md bg-accent text-bg text-[9px] font-bold">Active</span>}
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-text-dim font-mono">{maskKey(np.apiKey)}</p>
                <div className="flex gap-1.5">
                  {!np.enabled && (
                    <button onClick={() => enableNamedProvider(np)} className="text-[10px] px-2 py-1 rounded-lg bg-bg-hover text-text-secondary hover:text-text font-semibold transition-colors">
                      Activate
                    </button>
                  )}
                  <button onClick={() => deleteNamedProvider(np.id)} className="text-[10px] px-2 py-1 rounded-lg hover:bg-danger-bg text-text-dim hover:text-danger transition-colors">
                    Remove
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ─── MODELS VIEW ───
  const modelsView = (
    <div className="flex flex-col h-full bg-bg-panel">
      <div className="shrink-0 border-b border-border bg-bg-panel">
        <div className="flex items-center gap-2.5 px-4 py-3">
          <div className="w-7 h-7 rounded-lg bg-accent-bg flex items-center justify-center">
            <Cpu size={14} className="text-accent" />
          </div>
          <div className="flex-1">
            <h3 className="text-[12px] font-bold text-text">Models</h3>
            <p className="text-[10px] text-text-dim">Select which model to use</p>
          </div>
          <button onClick={() => setView('messages')} className="p-1.5 text-text-dim hover:text-text hover:bg-bg-hover rounded-lg transition-colors"><X size={13} /></button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {namedProviders.filter(p => p.enabled).map(np => {
          const meta = PROVIDER_META[np.configId];
          const pt = PROVIDER_TYPES.find(t => t.id === np.configId);
          const Icon = meta?.icon || Server;
          const ms = models[np.configId] || pt?.models || [];
          return (
            <div key={np.id} className="border border-border rounded-xl p-3.5 bg-bg-surface">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: meta?.bg }}>
                  <Icon size={13} style={{ color: meta?.color }} />
                </div>
                <p className="text-[11px] font-bold text-text">{np.name} <span className="text-text-dim font-normal">· {pt?.name}</span></p>
                <button onClick={() => fetchModels(np.configId)} className="ml-auto text-[9px] text-accent hover:underline">Refresh</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ms.map(m => (
                  <button
                    key={m}
                    onClick={() => setNamedProviders(prev => prev.map(p => p.id === np.id ? { ...p, defaultModel: m } : p))}
                    className={`px-2.5 py-1 text-[10px] rounded-lg border transition-all font-medium ${
                      np.defaultModel === m
                        ? 'bg-accent text-bg border-accent shadow-sm shadow-accent/10'
                        : 'text-text-secondary hover:bg-bg-hover border-border'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {namedProviders.filter(p => p.enabled).length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-text-dim opacity-60">
            <Cpu size={24} />
            <p className="text-[11px]">Activate a provider to see available models</p>
            <button onClick={() => { setView('connect'); setConnectStep(0); }} className="text-[11px] text-accent hover:underline">Connect a provider</button>
          </div>
        )}
      </div>
    </div>
  );

  // ─── SESSIONS VIEW ───
  const sessionsView = (
    <div className="flex flex-col h-full bg-bg-panel">
      <div className="shrink-0 border-b border-border bg-bg-panel">
        <div className="flex items-center gap-2.5 px-4 py-3">
          <div className="w-7 h-7 rounded-lg bg-accent-bg flex items-center justify-center">
            <Clock size={14} className="text-accent" />
          </div>
          <div className="flex-1">
            <h3 className="text-[12px] font-bold text-text">Sessions</h3>
            <p className="text-[10px] text-text-dim">Your chat history</p>
          </div>
          <button onClick={() => setView('messages')} className="p-1.5 text-text-dim hover:text-text hover:bg-bg-hover rounded-lg transition-colors"><X size={13} /></button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {sessions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-text-dim opacity-60">
            <MessageSquare size={24} />
            <p className="text-[11px]">No sessions yet. Start a chat.</p>
          </div>
        )}
        {sessions.map((s: any) => (
          <button key={s.id} className="w-full text-left p-3 rounded-xl hover:bg-bg-surface border border-transparent hover:border-border transition-all group">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
              <span className="text-[11px] font-semibold text-text truncate flex-1">{s.name || 'Untitled'}</span>
              <span className="text-[9px] text-text-dim">{new Date(s.updatedAt).toLocaleDateString()}</span>
            </div>
            <div className="text-[10px] text-text-dim mt-0.5 pl-3.5">{s.providerId} · {s.messages?.length || 0} messages</div>
          </button>
        ))}
      </div>
    </div>
  );

  // ─── HEADER ───
  const vLabel = `v${version.toFixed(2)}`;

  return (
    <div className="flex flex-col h-full bg-bg text-text">
      {/* Top toolbar */}
      <div className="shrink-0 flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-bg-panel">
        <ToolbarButton
          icon={Bot}
          label="Chat"
          active={view === 'messages'}
          onClick={() => setView('messages')}
        />
        <ToolbarButton
          icon={Plug}
          label="Connect"
          active={view === 'connect'}
          onClick={() => { setView('connect'); setConnectStep(0); }}
          accent={!activeProvider}
        />
        <ToolbarButton
          icon={Shield}
          label="APIs"
          active={view === 'providers'}
          onClick={() => setView('providers')}
        />
        <ToolbarButton
          icon={Cpu}
          label="Models"
          active={view === 'models'}
          onClick={() => setView('models')}
        />
        <ToolbarButton
          icon={Clock}
          label="History"
          active={view === 'sessions'}
          onClick={() => setView('sessions')}
        />
        <div className="ml-auto flex items-center gap-2 pr-1">
          {activeProvider && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1.5 text-[9px] px-2 py-0.5 rounded-full bg-accent-bg border border-accent/20 text-accent font-medium"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              {activeProvider.name}
            </motion.div>
          )}
          <span className="text-[9px] text-text-dim/50 font-mono">{vLabel}</span>
        </div>
      </div>

      {/* Content area */}
      <AnimatePresence mode="wait">
        {view === 'messages' && (
          <motion.div key="messages" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="flex-1 flex flex-col min-h-0">
            {messageArea}
          </motion.div>
        )}
        {view === 'connect' && (
          <motion.div key="connect" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }} className="flex-1 min-h-0 overflow-hidden">
            {connectPanel}
          </motion.div>
        )}
        {view === 'providers' && (
          <motion.div key="providers" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }} className="flex-1 min-h-0 overflow-hidden">
            {providersView}
          </motion.div>
        )}
        {view === 'models' && (
          <motion.div key="models" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }} className="flex-1 min-h-0 overflow-hidden">
            {modelsView}
          </motion.div>
        )}
        {view === 'sessions' && (
          <motion.div key="sessions" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }} className="flex-1 min-h-0 overflow-hidden">
            {sessionsView}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Sub-components ───

function ToolbarButton({ icon: Icon, label, active, onClick, accent }: { icon: any; label: string; active: boolean; onClick: () => void; accent?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition-all duration-150 shrink-0 ${
        active
          ? 'bg-accent text-bg shadow-sm shadow-accent/10'
          : accent
            ? 'text-danger bg-danger-bg border border-danger/20 hover:bg-danger-bg/60'
            : 'text-text-secondary hover:text-text hover:bg-bg-hover'
      }`}
      title={label}
    >
      <Icon size={13} />
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}

function MessageContent({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => {
        const bolded = line.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>');
        const coded = bolded.replace(/`(.+?)`/g, '<code class="px-1 py-0.5 rounded-md bg-bg-hover text-accent text-[11px] font-mono">$1</code>');
        if (line.trim().startsWith('•')) {
          return <div key={i} className="pl-2.5 text-[11px] opacity-80" dangerouslySetInnerHTML={{ __html: coded }} />;
        }
        return <div key={i} className="text-[12px] leading-relaxed" dangerouslySetInnerHTML={{ __html: coded }} />;
      })}
    </div>
  );
}
