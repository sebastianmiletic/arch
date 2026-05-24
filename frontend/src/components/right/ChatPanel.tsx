import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '../../stores/appStore';
import { sessionsApi, chatApi } from '../../services/api';
import type { Message } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  Send, Plus, Trash2, ChevronDown, MessageSquare,
  Copy, Check, Terminal, Hash
} from 'lucide-react';

export default function ChatPanel() {
  const sessions = useStore(s => s.sessions);
  const activeSessionId = useStore(s => s.activeSessionId);
  const providers = useStore(s => s.providers);
  const setSessions = useStore(s => s.setSessions);
  const setActiveSessionId = useStore(s => s.setActiveSessionId);
  const addMessage = useStore(s => s.addMessage);
  const theme = useStore(s => s.theme);

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    sessionsApi.list().then(setSessions);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions.length, activeSessionId, sessions.find(s => s.id === activeSessionId)?.messages?.length]);

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const activeProvider = providers.find(p => p.id === activeSession?.providerId) || providers.find(p => p.enabled);

  const handleSend = useCallback(async () => {
    if (!input.trim()) return;
    let sid = activeSessionId;
    if (!sid) {
      const prov = activeProvider;
      if (!prov) return;
      const s = await sessionsApi.create({ name: input.slice(0, 30) + (input.length > 30 ? '...' : ''), providerId: prov.id, model: prov.defaultModel });
      sid = s.id;
      setActiveSessionId(sid);
      setSessions([s, ...sessions]);
    }
    const content = input;
    setInput('');
    setSending(true);
    try {
      const res = await chatApi.send({ sessionId: sid!, content, providerId: activeProvider?.id || '' });
      if (res.messages) {
        for (const msg of res.messages) addMessage(sid!, msg);
      }
    } catch (err) {
      addMessage(sid!, { id: Date.now().toString(), role: 'assistant', content: `**Error:** ${(err as Error).message}`, timestamp: new Date().toISOString() });
    } finally {
      setSending(false);
    }
  }, [input, activeSessionId, activeProvider, sessions, setSessions, setActiveSessionId, addMessage]);

  const handleNewChat = useCallback(async () => {
    const prov = activeProvider || providers.find(p => p.enabled);
    if (!prov) return;
    const s = await sessionsApi.create({ name: 'New session', providerId: prov.id, model: prov.defaultModel });
    setActiveSessionId(s.id);
    setSessions([s, ...sessions]);
    setShowSessions(false);
  }, [activeProvider, providers, sessions, setSessions, setActiveSessionId]);

  const handleDeleteSession = useCallback(async (id: string) => {
    await sessionsApi.delete(id);
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated);
    if (activeSessionId === id) setActiveSessionId(updated[0]?.id || null);
  }, [sessions, activeSessionId, setSessions, setActiveSessionId]);

  return (
    <div className="flex flex-col h-full">
      {/* Session Header */}
      <div className="flex items-center border-b border-border px-3 py-2 gap-2">
        <button
          onClick={() => setShowSessions(!showSessions)}
          className="flex-1 flex items-center gap-2 bg-bg-surface border border-border rounded-lg px-3 py-1.5 text-[11px] hover:bg-bg-hover transition-colors"
        >
          <Terminal size={12} className="text-accent" />
          <span className="truncate text-text font-medium">
            {activeSession?.name || 'New session'}
          </span>
          <span className="ml-auto text-text-dim">
            {activeSession?.messages?.length || 0}
          </span>
          <ChevronDown size={12} className={`transition-transform ${showSessions ? 'rotate-180' : ''}`} />
        </button>
        <button
          onClick={handleNewChat}
          className="p-1.5 text-text-secondary hover:text-accent hover:bg-accent-bg rounded-lg transition-colors"
          title="New session"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Session Dropdown */}
      <AnimatePresence>
        {showSessions && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-border overflow-hidden bg-bg-panel"
          >
            <div className="max-h-48 overflow-y-auto py-1">
              {sessions.length === 0 && (
                <div className="px-3 py-2 text-[11px] text-text-muted">No sessions</div>
              )}
              {sessions.map(s => (
                <div
                  key={s.id}
                  onClick={() => { setActiveSessionId(s.id); setShowSessions(false); }}
                  className={`flex items-center gap-2 px-3 py-2 text-[11px] cursor-pointer transition-colors ${
                    s.id === activeSessionId ? 'bg-accent-bg text-accent' : 'text-text-secondary hover:bg-bg-hover'
                  }`}
                >
                  <MessageSquare size={11} className={s.id === activeSessionId ? 'text-accent' : 'text-text-dim'} />
                  <span className="flex-1 truncate">{s.name}</span>
                  <span className="text-text-dim">{s.messages?.length || 0}</span>
                  <button
                    onClick={e => { e.stopPropagation(); handleDeleteSession(s.id); }}
                    className="p-1 text-text-dim hover:text-danger rounded transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {(!activeSession?.messages || activeSession.messages.length === 0) && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-text-muted">
            <div className="w-10 h-10 rounded-xl bg-bg-surface border border-border flex items-center justify-center">
              <Terminal size={20} className="text-text-dim" />
            </div>
            <div className="text-[11px] text-center space-y-1">
              <p className="text-text-secondary font-medium">Console</p>
              <p>Send commands or questions to get started</p>
            </div>
          </div>
        )}
        {(activeSession?.messages || []).map((msg, i) => (
          <MessageBubble key={msg.id || i} message={msg} theme={theme} />
        ))}
        {sending && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2"
          >
            <div className="w-5 h-5 rounded bg-bg-surface border border-border flex items-center justify-center shrink-0">
              <Hash size={10} className="text-text-muted" />
            </div>
            <div className="bg-bg-surface border border-border rounded-lg px-3 py-2">
              <div className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </motion.div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-2.5">
        <div className="flex gap-2 items-end bg-bg-surface border border-border rounded-xl p-2 focus-within:border-accent transition-colors"
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a command..."
            rows={Math.min(5, input.split('\n').length || 1)}
            className="flex-1 bg-transparent text-xs text-text placeholder:text-text-dim focus:outline-none resize-none py-1 px-1"
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="p-2 bg-accent text-bg rounded-lg hover:opacity-90 disabled:opacity-20 transition-all shrink-0"
          >
            <Send size={14} />
          </button>
        </div>
        <div className="flex items-center justify-between mt-1 px-1">
          <span className="text-[9px] text-text-dim">Shift+Enter for new line</span>
          <span className="text-[9px] text-text-dim">{input.length}</span>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, theme }: { message: Message; theme: any }) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const segments = message.content.split(/(```[\s\S]*?```)/g);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar */}
      <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 border ${
        isUser ? 'border-accent/30 bg-accent-bg' : 'border-border bg-bg-surface'
      }`}>
        {isUser ? (
          <Terminal size={10} className="text-accent" />
        ) : (
          <Hash size={10} className="text-text-muted" />
        )}
      </div>

      {/* Message */}
      <div className={`group relative max-w-[85%] rounded-lg px-3 py-2 text-[12px] leading-relaxed ${
        isUser
          ? 'bg-accent text-bg'
          : 'bg-bg-surface text-text border border-border'
      }`}>
        {isUser ? (
          <div className="whitespace-pre-wrap">{message.content}</div>
        ) : (
          <div className="space-y-2">
            {segments.map((segment, i) => {
              if (segment.startsWith('```')) {
                const lines = segment.slice(3, -3).split('\n');
                const lang = lines[0].trim() || 'text';
                const code = lines.slice(1).join('\n');
                return (
                  <div key={i} className="my-2 rounded-lg overflow-hidden border border-border">
                    <div className="flex items-center justify-between px-3 py-1 bg-bg-active border-b border-border">
                      <span className="text-[10px] text-text-muted font-mono uppercase">{lang}</span>
                      <button onClick={() => navigator.clipboard.writeText(code)} className="text-text-dim hover:text-text transition-colors">
                        <Copy size={12} />
                      </button>
                    </div>
                    <SyntaxHighlighter
                      language={lang}
                      style={oneDark}
                      customStyle={{ margin: 0, fontSize: '12px', background: theme.bgSurface }}
                      showLineNumbers
                      lineNumberStyle={{ fontSize: '10px', color: theme.textDim }}
                    >
                      {code}
                    </SyntaxHighlighter>
                  </div>
                );
              }
              if (!segment.trim()) return null;
              const html = segment
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/`(.*?)`/g, '<code class="px-1 py-0.5 rounded bg-bg-hover text-accent text-[11px]">$1</code>')
                .replace(/\n/g, '<br />');
              return <div key={i} className="text-[12px] leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />;
            })}
          </div>
        )}

        {/* Footer */}
        <div className={`flex items-center gap-2 mt-2 pt-1.5 ${isUser ? 'border-t border-bg/20' : 'border-t border-border'}`}>
          <span className="text-[10px] opacity-50">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {!isUser && (
            <button
              onClick={handleCopy}
              className="ml-auto p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-text"
            >
              {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
