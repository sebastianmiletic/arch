import { useEffect, useRef, useState, useCallback } from 'react';
import { opencodeApi } from '../../services/api';
import { useStore } from '../../stores/appStore';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Diamond, Send, Plus, ChevronDown, Pencil, Trash2, X, Check,
  Loader2, Flame, Hexagon, Zap, Search, Bug, BookOpen, HelpCircle,
  FileImage, Terminal, Globe, Cpu, Minimize, Plug,
  Briefcase, Command, Settings, FileCode, HardDrive, ArrowUpRight, Square
} from 'lucide-react';

/* ─── Types ─── */
interface OCMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'error' | 'tool';
  content: string;
  events: OCEvent[];
  timestamp: string;
}

interface OCEvent {
  type: 'text' | 'thinking' | 'tool_use' | 'tool_result' | 'step_start' | 'step_finish' | 'error' | 'file_change';
  text?: string;
  tool?: string;
  callID?: string;
  state?: string;
  output?: string;
  error?: string;
  filePath?: string;
  changeType?: string;
}

interface OCSession {
  id: string;
  name: string;
  messages: OCMessage[];
  providerId: string;
  model: string;
  createdAt: string;
  updatedAt: string;
}

/* ─── Helpers ─── */
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function getNow() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

function loadSessions(): OCSession[] {
  try { return JSON.parse(localStorage.getItem('arch_opencode_sessions') || '[]'); }
  catch { return []; }
}
function saveSessions(list: OCSession[]) {
  localStorage.setItem('arch_opencode_sessions', JSON.stringify(list));
}

const AGENTS: Record<string, { icon: any; color: string; desc: string }> = {
  build:   { icon: Flame,    color: '#10a37f', desc: 'Build — executes tools' },
  plan:    { icon: Hexagon,  color: '#4285f4', desc: 'Plan — read-only analysis' },
  general: { icon: Zap,      color: '#ef4444', desc: 'General — multi-step tasks' },
  explore: { icon: Search,   color: '#8b5cf6', desc: 'Explore — codebase search' },
};

/* ─── Slash Commands ─── */
interface SlashCmd { name: string; desc: string; icon: any; action: string; }
const SLASH_COMMANDS: SlashCmd[] = [
  { name: 'clear',   desc: 'Clear this conversation',              icon: Trash2,      action: 'clear' },
  { name: 'compact', desc: 'Summarize and shorten conversation',   icon: Minimize,    action: 'compact' },
  { name: 'connect', desc: 'Switch model or agent',              icon: Plug,        action: 'connect' },
  { name: 'cost',    desc: 'Show estimated cost',                icon: Briefcase,    action: 'cost' },
  { name: 'debug',   desc: 'Show recent tool calls',             icon: Bug,         action: 'debug' },
  { name: 'doc',     desc: 'Load docs (/doc react-router)',     icon: BookOpen,    action: 'doc' },
  { name: 'help',    desc: 'Show all commands',                  icon: HelpCircle,    action: 'help' },
  { name: 'image',   desc: 'Attach an image',                   icon: FileImage,    action: 'image' },
  { name: 'ls',      desc: 'List project files',                 icon: Terminal,     action: 'ls' },
  { name: 'model',   desc: 'Switch the AI model',                icon: Cpu,          action: 'models' },
  { name: 'search',  desc: 'Search the web',                    icon: Globe,        action: 'search' },
  { name: 'settings',desc: 'Open Settings panel',               icon: Settings,     action: 'settings' },
  { name: 'web',     desc: 'Fetch a URL as context',            icon: Globe,        action: 'web' },
];

/* ════════════════════════════════════════════════
   CASCADING STEP ARC
   Vertical list where items are arranged along a
   semi-circular arc.  Active item sits dead-center,
   past items arc left/up and fade out, future items
   arc right/down and dim in.  As the assistant
   streams events the list scrolls upward - like a
   slot-machine - so the newest task always lands in
   the focus ring in the middle.
   ════════════════════════════════════════════════ */

interface StepItem {
  type     : string;
  label    : string;
  color    : string;
  icon     : any;
  key      : string;
}

