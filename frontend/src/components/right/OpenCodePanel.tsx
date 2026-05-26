import { useEffect, useRef, useState, useCallback } from 'react';
import { opencodeApi } from '../../services/api';
import { useStore } from '../../stores/appStore';
import {
  Diamond, Send, Play, Square, Loader2, Settings2, ChevronDown,
  Compass, Clock, RotateCcw, Terminal, Trash2, Copy,
  X, Wrench, Check, Keyboard, Cpu, AlertCircle, Sparkles, History,
  MessageSquare
} from 'lucide-react';

/* ═══════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════ */
interface OCEvent {
  type: 'text' | 'tool_use' | 'tool_result' | 'step_start' | 'step_finish' | 'error' | 'system';
  text?: string;
  tool?: string;
  callID?: string;
  state?: 'completed' | 'failed' | 'cancelled';
  input?: any;
  output?: string;
  error?: string;
  tokens?: { input: number; output: number; total: number };
  cost?: number;
  id?: string;
  reason?: string;
}

interface OCSession {
  id: string;
  title: string;
  updated: number;
  created: number;
}

interface OCModel {
  id: string;
  name: string;
  label: string;
}

interface OCAgent {
  name: string;
  primary: boolean;
}

interface OCMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  events: OCEvent[];
  timestamp: string;
}

/* ═══════════════════════════════════════════════════
   THEME-AWARE COLOR HELPERS
   ═══════════════════════════════════════════════════ */
const EVENT_COLORS: Record<string, string> = {
  text: 'text-text',
  tool_use: 'text-info',
  tool_result: 'text-success',
  step_start: 'text-text-dim',
  step_finish: 'text-text-muted',
  error: 'text-danger',
  system: 'text-warning',
};

const EVENT_BG: Record<string, string> = {
  text: '',
  tool_use: 'bg-info-bg/30',
  tool_result: 'bg-success-bg/30',
  step_start: 'bg-bg-hover/50',
  step_finish: 'bg-bg-hover/30',
  error: 'bg-danger-bg/30',
  system: 'bg-warning-bg/20',
};

const EVENT_ICONS: Record<string, any> = {
  text: MessageSquare,
  tool_use: Wrench,
  tool_result: Check,
  step_start: Play,
  step_finish: Square,
  error: AlertCircle,
  system: Sparkles,
};

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/* ═══════════════════════════════════════════════════
   EVENT RENDERER
   ═══════════════════════════════════════════════════ */
