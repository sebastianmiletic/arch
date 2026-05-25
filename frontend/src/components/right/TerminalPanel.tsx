import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import 'xterm/css/xterm.css';
import { Terminal as TerminalIcon, Trash2, Copy, Check, Power, Plus, X } from 'lucide-react';

interface TermTab {
  id: string;
  label: string;
}

export default function TerminalPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tabs, setTabs] = useState<TermTab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  const connect = useCallback((sid: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket('ws://localhost:3001');
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      sessionIdRef.current = sid;
      ws.send(JSON.stringify({ type: 'terminal:create', sessionId: sid }));
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'terminal:data') {
          xtermRef.current?.write(msg.data);
        }
        if (msg.type === 'terminal:created') {
          sessionIdRef.current = msg.sessionId;
          const dims = fitAddonRef.current?.proposeDimensions();
          if (dims) {
            ws.send(JSON.stringify({
              type: 'terminal:resize',
              sessionId: msg.sessionId,
              cols: dims.cols,
              rows: dims.rows,
            }));
          }
        }
        if (msg.type === 'terminal:exit') {
          xtermRef.current?.writeln(`\r\n[process exited with code ${msg.code ?? '?'}]`);
          setConnected(false);
        }
      } catch {}
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
    };

    ws.onerror = () => {
      setConnected(false);
    };
  }, []);

  useEffect(() => {
    const term = new Terminal({
      fontFamily: '"SF Mono", Monaco, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.25,
      cursorBlink: true,
      cursorStyle: 'block',
      theme: {
        background: '#0c0c0c',
        foreground: '#e5e5e5',
        cursor: '#a855f7',
        selectionBackground: 'rgba(168,85,247,0.3)',
        black: '#0c0c0c',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#e5e5e5',
        brightBlack: '#4a4a4a',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#fde047',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff',
      },
      scrollback: 10000,
      convertEol: true,

    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    if (containerRef.current) {
      term.open(containerRef.current);
      fitAddon.fit();
    }

    term.onData((data) => {
      if (wsRef.current?.readyState === WebSocket.OPEN && sessionIdRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'terminal:input',
          sessionId: sessionIdRef.current,
          data,
        }));
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      const dims = fitAddon.proposeDimensions();
      if (dims && wsRef.current?.readyState === WebSocket.OPEN && sessionIdRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'terminal:resize',
          sessionId: sessionIdRef.current,
          cols: dims.cols,
          rows: dims.rows,
        }));
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Create first tab
    const firstId = crypto.randomUUID();
    setTabs([{ id: firstId, label: 'zsh' }]);
    setActiveTab(firstId);
    connect(firstId);

    return () => {
      resizeObserver.disconnect();
      term.dispose();
      wsRef.current?.close();
    };
  }, [connect]);

  const addTab = () => {
    const newId = crypto.randomUUID();
    setTabs(prev => [...prev, { id: newId, label: 'zsh' }]);
    setActiveTab(newId);
    // Kill current ws, start new one for new tab
    wsRef.current?.close();
    xtermRef.current?.clear();
    connect(newId);
  };

  const removeTab = (id: string) => {
    setTabs(prev => {
      const next = prev.filter(t => t.id !== id);
      if (next.length === 0) {
        const newId = crypto.randomUUID();
        next.push({ id: newId, label: 'zsh' });
        setActiveTab(newId);
        wsRef.current?.close();
        xtermRef.current?.clear();
        connect(newId);
      } else if (activeTab === id) {
        setActiveTab(next[0].id);
        wsRef.current?.close();
        xtermRef.current?.clear();
        connect(next[0].id);
      }
      return next;
    });
  };

  const handleCopy = () => {
    const selection = xtermRef.current?.getSelection();
    if (selection) {
      navigator.clipboard.writeText(selection);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClear = () => {
    xtermRef.current?.clear();
  };

  const handleReset = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN && sessionIdRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'terminal:kill',
        sessionId: sessionIdRef.current,
      }));
    }
    xtermRef.current?.clear();
    if (activeTab) {
      setTimeout(() => connect(activeTab), 200);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0c0c0c]">
      {/* Tab bar */}
      <div className="flex items-center border-b border-[#1a1a1a] shrink-0 select-none overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              if (activeTab !== tab.id) {
                setActiveTab(tab.id);
                wsRef.current?.close();
                xtermRef.current?.clear();
                connect(tab.id);
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono border-r border-[#1a1a1a] transition-colors ${
              activeTab === tab.id
                ? 'bg-[#1a1a1a] text-text'
                : 'text-text-dim hover:text-text-secondary hover:bg-[#111]'
            }`}
          >
            <TerminalIcon size={10} className={activeTab === tab.id ? 'text-success' : 'text-text-dim'} />
            {tab.label}
            {tabs.length > 1 && (
              <span
                onClick={(e) => { e.stopPropagation(); removeTab(tab.id); }}
                className="ml-1 p-0.5 rounded hover:bg-[#333] text-text-dim hover:text-danger transition-colors"
              >
                <X size={10} />
              </span>
            )}
          </button>
        ))}
        <button
          onClick={addTab}
          className="px-2 py-1.5 text-text-dim hover:text-text hover:bg-[#111] transition-colors border-r border-[#1a1a1a]"
        >
          <Plus size={12} />
        </button>

        <div className="flex items-center gap-2 px-2"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-success' : 'bg-danger'}`} />
          <span className="text-[9px] font-mono text-text-dim">{connected ? 'live' : 'dead'}</span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-1 px-2">
          <button onClick={handleCopy} className="p-1.5 rounded hover:bg-[#1a1a1a] text-text-dim hover:text-text transition-colors">
            {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
          </button>
          <button onClick={handleClear} className="p-1.5 rounded hover:bg-[#1a1a1a] text-text-dim hover:text-text transition-colors">
            <Trash2 size={12} />
          </button>
          <button onClick={handleReset} className="p-1.5 rounded hover:bg-[#1a1a1a] text-text-dim hover:text-text transition-colors">
            <Power size={12} />
          </button>
        </div>
      </div>

      {/* xterm container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden"
        style={{ padding: 4 }}
      />
    </div>
  );
}