function useStepItems(events: OCEvent[]): StepItem[] {
  const cfg: Record<string, { label: string; color: string; icon: any }> = {
    thinking    : { label: 'Thinking',    color: '#a855f7', icon: Loader2 },
    tool_use    : { label: 'Using tool',  color: '#3b82f6', icon: HardDrive },
    tool_result : { label: 'Tool done',   color: '#10a37f', icon: Check },
    file_change : { label: 'Editing',     color: '#f59e0b', icon: FileCode },
    step_start  : { label: 'Step',        color: '#6366f1', icon: ArrowUpRight },
    step_finish : { label: 'Done',        color: '#10a37f', icon: Check },
    text        : { label: 'Writing',     color: '#a855f7', icon: Command },
    error       : { label: 'Error',       color: '#ef4444', icon: Zap },
  };

  return events.map((ev, i) => {
    const c = cfg[ev.type] || cfg.thinking;
    const label =
      ev.type === 'tool_use' ? `Using ${ev.tool || 'tool'}`
      : ev.type === 'file_change' ? `Editing ${ev.filePath?.split('/').pop() || 'file'}`
      : c.label;
    return { type: ev.type, label, color: c.color, icon: c.icon, key: `${i}-${ev.type}` };
  });
}

const CENTER_IDX = 3;
const VISIBLE    = 7;
const ROW_H      = 26;
const MID_Y      = CENTER_IDX * ROW_H;
const ARC_RADIUS = 90;