function EventRow({ ev, compact = true }: { ev: OCEvent; compact?: boolean }) {
  const Icon = EVENT_ICONS[ev.type] || Terminal;
  const color = EVENT_COLORS[ev.type] || 'text-text-dim';
  const bg = EVENT_BG[ev.type] || '';

  if (compact) {
    switch (ev.type) {
      case 'text':
        return <span className="text-text text-[11px] leading-relaxed whitespace-pre-wrap">{ev.text}</span>;
      case 'tool_use':
        return (
          <div className="flex items-center gap-1.5 text-info text-[10px]">
            <Wrench size={10} />
            <span className="font-mono">{ev.tool}</span>
            <span className="text-text-dim/50">→</span>
            <span className={ev.state === 'completed' ? 'text-success' : 'text-warning'}>{ev.state}</span>
          </div>
        );
      case 'tool_result':
        return (
          <div className="flex items-start gap-1.5 text-success text-[10px]">
            <Check size={10} className="mt-0.5 shrink-0" />
            <span className="font-mono opacity-80">{ev.tool}</span>
          </div>
        );
      case 'step_start':
        return <div className="text-text-dim text-[9px] font-mono opacity-50 flex items-center gap-1"><Play size={8} /> step</div>;
      case 'step_finish':
        return (
          <div className="text-text-muted text-[9px] font-mono opacity-40 flex items-center gap-1">
            <Square size={8} />
            {ev.reason}
          </div>
        );
      case 'error':
        return <span className="text-danger text-[10px]">{ev.error}</span>;
      default:
        return <span className="text-text-dim text-[10px]">{ev.text}</span>;
    }
  }

  // Expanded view
  return (
    <div className={`flex gap-2 px-2 py-1.5 rounded-lg ${bg} border border-border/40`}>
      <div className={`shrink-0 mt-0.5 ${color}`}><Icon size={12} /></div>
      <div className="flex-1 min-w-0">
        {ev.type === 'text' && <p className="text-[11px] text-text leading-relaxed whitespace-pre-wrap">{ev.text}</p>}
        {ev.type === 'tool_use' && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="font-mono text-info">{ev.tool}</span>
              <span className="text-text-dim">{ev.callID}</span>
              <span className={`ml-auto px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                ev.state === 'completed' ? 'bg-success-bg text-success' : 'bg-warning-bg text-warning'
              }`}>{ev.state}</span>
            </div>
            {ev.input && <pre className="text-[9px] text-text-dim bg-bg-panel rounded p-1.5 overflow-x-auto">{JSON.stringify(ev.input, null, 1)}</pre>}
          </div>
        )}
        {ev.type === 'tool_result' && (
          <div className="space-y-0.5">
            <span className="text-[10px] text-success font-mono">{ev.tool}</span>
            {ev.output && <pre className="text-[9px] text-text-dim bg-bg-panel rounded p-1.5 overflow-x-auto">{ev.output}</pre>}
          </div>
        )}
        {ev.type === 'error' && <p className="text-[10px] text-danger">{ev.error}</p>}
        {ev.type === 'step_start' && <p className="text-[10px] text-text-dim">Step started</p>}
        {ev.type === 'step_finish' && (
          <div className="text-[9px] text-text-muted space-y-0.5">
            <p>Step finished · {ev.reason}</p>
            {ev.tokens && <p className="font-mono">tokens: {ev.tokens.input} → {ev.tokens.output} | cost: ${ev.cost?.toFixed(6) || 0}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   DROPDOWN COMPONENT
   ═══════════════════════════════════════════════════ */
function SelectMenu({ label, value, options, onChange, disabled = false, icon: Icon }: {
  label: string; value: string; options: { value: string; label: string }[];
  onChange: (v: string) => void; disabled?: boolean; icon?: any;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold text-text-secondary hover:text-text rounded-lg hover:bg-bg-hover transition-all border border-border/40 disabled:opacity-30"
      >
        {Icon && <Icon size={11} className="text-text-dim" />}
        <span className="max-w-[96px] truncate">{value || label}</span>
        <ChevronDown size={10} className={`text-text-dim transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-bg-surface border border-border rounded-xl shadow-xl z-50 py-1 min-w-[160px] max-h-56 overflow-y-auto">
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-[10px] transition-colors ${
                opt.value === value ? 'bg-accent-bg/40 text-accent font-semibold' : 'text-text-secondary hover:bg-bg-hover'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════ */
export default function OpenCodePanel() {
  const projectRoot = useStore(s => s.projectRoot);

  const [messages, setMessages] = useState<OCMessage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [running, setRunning] = useState(false);
  const [expandedEvents, setExpandedEvents] = useState(false);

  const [models, setModels] = useState<OCModel[]>([]);
  const [agents, setAgents] = useState<OCAgent[]>([]);
  const [sessions, setSessions] = useState<OCSession[]>([]);

  const [selectedModel, setSelectedModel] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [selectedSession, setSelectedSession] = useState('');

  const [showSettings, setShowSettings] = useState(false);
  const [showSessionList, setShowSessionList] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<(() => void) | null>(null);

  /* Fetch metadata */
  useEffect(() => {
    opencodeApi.models().then(r => {
      const m = r.models.map(id => {
        const parts = id.split('/');
        const name = parts[parts.length - 1] || id;
        return { id, name, label: name };
      });
      setModels(m);
      if (m.length && !selectedModel) setSelectedModel(m[0].id);
    }).catch(() => {});

    opencodeApi.agents().then(r => {
      const a = r.agents.map(ag => ({ name: ag.name, primary: ag.primary }));
      setAgents(a);
      const primary = a.find(x => x.primary);
      if (primary) setSelectedAgent(primary.name);
    }).catch(() => {});

    loadSessions();
  }, []);

  const loadSessions = useCallback(() => {
    opencodeApi.sessions().then(r => {
      const sorted = (r.sessions || []).sort((a: any, b: any) => (b.updated || 0) - (a.updated || 0));
      setSessions(sorted);
    }).catch(() => {});
  }, []);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const parseLine = (line: string): OCEvent | null => {
    try {
      const obj = JSON.parse(line);
      if (obj.type === 'text' && obj.part?.text) {
        return { type: 'text', text: obj.part.text };
      }
      if (obj.type === 'tool_use' && obj.part?.tool) {
        return { type: 'tool_use', tool: obj.part.tool, callID: obj.part.callID, state: obj.part.state?.status, input: obj.part.state?.input };
      }
      if (obj.type === 'tool_result' && obj.part?.tool) {
        return { type: 'tool_result', tool: obj.part.tool, callID: obj.part.callID, state: obj.part.state?.status, output: obj.part.state?.output };
      }
      if (obj.type === 'step_start') {
        return { type: 'step_start' };
      }
      if (obj.type === 'step_finish') {
        return { type: 'step_finish', reason: obj.part?.reason, tokens: obj.part?.tokens, cost: obj.part?.cost };
      }
    } catch { /* ignore */ }
    return null;
  };

  const handleRun = async () => {
    if (!prompt.trim() || running) return;
    const text = prompt.trim();
    setPrompt('');

    // Add user message
    const userMsg: OCMessage = {
      role: 'user',
      content: text,
      events: [{ type: 'system', text }],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    setMessages(prev => [...prev, userMsg]);
    setRunning(true);

    const assistantMsg: OCMessage = {
      role: 'assistant',
      content: '',
      events: [],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    setMessages(prev => [...prev, assistantMsg]);

    try {
      const res = await opencodeApi.run({
        prompt: text,
        model: selectedModel,
        agent: selectedAgent,
        session: selectedSession || undefined,
        dir: projectRoot || undefined,
        continueSession: !!selectedSession,
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      const readChunk = async () => {
        const { done, value } = await reader.read();
        if (done) return;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // keep partial line

        for (const line of lines) {
          if (!line.trim()) continue;
          const parsed = parseLine(line);
          if (parsed) {
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?.role === 'assistant') {
                const updated = [...prev];
                const ai = { ...last, events: [...last.events, parsed] };
                if (parsed.type === 'text' && parsed.text) {
                  ai.content = (ai.content || '') + parsed.text;
                }
                updated[updated.length - 1] = ai;
                return updated;
              }
              return prev;
            });
          }
        }
        await readChunk();
      };

      abortRef.current = () => { reader.cancel(); };
      await readChunk();
    } catch (err: any) {
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...last,
            events: [...last.events, { type: 'error', error: err.message || 'Request failed' }],
          };
          return updated;
        }
        return [...prev, { role: 'assistant', content: '', events: [{ type: 'error', error: err.message }], timestamp: '' }];
      });
    } finally {
      setRunning(false);
      abortRef.current = null;
      loadSessions(); // refresh session list after run
    }
  };

  const handleAbort = () => {
    if (abortRef.current) {
      abortRef.current();
      abortRef.current = null;
      setRunning(false);
    }
  };

  const handleClear = () => {
    setMessages([]);
    setPrompt('');
  };

  const handleCopy = () => {
    const text = messages.map(m => {
      if (m.role === 'user') return `> ${m.content}`;
      return m.events.filter(e => e.type === 'text').map(e => e.text).join('');
    }).join('\n\n');
    navigator.clipboard.writeText(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleRun();
    }
    if (e.key === 'Escape') {
      setShowSettings(false);
      setShowSessionList(false);
      if (running) handleAbort();
    }
  };

  const modelOptions = models.map(m => ({ value: m.id, label: m.label })).concat([
    { value: '', label: 'Default model' }
  ]);

  const agentOptions = agents.map(a => ({ value: a.name, label: a.name + (a.primary ? ' (primary)' : '') })).concat([
    { value: '', label: 'Default agent' }
  ]);

  const sessionOptions = sessions.slice(0, 20).map(s => ({
    value: s.id,
    label: s.title.length > 28 ? s.title.slice(0, 28) + '…' : s.title,
  })).concat([{ value: '', label: 'New session' }]);

  /* ═══════════════════════════════════════════════════
     HEADER
     ═══════════════════════════════════════════════════ */
  const Header = (
    <div className="shrink-0 h-9 flex items-center px-3 border-b border-border bg-bg-panel select-none gap-2">
      <div className="flex items-center gap-1.5 shrink-0">
        <Diamond size={13} className="text-accent" />
        <span className="text-[11px] font-bold text-text">OpenCode</span>
        <span className="text-[9px] text-text-muted font-mono">v1.15</span>
      </div>

      <div className="w-px h-4 bg-border mx-1" />

      <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden">
        <SelectMenu label="Model" value={selectedModel} options={modelOptions} onChange={setSelectedModel} icon={Cpu} />
        <SelectMenu label="Agent" value={selectedAgent} options={agentOptions} onChange={setSelectedAgent} icon={Compass} />
        <SelectMenu label="Session" value={selectedSession} options={sessionOptions} onChange={setSelectedSession} icon={History} />
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        <button
          onClick={() => setShowSessionList(s => !s)}
          className="p-1.5 text-text-muted hover:text-text hover:bg-bg-hover rounded-lg transition-colors"
          title="Sessions"
        >
          <Clock size={12} />
        </button>
        <button
          onClick={() => setShowSettings(s => !s)}
          className="p-1.5 text-text-muted hover:text-text hover:bg-bg-hover rounded-lg transition-colors"
          title="Settings"
        >
          <Settings2 size={12} />
        </button>
        <button onClick={handleCopy} className="p-1.5 text-text-muted hover:text-text hover:bg-bg-hover rounded-lg transition-colors" title="Copy transcript">
          <Copy size={12} />
        </button>
        <button onClick={handleClear} className="p-1.5 text-text-muted hover:text-danger hover:bg-danger-bg rounded-lg transition-colors" title="Clear">
          <Trash2 size={12} />
        </button>
        {running ? (
          <button onClick={handleAbort} className="p-1.5 text-danger hover:bg-danger-bg rounded-lg transition-colors" title="Stop">
            <Square size={12} fill="currentColor" />
          </button>
        ) : (
          <button onClick={handleRun} className="p-1.5 text-accent hover:bg-accent-bg rounded-lg transition-colors" title="Send (Enter)">
            <Play size={12} fill="currentColor" />
          </button>
        )}
      </div>
    </div>
  );

  /* ═══════════════════════════════════════════════════
     SESSION LIST DRAWER
     ═══════════════════════════════════════════════════ */
  const SessionListDrawer = showSessionList && (
    <div className="shrink-0 border-b border-border bg-bg-panel/80 overflow-y-auto max-h-48">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
        <span className="text-[10px] font-bold text-text-muted">Sessions</span>
        <div className="flex items-center gap-1">
          <button onClick={loadSessions} className="p-1 text-text-dim hover:text-text rounded"><RotateCcw size={10} /></button>
          <button onClick={() => setShowSessionList(false)} className="p-1 text-text-dim hover:text-text rounded"><X size={10} /></button>
        </div>
      </div>
      {sessions.length === 0 && <div className="px-3 py-3 text-[10px] text-text-dim">No sessions found.</div>}
      {sessions.map(s => (
        <button
          key={s.id}
          onClick={() => { setSelectedSession(s.id); setShowSessionList(false); }}
          className={`w-full text-left px-3 py-1.5 text-[10px] transition-colors flex items-center gap-2 ${
            selectedSession === s.id ? 'bg-accent-bg/20 text-accent' : 'text-text-secondary hover:bg-bg-hover'
          }`}
        >
          <History size={10} className="shrink-0" />
          <span className="truncate flex-1">{s.title}</span>
          <span className="text-text-dim font-mono opacity-50">{formatTime(s.updated)}</span>
        </button>
      ))}
    </div>
  );

  /* ═══════════════════════════════════════════════════
     SETTINGS PANEL
     ═══════════════════════════════════════════════════ */
  const SettingsPanel = showSettings && (
    <div className="shrink-0 border-b border-border bg-bg-panel/80 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-text-muted">Output</span>
        <button onClick={() => setShowSettings(false)} className="p-1 text-text-dim hover:text-text rounded"><X size={10} /></button>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-[10px] text-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={expandedEvents}
            onChange={e => setExpandedEvents(e.target.checked)}
            className="accent-accent w-3 h-3"
          />
          Expanded event view
        </label>
        <label className="flex items-center gap-1.5 text-[10px] text-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={!!selectedSession}
            onChange={e => setSelectedSession(e.target.checked ? (sessions[0]?.id || '') : '')}
            className="accent-accent w-3 h-3"
          />
          Continue last session
        </label>
      </div>
      <div className="text-[9px] text-text-dim font-mono">
        Working dir: {projectRoot || '—'}
      </div>
    </div>
  );

  /* ═══════════════════════════════════════════════════
     CONVERSATION STREAM
     ═══════════════════════════════════════════════════ */
  const Conversation = (
    <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-3">
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-text-muted select-none">
          <div className="w-12 h-12 rounded-2xl bg-accent-bg flex items-center justify-center">
            <Diamond size={24} className="text-accent/40" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-text-secondary font-semibold text-[13px]">OpenCode CLI</p>
            <p className="text-[11px] opacity-60">Run with <kbd className="px-1.5 py-0.5 rounded bg-bg-hover text-text-secondary text-[10px] font-mono">Enter</kbd></p>
            <p className="text-[10px] text-text-dim/50">Model: {selectedModel || 'default'}  ·  Agent: {selectedAgent || 'default'}</p>
          </div>
        </div>
      )}

      {messages.map((msg, idx) => {
        const isUser = msg.role === 'user';
        return (
          <div key={idx} className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
            <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
              isUser ? 'bg-accent text-bg' : 'bg-bg-surface border border-border'
            }`}>
              {isUser ? <Keyboard size={11} /> : <Diamond size={11} className="text-accent" />}
            </div>
            <div className={`flex flex-col gap-0.5 max-w-[88%] ${isUser ? 'items-end' : 'items-start'}`}>
              {isUser ? (
                <div className="bg-accent text-bg rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-[12px] leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </div>
              ) : (
                <div className="w-full space-y-1">
                  {msg.events.length === 0 && running && (
                    <div className="flex items-center gap-1.5 px-2 py-1">
                      <Loader2 size={12} className="text-accent animate-spin" />
                      <span className="text-[10px] text-text-dim">Running…</span>
                    </div>
                  )}
                  {msg.events.map((ev, evIdx) => (
                    <div key={evIdx} className={expandedEvents ? '' : ''}>
                      <EventRow ev={ev} compact={!expandedEvents} />
                    </div>
                  ))}
                </div>
              )}
              <span className="text-[9px] text-text-dim/50 px-1 font-mono">{msg.timestamp}</span>
            </div>
          </div>
        );
      })}

      {running && messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' && messages[messages.length - 1]?.events.length === 0 && (
        <div className="flex items-center gap-2 pl-9">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-surface border border-border rounded-full">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1 h-1 rounded-full bg-accent animate-bounce"
                style={{ animationDelay: `${120 * i}ms` }}
              />
            ))}
          </div>
        </div>
      )}
      <div ref={scrollRef} />
    </div>
  );

  /* ═══════════════════════════════════════════════════
     INPUT BAR
     ═══════════════════════════════════════════════════ */
  const InputBar = (
    <div className="shrink-0 border-t border-border bg-bg-panel/80 backdrop-blur-sm p-2.5">
      <div className="flex gap-2 items-end bg-bg-surface border border-border/80 rounded-2xl px-3 py-2.5 focus-within:border-accent/60 focus-within:shadow-[0_0_0_3px_rgba(168,85,247,0.08)] transition-all">
        <div className="shrink-0 pt-2">
          {running ? (
            <button onClick={handleAbort} className="text-danger hover:bg-danger-bg rounded-md p-0.5 transition-colors">
              <Square size={13} fill="currentColor" />
            </button>
          ) : (
            <Terminal size={13} className="text-text-dim/40" />
          )}
        </div>
        <textarea
          ref={inputRef}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask OpenCode to build, refactor, or debug…"
          className="flex-1 bg-transparent text-[12px] text-text placeholder:text-text-dim/70 focus:outline-none leading-relaxed py-0.5 resize-none max-h-32 min-h-[20px]"
          spellCheck={false}
          autoComplete="off"
          rows={1}
          style={{ height: 'auto' }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = target.scrollHeight + 'px';
          }}
        />
        <button
          onClick={handleRun}
          disabled={running || !prompt.trim()}
          className="p-2 bg-accent text-bg rounded-xl hover:opacity-90 disabled:opacity-15 transition-all shrink-0"
        >
          {running ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
        </button>
      </div>
      <div className="flex items-center justify-between mt-1.5 px-1">
        <div className="flex items-center gap-2 text-[9px] text-text-muted">
          <span className="flex items-center gap-1"><Cpu size={8} />{selectedModel || 'default'}</span>
          <span className="text-text-dim">·</span>
          <span className="flex items-center gap-1"><Compass size={8} />{selectedAgent || 'default'}</span>
          {selectedSession && (
            <>
              <span className="text-text-dim">·</span>
              <span className="flex items-center gap-1 text-accent"><History size={8} />continuing</span>
            </>
          )}
        </div>
        <span className="text-[9px] text-text-dim/40">{prompt.length}</span>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-bg text-text relative">
      {Header}
      {SessionListDrawer}
      {SettingsPanel}
      {Conversation}
      {InputBar}
    </div>
  );
}
