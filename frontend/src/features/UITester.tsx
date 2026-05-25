import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Monitor, Play, Pause, Bug, Zap, RotateCw, Globe, Eye, ArrowUpRight, Filter, Trash2, Download, X, ExternalLink, MessageSquare, AlertCircle, Clock } from 'lucide-react';
import { useStore } from '../stores/appStore';
import type { UITestLog } from '../types';

export default function UITester() {
  // project root available via store
  const [url, setUrl] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<UITestLog[]>([]);
  const [filter, setFilter] = useState<'all' | 'error' | 'warn' | 'log'>('all');
  const [selectedLog, setSelectedLog] = useState<UITestLog | null>(null);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [frameKey, setFrameKey] = useState(0);

  const startPreview = useCallback(() => {
    if (!url.trim()) return;
    setLogs([]);
    setIsRunning(true);
    setFrameKey(k => k + 1);
    setConsoleOpen(true);
  }, [url]);

  const stopPreview = () => {
    setIsRunning(false);
    setFrameKey(k => k + 1);
  };

  // Capture iframe console messages via postMessage
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data && typeof e.data === 'object' && e.data.source === 'uitester-bridge') {
        const log: UITestLog = {
          id: e.data.id || Date.now().toString(),
          message: e.data.message || '',
          source: e.data.sourceFile,
          line: e.data.line,
          col: e.data.column,
          stack: e.data.stack,
          timestamp: Date.now(),
          projectUrl: url,
        };
        setLogs(prev => [log, ...prev].slice(0, 500));
        if (e.data.type === 'error') setConsoleOpen(true);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [url]);

  const clearLogs = () => setLogs([]);
  const exportLogs = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `uitest-logs-${Date.now()}.json`;
    a.click();
  };

  const filteredLogs = logs.filter(l => {
    if (filter === 'all') return true;
    if (filter === 'error') return l.message?.toLowerCase().includes('error') || l.stack;
    if (filter === 'warn') return l.message?.toLowerCase().includes('warn');
    return true;
  });

  const bridgeScript = `
    <script>
      (function(){
        var orig = {
          log: console.log, warn: console.warn, error: console.error, info: console.info
        };
        function send(type, args){
          var msg = args.map(function(a){ try { return JSON.stringify(a); } catch(e){ return String(a); } }).join(' ');
          var err = args[0] instanceof Error ? args[0] : null;
          window.parent.postMessage({source:'uitester-bridge', type:type, message:msg, stack:err && err.stack, line:err && err.lineNumber, column:err && err.columnNumber}, '*');
        }
        console.log = function(){ send('log', Array.prototype.slice.call(arguments)); orig.log.apply(console, arguments); };
        console.warn = function(){ send('warn', Array.prototype.slice.call(arguments)); orig.warn.apply(console, arguments); };
        console.error = function(){ send('error', Array.prototype.slice.call(arguments)); orig.error.apply(console, arguments); };
        console.info = function(){ send('info', Array.prototype.slice.call(arguments)); orig.info.apply(console, arguments); };
        window.onerror = function(msg, source, line, col, err){
          window.parent.postMessage({source:'uitester-bridge', type:'error', message:msg, sourceFile:source, line:line, column:col, stack:err && err.stack}, '*');
          return false;
        };
        window.addEventListener('unhandledrejection', function(e){
          window.parent.postMessage({source:'uitester-bridge', type:'error', message: e.reason?.message || String(e.reason), stack: e.reason?.stack}, '*');
        });
      })();
    <\/script>
  `;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="p-3 border-b border-border space-y-3">
        <div className="flex items-center gap-2">
          <Monitor size={16} className="text-accent" />
          <span className="font-bold text-sm text-text-heading">UI Tester</span>
          <span className="ml-auto text-[10px] text-text-muted px-2 py-1 rounded bg-bg-surface">
            {isRunning ? 'Running' : 'Idle'}
          </span>
        </div>
        <p className="text-[11px] text-text-muted">
          Preview your app in a sandboxed iframe. All runtime errors, warnings, and logs are captured in real-time. Click "Fix with AI" to resolve issues automatically.
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-bg-surface border border-border rounded-lg px-3 py-1.5">
            <Globe size={12} className="text-text-muted" />
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="http://localhost:3000 or file://..."
              className="flex-1 bg-transparent text-[12px] text-text placeholder:text-text-dim focus:outline-none"
            />
          </div>
          {isRunning ? (
            <button onClick={stopPreview} className="px-3 py-1.5 bg-danger-bg border border-danger/20 text-danger text-[11px] font-bold rounded-lg hover:bg-danger/10 transition-all flex items-center gap-1.5">
              <Pause size={12} /> Stop
            </button>
          ) : (
            <button onClick={startPreview} className="px-3 py-1.5 bg-accent text-bg text-[11px] font-bold rounded-lg hover:opacity-90 transition-all flex items-center gap-1.5">
              <Play size={12} /> Start
            </button>
          )}
          <button onClick={() => { startPreview(); }}
            className="p-1.5 rounded-lg border border-border hover:bg-bg-hover transition-colors" title="Reload">
            <RotateCw size={12} className="text-text-muted" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Preview */}
        <div className="flex-1 flex flex-col bg-bg-surface">
          {isRunning && url ? (
            <iframe
              key={frameKey}
              ref={iframeRef}
              src={`/api/uitester/proxy?url=${encodeURIComponent(url)}&bridge=${encodeURIComponent(bridgeScript)}`}
              className="flex-1 w-full h-full border-none bg-white"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-downloads"
              title="UI Preview"
            />
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 gap-3 text-text-muted">
              <div className="w-12 h-12 rounded-2xl bg-accent-bg flex items-center justify-center">
                <Eye size={24} className="text-accent/50" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-text-secondary font-medium text-[12px]">No preview running</p>
                <p className="text-[11px]">Enter a URL and hit Start to preview your app</p>
              </div>
            </div>
          )}
        </div>

        {/* Console panel */}
        <AnimatePresence>
          {consoleOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 380, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-l border-border bg-bg-panel flex flex-col overflow-hidden"
            >
              {/* Console header */}
              <div className="p-2 border-b border-border flex items-center gap-2">
                <Bug size={14} className="text-accent" />
                <span className="text-[11px] font-bold text-text">Console</span>
                <span className="text-[10px] text-text-muted ml-auto">{logs.length} logs</span>
                <button onClick={clearLogs} className="p-1 rounded hover:bg-bg-hover" title="Clear"><Trash2 size={11} className="text-text-muted" /></button>
                <button onClick={exportLogs} className="p-1 rounded hover:bg-bg-hover" title="Export"><Download size={11} className="text-text-muted" /></button>
                <button onClick={() => setConsoleOpen(false)} className="p-1 rounded hover:bg-bg-hover"><X size={11} className="text-text-muted" /></button>
              </div>

              {/* Filter */}
              <div className="px-2 py-1.5 border-b border-border flex items-center gap-1">
                {(['all', 'error', 'warn', 'log'] as const).map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={`px-2 py-0.5 text-[10px] font-semibold rounded transition-all ${filter === f ? 'bg-accent text-bg' : 'text-text-secondary hover:bg-bg-hover'}`}>
                    {f.charAt(0).toUpperCase() + f.slice(1)} ({f === 'all' ? logs.length : logs.filter(l => f === 'error' ? l.stack || l.message?.toLowerCase().includes('error') : f === 'warn' ? l.message?.toLowerCase().includes('warn') : true).length})
                  </button>
                ))}
              </div>

              {/* Log list */}
              <div className="flex-1 overflow-y-auto">
                {filteredLogs.map((log) => (
                  <div key={log.id} onClick={() => setSelectedLog(log)}
                    className={`px-3 py-1.5 border-b border-border cursor-pointer hover:bg-bg-hover transition-colors ${
                      selectedLog?.id === log.id ? 'bg-accent-bg/30 border-accent/20' : ''
                    }`}>
                    <div className="flex items-start gap-2">
                      {log.stack
                        ? <AlertCircle size={11} className="text-danger shrink-0 mt-0.5" />
                        : log.message?.toLowerCase().includes('warn')
                          ? <Clock size={11} className="text-warning shrink-0 mt-0.5" />
                          : <MessageSquare size={11} className="text-text-muted shrink-0 mt-0.5" />
                      }
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-text truncate font-mono">{log.message}</div>
                        {log.source && <div className="text-[9px] text-text-muted mt-0.5">{log.source}{log.line ? `:${log.line}` : ''}</div>}
                      </div>
                      <span className="text-[9px] text-text-dim shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
                {filteredLogs.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-text-muted">
                    <Filter size={16} />
                    <span className="text-[11px] mt-2">No logs match</span>
                  </div>
                )}
              </div>

              {/* Detail panel for selected log */}
              <AnimatePresence>
                {selectedLog && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="border-t border-border bg-bg-surface overflow-hidden">
                    <div className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-text">Log Detail</span>
                        <button onClick={() => setSelectedLog(null)}><X size={11} className="text-text-muted" /></button>
                      </div>
                      <div className="text-[10px] text-text-muted font-mono bg-bg p-2 rounded border border-border">{selectedLog.message}</div>
                      {selectedLog.stack && (
                        <div className="text-[10px] text-danger font-mono bg-danger-bg p-2 rounded border border-danger/20 whitespace-pre-wrap">{selectedLog.stack}</div>
                      )}
                      <div className="flex gap-2">
                        {selectedLog.source && (
                          <button onClick={() => {
                            const store = useStore.getState();
                            store.setSelectedFile(selectedLog.source!);
                            fetch(`/api/files/content?path=${encodeURIComponent(selectedLog.source!)}`).then(r => r.json().then(d => store.setFileContent(d.content)));
                          }}
                            className="flex items-center gap-1 px-2 py-1 text-[9px] bg-bg-surface border border-border rounded hover:bg-bg-hover">
                            <ExternalLink size={10} /> Open Source
                          </button>
                        )}
                        <button onClick={async () => {
                          const provider = useStore.getState().providers.find(p => p.enabled);
                          if (!provider) return;
                          await fetch('/api/chat', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ sessionId: 'uitest-fix-' + Date.now(), content: `Fix this runtime error:\n${selectedLog.message}\n\nStack:\n${selectedLog.stack || 'N/A'}`, providerId: provider.id })
                          });
                        }} className="flex items-center gap-1 px-2 py-1 text-[9px] bg-accent-bg border border-accent/20 text-accent rounded hover:bg-accent/10">
                          <Zap size={10} /> Fix with AI
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom bar */}
      {logs.length > 0 && (
        <div className="border-t border-border px-3 py-1.5 flex items-center gap-3">
          <div className="flex items-center gap-1 text-[10px] text-danger">
            <AlertCircle size={11} /> {logs.filter(l => l.stack || l.message?.toLowerCase().includes('error')).length} errors
          </div>
          <div className="flex items-center gap-1 text-[10px] text-warning">
            <Clock size={11} /> {logs.filter(l => l.message?.toLowerCase().includes('warn')).length} warnings
          </div>
          <div className="flex items-center gap-1 text-[10px] text-text-muted ml-auto">
            <ArrowUpRight size={11} /> {logs.length} total logs
          </div>
          {!consoleOpen && (
            <button onClick={() => setConsoleOpen(true)} className="text-[10px] text-accent hover:underline">
              Show Console
            </button>
          )}
        </div>
      )}
    </div>
  );
}


