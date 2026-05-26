import { useState, useEffect, useRef } from 'react';
import { FileCode, FileEdit, Trash2, Search } from 'lucide-react';

interface ChangeItem {
  id: string;
  filePath: string;
  changeType: 'add' | 'modify' | 'remove' | 'rename';
  oldContent: string;
  newContent: string;
  timestamp: string;
  reason: string;
  status: 'pending' | 'applied' | 'reverted';
  fileContent?: string;
}

export default function CodeView() {
  const [changes, setChanges] = useState<ChangeItem[]>([]);
  const [selectedChange, setSelectedChange] = useState<ChangeItem | null>(null);
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'add' | 'modify' | 'remove'>('all');
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Listen for changes from WebSocket (broadcast from backend)
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3001');
    wsRef.current = ws;

    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => setWsConnected(false);
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'change' && msg.data) {
          const change = msg.data;
          const newChange: ChangeItem = {
            id: change.changeId || String(Date.now()),
            filePath: change.filePath,
            changeType: change.changeType || 'modify',
            oldContent: change.oldContent || '',
            newContent: change.newContent || '',
            timestamp: new Date().toISOString(),
            reason: 'AI Edit',
            status: 'applied',
            fileContent: change.fileContent,
          };
          setChanges(prev => [newChange, ...prev].slice(0, 200));
        }
      } catch (e) {
        // ignore
      }
    };

    return () => ws.close();
  }, []);

  const filtered = changes.filter(c => {
    if (typeFilter !== 'all' && c.changeType !== typeFilter) return false;
    if (filter && !c.filePath.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  });

  const getDiff = (change: ChangeItem) => {
    if (!change.oldContent && !change.newContent) return null;
    if (!change.oldContent) return { lines: change.newContent.split('\n').map((l: string, i: number) => ({ num: i + 1, type: 'add', text: l })) };
    if (!change.newContent) return { lines: change.oldContent.split('\n').map((l: string, i: number) => ({ num: i + 1, type: 'remove', text: l })) };
    
    const oldLines = change.oldContent.split('\n');
    const newLines = change.newContent.split('\n');
    const maxLen = Math.max(oldLines.length, newLines.length);
    const result = [];
    for (let i = 0; i < maxLen; i++) {
      if (oldLines[i] === newLines[i]) {
        result.push({ num: i + 1, type: 'same', text: oldLines[i] || '' });
      } else {
        if (oldLines[i]) result.push({ num: i + 1, type: 'remove', text: oldLines[i] });
        if (newLines[i]) result.push({ num: i + 1, type: 'add', text: newLines[i] });
      }
    }
    return { lines: result };
  };

  const clearChanges = () => {
    setChanges([]);
    setSelectedChange(null);
  };

  return (
    <div className="flex flex-col h-full bg-bg text-text">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-border bg-bg-panel">
        <div className="flex items-center gap-2">
          <FileCode size={16} className="text-accent" />
          <span className="text-[13px] font-bold text-text-heading">CodeView</span>
          <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-success' : 'bg-danger'}`} />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center text-[10px] gap-1">
            <span className="px-1.5 py-0.5 rounded bg-success-bg text-success">{changes.filter(c => c.changeType === 'add').length} added</span>
            <span className="px-1.5 py-0.5 rounded bg-accent-bg text-accent">{changes.filter(c => c.changeType === 'modify').length} modified</span>
            <span className="px-1.5 py-0.5 rounded bg-danger-bg text-danger">{changes.filter(c => c.changeType === 'remove').length} removed</span>
          </div>
          <button onClick={clearChanges} className="p-1.5 text-text-muted hover:text-danger hover:bg-danger-bg rounded-lg transition-colors" title="Clear changes">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Change list */}
        <div className="w-80 shrink-0 border-r border-border bg-bg-panel overflow-y-auto">
          <div className="p-2 space-y-2">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-dim" />
              <input
                type="text"
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder="Filter files..."
                className="w-full pl-7 pr-2 py-1 text-[11px] bg-bg-surface border border-border rounded-lg text-text placeholder:text-text-dim focus:outline-none focus:border-accent"
              />
            </div>
            <div className="flex items-center gap-1">
              {(['all', 'add', 'modify', 'remove'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`px-2 py-0.5 rounded text-[9px] font-medium transition-colors ${
                    typeFilter === t ? 'bg-accent-bg text-accent border border-accent/40' : 'bg-bg-surface text-text-secondary border border-border'
                  }`}
                >
                  {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-border/40">
            {filtered.map(change => (
              <button
                key={change.id}
                onClick={() => setSelectedChange(change)}
                className={`w-full text-left px-3 py-2.5 hover:bg-bg-hover transition-colors ${
                  selectedChange?.id === change.id ? 'bg-accent-bg/10 border-l-2 border-l-accent' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${
                    change.changeType === 'add' ? 'bg-success' : change.changeType === 'remove' ? 'bg-danger' : 'bg-accent'
                  }`} />
                  <span className="text-[10px] font-mono text-text truncate flex-1">{change.filePath}</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5 ml-3">
                  <span className={`text-[8px] px-1 rounded ${
                    change.changeType === 'add' ? 'bg-success-bg text-success' : change.changeType === 'remove' ? 'bg-danger-bg text-danger' : 'bg-accent-bg text-accent'
                  }`}>
                    {change.changeType}
                  </span>
                  <span className="text-[9px] text-text-dim">{new Date(change.timestamp).toLocaleTimeString()}</span>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-4 py-8 text-center">
                <FileCode size={24} className="text-text-dim mx-auto mb-2" />
                <p className="text-[12px] text-text-muted">No code changes yet.</p>
                <p className="text-[10px] text-text-dim mt-1">AI edits will appear here in real-time.</p>
              </div>
            )}
          </div>
        </div>

        {/* Detail view */}
        <div className="flex-1 overflow-y-auto p-4">
          {selectedChange ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                    selectedChange.changeType === 'add' ? 'bg-success-bg text-success' : selectedChange.changeType === 'remove' ? 'bg-danger-bg text-danger' : 'bg-accent-bg text-accent'
                  }`}>
                    {selectedChange.changeType.toUpperCase()}
                  </span>
                  <span className="text-[12px] font-mono text-text-heading">{selectedChange.filePath}</span>
                </div>
                <span className="text-[10px] text-text-muted">{new Date(selectedChange.timestamp).toLocaleString()}</span>
              </div>

              <div className="bg-bg-panel border border-border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-bg-surface">
                  <span className="text-[10px] font-medium text-text-muted">Diff</span>
                </div>
                <div className="font-mono text-[11px] overflow-x-auto">
                  {getDiff(selectedChange)?.lines.map((line: any, i: number) => (
                    <div
                      key={i}
                      className={`px-3 py-0.5 flex items-start gap-2 ${
                        line.type === 'add' ? 'bg-success-bg/20' : line.type === 'remove' ? 'bg-danger-bg/20' : ''
                      }`}
                    >
                      <span className={`shrink-0 w-5 text-right text-[9px] ${
                        line.type === 'add' ? 'text-success' : line.type === 'remove' ? 'text-danger' : 'text-text-muted'
                      }`}>
                        {line.num}
                      </span>
                      <span className="text-text-dim select-none">{line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}</span>
                      <span className={`flex-1 whitespace-pre ${
                        line.type === 'add' ? 'text-success' : line.type === 'remove' ? 'text-danger' : 'text-text'
                      }`}>
                        {line.text}
                      </span>
                    </div>
                  )) || <div className="px-3 py-2 text-text-dim text-[11px]">No diff available.</div>}
                </div>
              </div>

              {selectedChange.fileContent && (
                <div className="bg-bg-panel border border-border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-bg-surface">
                    <span className="text-[10px] font-medium text-text-muted">Current File Content</span>
                  </div>
                  <pre className="p-3 text-[10px] text-text-muted font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">{selectedChange.fileContent}</pre>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-text-muted">
              <FileEdit size={32} className="mb-3 opacity-30" />
              <p className="text-[13px] font-medium">Select a change to view details</p>
              <p className="text-[11px] opacity-60 mt-1">Click on any file change from the list to see the diff</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