function StepArc({ items }: { items: StepItem[] }) {
  const scrollOffset = Math.max(0, items.length - CENTER_IDX - 1);
  const visibleItems = items.slice(
    Math.max(0, scrollOffset - CENTER_IDX),
    Math.min(items.length, scrollOffset + CENTER_IDX + 1)
  );

  return (
    <div className="relative flex justify-center" style={{ height: VISIBLE * ROW_H + 24, overflow: 'hidden' }}>
      <div className="absolute rounded-[20px] pointer-events-none"
           style={{ width: 160, height: ROW_H + 10, top: MID_Y - 5, border: '1.5px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', boxShadow: '0 0 18px rgba(168,85,247,0.06)' }} />
      <div className="absolute w-px bg-border/40" style={{ height: VISIBLE * ROW_H, top: 0 }} />
      <motion.div className="relative" style={{ width: 260 }}
        animate={{ y: -scrollOffset * ROW_H }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      >
        {items.map((it, idx) => {
          const Icon  = it.icon;
          const isCur = idx === scrollOffset + CENTER_IDX;
          const dist  = idx - (scrollOffset + CENTER_IDX);

          const half   = Math.floor(VISIBLE / 2);
          const arcPct = dist / half;
          const xOff   = Math.sin(arcPct * Math.PI / 2) * ARC_RADIUS;
          const scale  = isCur ? 1 : Math.max(0.65, 1 - Math.abs(dist) * 0.18);
          const opacity= isCur ? 1 : Math.max(0.18, 1 - Math.abs(dist) * 0.28);

          return (
            <motion.div key={it.key + idx}
              className="flex items-center gap-2 absolute left-1/2"
              style={{ height: ROW_H, top: idx * ROW_H, marginLeft: -130 }}
              animate={{ x: xOff, scale, opacity }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              <div className="flex items-center justify-center rounded-md shrink-0" style={{ width: 22, height: 22, background: isCur ? `${it.color}18` : 'transparent' }}>
                <Icon size={isCur ? 13 : 10} style={{ color: it.color, opacity: isCur ? 1 : 0.55 }} className={isCur && it.type === 'thinking' ? 'animate-spin' : ''} />
              </div>
              <span className="text-[11px] font-medium whitespace-nowrap" style={{ color: isCur ? it.color : '#a0a0a0', opacity: isCur ? 1 : 0.45, textShadow: isCur ? `0 0 10px ${it.color}30` : 'none' }}>
                {it.label}
              </span>
              <div className="absolute w-[5px] h-[5px] rounded-full"
                style={{ left: 130 - 2, top: ROW_H / 2 - 2, background: isCur ? it.color : 'rgba(255,255,255,0.15)', boxShadow: isCur ? `0 0 6px ${it.color}` : 'none' }} />
            </motion.div>
          );
        })}
      </motion.div>
      {items.length > visibleItems.length && (
        <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-1">
          <ChevronDown size={10} className="text-text-dim/30 animate-bounce" />
        </div>
      )}
    </div>
  );
}

function ActivityPulse({ events }: { events: OCEvent[] }) {
  const items = useStepItems(events);
  if (items.length === 0) return null;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center py-1">
      <StepArc items={items} />
    </motion.div>
  );
}

/* ════════════════════════════════════════════════
    EVENT ROW (inside assistant message)
    ════════════════════════════════════════════════ */
function EventRow({ ev }: { ev: OCEvent }) {
  if (ev.type === 'text') {
    return <span className="text-text text-[12px] leading-relaxed whitespace-pre-wrap">{ev.text}</span>;
  }
  if (ev.type === 'thinking') {
    return (
      <div className="flex items-center gap-1.5 text-accent/70 text-[10px] italic">
        <Loader2 size={10} className="animate-spin" />
        <span>Thinking...</span>
      </div>
    );
  }
  if (ev.type === 'tool_use') {
    return (
      <div className="flex items-center gap-1.5 text-[10px] text-blue-400 bg-blue-400/5 px-2 py-1 rounded-md border border-blue-400/10">
        <HardDrive size={10} />
        <span className="font-mono">{ev.tool}</span>
        {ev.state && <span className="text-[8px] opacity-60">-&gt; {ev.state}</span>}
      </div>
    );
  }
  if (ev.type === 'tool_result') {
    return (
      <div className="flex items-start gap-1.5 text-[10px] text-green-400 bg-green-400/5 px-2 py-1 rounded-md border border-green-400/10">
        <Check size={10} className="mt-0.5" />
        <div className="flex-1 min-w-0">
          <span className="font-mono">{ev.tool}</span>
          {ev.output && <p className="text-text-muted mt-0.5 truncate">{ev.output.slice(0, 120)}</p>}
        </div>
      </div>
    );
  }
  if (ev.type === 'file_change') {
    return (
      <div className="flex items-center gap-1.5 text-[10px] text-amber-400 bg-amber-400/5 px-2 py-1 rounded-md border border-amber-400/10">
        <FileCode size={10} />
        <span className="font-mono truncate">{ev.filePath}</span>
        <span className={`text-[8px] px-1 rounded ${ev.changeType === 'remove' ? 'bg-red-400/20 text-red-400' : ev.changeType === 'add' ? 'bg-green-400/20 text-green-400' : 'bg-amber-400/20'}`}>
          {ev.changeType}
        </span>
      </div>
    );
  }
  if (ev.type === 'error') {
    return <span className="text-red-400 text-[11px]">{ev.error}</span>;
  }
  return null;
}

/* ════════════════════════════════════════════════
    PROVIDER COLOR HELPER
    ════════════════════════════════════════════════ */
function providerColor(p: string): string {
  switch (p) {
    case 'openai':      return '#74aa9c';
    case 'anthropic':   return '#d4a574';
    case 'google':      return '#8ab4f8';
    case 'xai':      return '#ef4444';
    case 'ollama':      return '#f59e0b';
    case 'opencode':    return '#a855f7';
    default:            return '#6366f1';
  }
}

/* ════════════════════════════════════════════════
    MAIN COMPONENT
    ════════════════════════════════════════════════ */
export default function OpenCodePanel() {
  const projectRoot = useStore(s => s.projectRoot);
  const setCenterTab = useStore(s => s.setCenterTab);

  /* Chat state */
  const [messages, setMessages] = useState<OCMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  /* OpenCode meta */
  const [models, setModels] = useState<{ id: string; name: string; provider: string }[]>([]);
  const [agents, setAgents] = useState<{ name: string; primary: boolean; description?: string }[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('');

  /* Session state */
  const [sessions, setSessions] = useState<OCSession[]>(loadSessions);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [sessionOpen, setSessionOpen] = useState(false);

  /* UI state */
  const [connectOpen, setConnectOpen] = useState(false);
  const [modelsOpen, setModelsOpen] = useState(false);
  const [slashOpen, setSlashOpen] = useState(false);
  const [selectedSlash, setSelectedSlash] = useState(0);
  const [slashQuery, setSlashQuery] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const abortRef = useRef<(() => void) | null>(null);

  /* Load metadata */
  useEffect(() => {
    opencodeApi.models().then(r => {
      const m = (r.models || []).map((id: string) => {
        const parts = id.split('/');
        return { id, name: parts[parts.length - 1] || id, provider: parts.length > 1 ? parts[0] : 'opencode' };
      });
      if (m.length) { setModels(m); if (!selectedModel) setSelectedModel(m[0].id); }
    }).catch(() => {
      const fb = [{ id: 'opencode', name: 'OpenCode', provider: 'opencode' }];
      setModels(fb); if (!selectedModel) setSelectedModel(fb[0].id);
    });

    opencodeApi.agents().then(r => {
      const a = (r.agents || []).map((ag: any) => ({ name: ag.name, primary: ag.primary, description: ag.description }));
      if (a.length) { setAgents(a); setSelectedAgent(a.find((x: any) => x.primary)?.name || a[0].name); }
    }).catch(() => {
      const fb = [{ name: 'build', primary: true, description: 'Executes tools' }];
      setAgents(fb); setSelectedAgent(fb[0].name);
    });
  }, []);

  /* Load session messages */
  useEffect(() => {
    if (!activeSessionId) { setMessages([]); return; }
    const sess = sessions.find(s => s.id === activeSessionId);
    setMessages(sess?.messages || []);
  }, [activeSessionId]);

  /* Auto-scroll */
  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length, sending]);

  /* Add message helper */
  const addMsg = useCallback((msg: Omit<OCMessage, 'id' | 'timestamp'>) => {
    const newMsg: OCMessage = { ...msg, id: genId(), timestamp: getNow() };
    setMessages(prev => {
      const next = [...prev, newMsg];
      if (activeSessionId) {
        const sessNext = sessions.map(s => s.id === activeSessionId ? { ...s, messages: next, updatedAt: new Date().toISOString() } : s);
        saveSessions(sessNext);
        setSessions(sessNext);
      }
      return next;
    });
  }, [activeSessionId, sessions]);

  /* Slash command runner */
  const runSlash = useCallback((cmd: SlashCmd, rest = '') => {
    setInput(''); setSlashOpen(false); setSelectedSlash(0);
    switch (cmd.action) {
      case 'clear':
        setMessages([]);
        if (activeSessionId) {
          const next = sessions.map(s => s.id === activeSessionId ? { ...s, messages: [] } : s);
          setSessions(next); saveSessions(next);
        }
        addMsg({ role: 'system', content: 'Chat history cleared.', events: [] });
        break;
      case 'compact':
        addMsg({ role: 'system', content: `*Compacted ${Math.max(0, messages.length - 4)} messages.*`, events: [] });
        break;
      case 'connect': setConnectOpen(true); break;
      case 'models': setModelsOpen(true); break;
      case 'settings':
        setCenterTab('SettingsPanel');
        setSessionOpen(false);
        break;
      case 'help':
        addMsg({ role: 'system', content: SLASH_COMMANDS.map(c => `**/${c.name}** - ${c.desc}`).join('\n'), events: [] });
        break;
      case 'cost':
        addMsg({ role: 'system', content: `Estimated tokens: **${Math.ceil(messages.reduce((a,m) => a + m.content.length, 0) / 4).toLocaleString()}**`, events: [] });
        break;
      case 'debug':
        addMsg({ role: 'system', content: '*Check event stream below for live tool calls.*', events: [] });
        break;
      case 'ls':
        addMsg({ role: 'system', content: `Project root: \`${projectRoot || '—'}\``, events: [] });
        break;
      case 'doc': addMsg({ role: 'system', content: rest ? `Loading docs for **${rest}**...` : 'Usage: **/doc** <library>', events: [] }); break;
      case 'web': addMsg({ role: 'system', content: rest ? `Fetching **${rest}**...` : 'Usage: **/web** <url>', events: [] }); break;
      case 'search': addMsg({ role: 'system', content: rest ? `Searching web for **${rest}**...` : 'Usage: **/search** <query>', events: [] }); break;
      case 'image': addMsg({ role: 'system', content: 'Image upload coming soon.', events: [] }); break;
    }
  }, [activeSessionId, sessions, messages, addMsg, projectRoot, setCenterTab]);

  /* Input handlers */
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

  const slashMatches = slashQuery ? SLASH_COMMANDS.filter(c => c.name.startsWith(slashQuery)) : SLASH_COMMANDS;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' && !slashOpen) {
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

  /* Send via OpenCode CLI streaming */
  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    if (text.startsWith('/')) {
      const cmdName = text.slice(1).split(' ')[0];
      const cmd = SLASH_COMMANDS.find(c => c.name === cmdName);
      if (cmd) { runSlash(cmd, text.slice(1 + cmdName.length).trim()); setInput(''); return; }
    }
    setInput('');
    addMsg({ role: 'user', content: text, events: [] });
    setSending(true);

    const assistantId = genId();
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', events: [], timestamp: '' }]);

    try {
      const res = await opencodeApi.run({
        prompt: text,
        model: selectedModel || undefined,
        agent: selectedAgent || undefined,
        dir: projectRoot || undefined,
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      const parseLine = (line: string): OCEvent | null => {
        try {
          const obj = JSON.parse(line);
          if (obj.type === 'text' && obj.part?.text) return { type: 'text', text: obj.part.text };
          if (obj.type === 'tool_use' && obj.part?.tool) return { type: 'tool_use', tool: obj.part.tool, callID: obj.part.callID, state: obj.part.state?.status };
          if (obj.type === 'tool_result' && obj.part?.tool) return { type: 'tool_result', tool: obj.part.tool, callID: obj.part.callID, state: obj.part.state?.status, output: obj.part.state?.output };
          if (obj.type === 'step_start') return { type: 'step_start' };
          if (obj.type === 'step_finish') return { type: 'step_finish' };
          if (obj.type === 'error') return { type: 'error', error: obj.error || obj.part?.text };
          if (obj.type === 'file_change') return { type: 'file_change', filePath: obj.filePath, changeType: obj.changeType };
        } catch {}
        return null;
      };

      const readChunk = async () => {
        const { done, value } = await reader.read();
        if (done) return;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = parseLine(line);
          if (!ev) continue;

          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (!last || last.id !== assistantId || last.role !== 'assistant') return prev;
            const updated = { ...last, events: [...last.events, ev] };
            if (ev.type === 'text' && ev.text) updated.content = (updated.content || '') + ev.text;
            const next = [...prev];
            next[next.length - 1] = updated;
            if (activeSessionId) {
              const sessNext = sessions.map(s => s.id === activeSessionId ? { ...s, messages: next, updatedAt: new Date().toISOString() } : s);
              saveSessions(sessNext);
              setSessions(sessNext);
            }
            return next;
          });
        }
        await readChunk();
      };

      abortRef.current = () => reader.cancel();
      await readChunk();
    } catch (err: any) {
      addMsg({ role: 'error', content: String(err.message || 'Request failed'), events: [] });
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  };

  const handleAbort = () => {
    if (abortRef.current) { abortRef.current(); abortRef.current = null; setSending(false); }
  };

  /* Session CRUD */
  const createNewSession = () => {
    const id = genId();
    const s: OCSession = {
      id, name: 'New Chat', messages: [],
      providerId: selectedModel, model: selectedModel,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    setSessions(prev => { const n = [s, ...prev]; saveSessions(n); return n; });
    setActiveSessionId(id);
    setMessages([]);
    setSessionOpen(false);
  };

  const deleteSession = (id: string) => {
    const next = sessions.filter(s => s.id !== id);
    setSessions(next); saveSessions(next);
    if (activeSessionId === id) { setActiveSessionId(null); setMessages([]); }
  };

  const renameSession = (id: string) => {
    if (!renameValue.trim()) { setRenamingId(null); return; }
    const next = sessions.map(s => s.id === id ? { ...s, name: renameValue.trim() } : s);
    setSessions(next); saveSessions(next);
    setRenamingId(null); setRenameValue('');
  };

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const activeMeta = AGENTS[selectedAgent] || { icon: Command, color: '#888', desc: 'OpenCode' };

  /* ════════════════════════════════════════════════
      RENDER
      ════════════════════════════════════════════════ */
  return (
    <div className="flex flex-col h-full bg-bg text-text relative">

      {/* Connect Modal */}
      <AnimatePresence>
        {connectOpen && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}
            className="absolute inset-x-2 top-3 bottom-20 z-50 rounded-2xl bg-bg-surface/95 backdrop-blur-md border border-border shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-bg-panel/60">
              <Plug size={12} className="text-accent" />
              <span className="text-[11px] font-bold">OpenCode Settings</span>
              <button onClick={() => setConnectOpen(false)} className="ml-auto p-1 text-text-dim hover:text-text"><X size={12} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              <div>
                <label className="text-[9px] font-bold text-text-muted mb-1.5 block">Model</label>
                <div className="flex flex-wrap gap-1">
                  {models.map(m => (
                    <button key={m.id} onClick={() => setSelectedModel(m.id)}
                      className={`px-2.5 py-1 text-[9px] rounded-lg border transition-all ${selectedModel === m.id ? 'bg-accent text-bg border-accent' : 'border-border bg-bg-panel text-text-secondary hover:bg-bg-hover'}`}
                    >
                      <Cpu size={8} className="inline mr-1" />{m.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[9px] font-bold text-text-muted mb-1.5 block">Agent</label>
                <div className="space-y-1">
                  {agents.map(ag => {
                    const meta = AGENTS[ag.name] || { icon: Command, color: '#888', desc: ag.description || '' };
                    const Icon = meta.icon;
                    return (
                      <button key={ag.name} onClick={() => setSelectedAgent(ag.name)}
                        className={`w-full flex items-center gap-2 p-2 rounded-xl border transition-all text-left ${selectedAgent === ag.name ? 'border-accent/30 bg-accent-bg/15' : 'border-border bg-bg-panel hover:bg-bg-hover'}`}
                      >
                        <div className="w-6 h-6 rounded flex items-center justify-center shrink-0" style={{ background: meta.color + '14' }}>
                          <Icon size={12} style={{ color: meta.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-semibold">{ag.name}</span>
                            {ag.primary && <span className="text-[8px] px-1 rounded bg-accent-bg text-accent">primary</span>}
                          </div>
                          <p className="text-[9px] text-text-dim truncate">{meta.desc}</p>
                        </div>
                        {selectedAgent === ag.name && <Check size={12} className="text-accent" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Models Picker */}
      <AnimatePresence>
        {modelsOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-x-2 top-3 bottom-20 z-50 rounded-2xl bg-bg-surface/95 backdrop-blur-md border border-border shadow-2xl overflow-hidden flex flex-col"
          >
            {/* header with search */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-bg-panel/60 shrink-0">
              <Search size={12} className="text-text-muted" />
              <input
                autoFocus
                placeholder="Filter models..."
                className="flex-1 bg-transparent text-[11px] text-text placeholder:text-text-dim/50 focus:outline-none"
                onChange={e => setModelFilter(e.target.value)}
              />
              <button onClick={() => setModelsOpen(false)} className="p-1 text-text-dim hover:text-text rounded">
                <X size={12} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-3">
              {Object.entries(
                models.reduce((acc, m) => {
                  const prov = m.provider || 'other';
                  (acc[prov] = acc[prov] || []).push(m);
                  return acc;
                }, {} as Record<string, typeof models>)
              ).sort(([a], [b]) => a.localeCompare(b)).map(([provider, provModels]) => {
                const filt = modelFilter.toLowerCase();
                const visible = filt ? provModels.filter(m => m.id.toLowerCase().includes(filt) || m.name.toLowerCase().includes(filt)) : provModels;
                if (visible.length === 0) return null;
                const pColor = providerColor(provider);
                return (
                  <div key={provider}>
                    <div className="flex items-center gap-1.5 px-2 py-1 mb-1">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: pColor, boxShadow: `0 0 6px ${pColor}60` }} />
                      <span className="text-[9px] font-bold uppercase tracking-wider text-text-dim">{provider}</span>
                      <span className="text-[9px] text-text-muted ml-auto">{visible.length}</span>
                    </div>
                    <div className="space-y-0.5">
                      {visible.map(m => {
                        const selected = selectedModel === m.id;
                        return (
                          <button key={m.id}
                            onClick={() => { setSelectedModel(m.id); setModelsOpen(false); }}
                            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl border text-left transition-all ${selected ? 'border-accent/30 bg-accent-bg/15 shadow-[0_0_12px_rgba(168,85,247,0.06)]' : 'border-transparent hover:border-border/60 hover:bg-bg-hover'}`}
                          >
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                              style={{ background: selected ? `${pColor}18` : 'rgba(255,255,255,0.03)' }}>
                              <Cpu size={13} style={{ color: selected ? pColor : '#888' }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[11px] font-semibold truncate ${selected ? 'text-accent' : 'text-text-secondary'}`}>
                                  {m.name}
                                </span>
                                {selected && <Check size={11} className="text-accent shrink-0" />}
                              </div>
                              <p className="text-[9px] text-text-dim font-mono truncate">{m.id}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOP BAR */}
      <div className="shrink-0 flex items-center gap-1 px-2.5 py-2 border-b border-border bg-bg-panel relative z-10">
        {/* Model / Agent badge */}
        <button onClick={() => setConnectOpen(true)} className="flex items-center gap-1.5 shrink-0 px-2 py-1.5 text-[10px] font-semibold text-text-secondary hover:text-text rounded-lg hover:bg-bg-hover transition-all">
          <Diamond size={11} className="text-text-muted" />
          <span className="truncate max-w-[80px]">{activeMeta?.desc ? activeMeta.desc.split('—')[0].trim() : 'OpenCode'}</span>
          <ChevronDown size={9} className="text-text-dim" />
        </button>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Session dropdown */}
        <div className="flex-1 relative min-w-0">
          <button onClick={() => setSessionOpen(o => !o)} className="flex items-center gap-1.5 w-full px-2 py-1.5 text-[10px] font-semibold text-text-secondary hover:text-text rounded-lg hover:bg-bg-hover transition-all min-w-0">
            <Command size={12} />
            <span className="truncate">{activeSession?.name || 'New Chat'}</span>
            <ChevronDown size={10} className={`ml-auto transition-transform ${sessionOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {sessionOpen && (
              <motion.div initial={{ opacity: 0, y: -4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.98 }} transition={{ duration: 0.12 }}
                className="absolute top-full left-0 right-0 mt-1 bg-bg-surface border border-border rounded-xl shadow-xl z-40 py-1 max-h-64 overflow-y-auto"
              >
                {sessions.length === 0 && <div className="px-3 py-2 text-[10px] text-text-dim">No chats yet</div>}
                {sessions.map(s => (
                  <div key={s.id} className={`flex items-center gap-1 px-2 py-1.5 hover:bg-bg-hover transition-colors ${activeSessionId === s.id ? 'bg-accent-bg/15' : ''}`}>
                    {renamingId === s.id ? (
                      <>
                        <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') renameSession(s.id); if (e.key === 'Escape') setRenamingId(null); }}
                          className="flex-1 text-[10px] bg-bg-panel border border-border rounded px-2 py-1 text-text focus:outline-none focus:border-accent"
                        />
                        <button onClick={() => renameSession(s.id)} className="p-1 text-green-400 hover:bg-green-400/10 rounded"><Check size={10} /></button>
                        <button onClick={() => setRenamingId(null)} className="p-1 text-text-dim hover:text-text rounded"><X size={10} /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setActiveSessionId(s.id); setSessionOpen(false); }}
                          className="flex-1 flex items-center gap-2 text-left text-[10px] min-w-0"
                        >
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeSessionId === s.id ? 'bg-accent' : 'bg-text-dim'}`} />
                          <span className="truncate text-text">{s.name || 'Untitled'}</span>
                        </button>
                        <button onClick={() => { setRenamingId(s.id); setRenameValue(s.name || ''); }} className="p-1 text-text-dim hover:text-text rounded opacity-0 group-hover:opacity-100" title="Rename">
                          <Pencil size={10} />
                        </button>
                        <button onClick={() => deleteSession(s.id)} className="p-1 text-text-dim hover:text-danger rounded" title="Delete">
                          <Trash2 size={10} />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Actions */}
        <button onClick={createNewSession} className="p-1.5 text-text-muted hover:text-accent hover:bg-accent-bg rounded-lg transition-colors shrink-0" title="New Chat">
          <Plus size={13} />
        </button>
        <button onClick={() => { if (activeSessionId) { setRenamingId(activeSessionId); setRenameValue(activeSession?.name || ''); } }} disabled={!activeSessionId}
          className="p-1.5 text-text-muted hover:text-text hover:bg-bg-hover rounded-lg transition-colors shrink-0 disabled:opacity-20" title="Rename"
        >
          <Pencil size={13} />
        </button>
        <button onClick={() => { if (activeSessionId) deleteSession(activeSessionId); }} disabled={!activeSessionId}
          className="p-1.5 text-text-muted hover:text-danger hover:bg-danger-bg rounded-lg transition-colors shrink-0 disabled:opacity-20" title="Delete"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* CHAT STREAM */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {messages.length === 0 && !sending && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-text-muted select-none">
            <div className="w-14 h-14 rounded-2xl bg-accent-bg flex items-center justify-center">
              <Diamond size={28} className="text-accent/30" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-text-secondary font-semibold text-[13px]">OpenCode CLI</p>
              <p className="text-[11px] opacity-50">Type <kbd className="px-1.5 py-0.5 rounded bg-bg-hover text-text-secondary text-[10px] font-mono">/</kbd> for commands</p>
              <p className="text-[10px] text-text-dim/50">{selectedModel || 'default'} - {selectedAgent || 'default'}</p>
            </div>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          return (
            <div key={msg.id || idx} className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
              <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${isUser ? 'bg-accent text-bg' : 'bg-bg-surface border border-border'}`}>
                {isUser ? <Command size={11} /> : <Diamond size={11} className="text-accent" />}
              </div>
              <div className={`flex flex-col gap-1 max-w-[88%] ${isUser ? 'items-end' : 'items-start'}`}>
                {isUser ? (
                  <div className="bg-accent text-bg rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-[12px] leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </div>
                ) : (
                  <div className="w-full space-y-1.5">
                    {msg.events.map((ev, evIdx) => (
                      <EventRow key={evIdx} ev={ev} />
                    ))}
                    {msg.events.length === 0 && sending && idx === messages.length - 1 && (
                      <div className="flex items-center gap-2 px-2 py-1">
                        <Loader2 size={12} className="text-accent animate-spin" />
                        <span className="text-[10px] text-text-dim">Connecting to OpenCode...</span>
                      </div>
                    )}
                  </div>
                )}
                <span className="text-[9px] text-text-dim/50 px-1 font-mono">{msg.timestamp}</span>
              </div>
            </div>
          );
        })}

        {/* Live activity indicator */}
        {sending && messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' && (
          <ActivityPulse events={messages[messages.length - 1].events} />
        )}

        <div ref={scrollRef} />
      </div>

      {/* INPUT BAR */}
      <div className="shrink-0 border-t border-border bg-bg-panel/80 backdrop-blur-sm p-2.5 relative">
        {/* Slash dropdown */}
        <AnimatePresence>
          {slashOpen && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.1 }}
              className="absolute bottom-full left-2 right-2 mb-1 bg-bg-surface border border-border rounded-xl shadow-xl z-30 py-1 max-h-48 overflow-y-auto"
            >
              {slashMatches.length === 0 && <div className="px-3 py-2 text-[10px] text-text-dim">No commands match</div>}
              {slashMatches.map((cmd, i) => {
                const Icon = cmd.icon;
                return (
                  <button key={cmd.name} onClick={() => runSlash(cmd)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${i === selectedSlash ? 'bg-accent-bg/30 text-accent' : 'text-text-secondary hover:bg-bg-hover'}`}
                  >
                    <Icon size={12} className={i === selectedSlash ? 'text-accent' : 'text-text-dim'} />
                    <span className="text-[11px] font-semibold">/{cmd.name}</span>
                    <span className="text-[10px] text-text-dim ml-auto">{cmd.desc}</span>
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-2 items-end bg-bg-surface border border-border/80 rounded-2xl px-3 py-2.5 focus-within:border-accent/60 focus-within:shadow-[0_0_0_3px_rgba(168,85,247,0.08)] transition-all">
          <textarea
            value={input}
            onChange={e => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={sending ? 'OpenCode is working...' : 'Ask OpenCode to build, refactor, debug...'}
            disabled={sending}
            className="flex-1 bg-transparent text-[12px] text-text placeholder:text-text-dim/70 focus:outline-none leading-relaxed py-0.5 resize-none max-h-32 min-h-[20px] disabled:opacity-50"
            spellCheck={false}
            autoComplete="off"
            rows={1}
            style={{ height: 'auto' }}
            onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }}
          />
          <button
            onClick={sending ? handleAbort : handleSend}
            className={`p-2 rounded-xl transition-all shrink-0 ${
              sending
                ? 'bg-danger-bg text-danger hover:bg-danger hover:text-bg'
                : 'bg-accent text-bg hover:opacity-90 disabled:opacity-15'
            }`}
          >
            {sending ? <Square size={13} fill="currentColor" /> : <Send size={13} />}
          </button>
        </div>

        {/* Status bar under input */}
        <div className="flex items-center justify-between mt-1.5 px-1">
          <div className="flex items-center gap-2 text-[9px] text-text-muted">
            <span className="flex items-center gap-1"><Cpu size={8} />{selectedModel || 'default'}</span>
            <span className="text-text-dim">-</span>
            <span className="flex items-center gap-1"><Flame size={8} />{selectedAgent || 'default'}</span>
            <span className="text-text-dim">-</span>
            <span className="text-text-dim">{messages.filter(m => m.role === 'user').length} msgs</span>
          </div>
          <span className="text-[9px] text-text-dim/40">{input.length}</span>
        </div>
      </div>
    </div>
  );
}
