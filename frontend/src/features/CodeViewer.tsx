import { useState, useCallback, useEffect } from 'react';
import { useStore } from '../stores/appStore';
import { motion, AnimatePresence } from 'framer-motion';
import { FileCode, X, Copy, Check, Save, Edit3, RotateCw } from 'lucide-react';

/* ─── Theme-aware syntax coloring (lightweight, no extra deps) ─── */
function tokenize(code: string) {
  // Very simple tokenization for syntax highlighting without Prism dependency
  const keywords = /\b(const|let|var|function|return|if|else|for|while|switch|case|break|continue|import|export|from|class|extends|async|await|try|catch|finally|throw|new|this|typeof|instanceof|interface|type|enum|true|false|null|undefined)\b/g;
  const strings = /("[^"]*"|'[^']*'|`[^`]*`)/g;
  const comments = /(\/\/.*|\/\*[\s\S]*?\*\/|#.*)/g;
  const numbers = /\b\d+\.?\d*\b/g;
  const functions = /\b([a-zA-Z_]\w*)(?=\()/g;

  let html = code
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(comments, m => `\u003cspan style="color:#888;font-style:italic"\u003e${m}\u003c/span\u003e`)
    .replace(strings, m => `\u003cspan style="color:#84cc16"\u003e${m}\u003c/span\u003e`)
    .replace(keywords, m => `\u003cspan style="color:#60a5fa;font-weight:600"\u003e${m}\u003c/span\u003e`)
    .replace(numbers, m => `\u003cspan style="color:#fbbf24"\u003e${m}\u003c/span\u003e`)
    .replace(functions, m => `\u003cspan style="color:#c084fc"\u003e${m}\u003c/span\u003e`);
  return html;
}

export default function CodeViewer() {
  const fileContent   = useStore(s => s.fileContent);
  const selectedFile  = useStore(s => s.selectedFile);
  const setSelectedFile = useStore(s => s.setSelectedFile);
  const setFileContent= useStore(s => s.setFileContent);
  const theme         = useStore(s => s.theme);
  const [editMode,    setEditMode]    = useState(false);
  const [draft,       setDraft]       = useState('');
  const [saving,      setSaving]      = useState(false);
  const [copied,      setCopied]      = useState(false);
  const [justOpened,  setJustOpened]   = useState(false);

  /* open animation */
  useEffect(() => {
    if (selectedFile) { setJustOpened(true); const t = setTimeout(() => setJustOpened(false), 500); return () => clearTimeout(t); }
  }, [selectedFile]);

  /* keep draft in sync */
  useEffect(() => { if (fileContent !== null) setDraft(fileContent); }, [fileContent]);

  if (!selectedFile) return null;

  const ext = selectedFile.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    ts:'typescript', tsx:'tsx', js:'javascript', jsx:'jsx',
    css:'css', scss:'scss', html:'html', json:'json',
    md:'markdown', py:'python', go:'go', rs:'rust',
    java:'java', cpp:'cpp', c:'c', cs:'csharp',
    rb:'ruby', php:'php', sh:'bash', yaml:'yaml',
    yml:'yaml', xml:'xml', sql:'sql',
  };
  const lang = langMap[ext] || 'text';

  const handleCopy = () => { navigator.clipboard.writeText(fileContent || ''); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const handleSave = useCallback(async () => {
    if (!selectedFile) return;
    setSaving(true);
    try {
      await fetch('/api/files/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedFile, content: draft }),
      });
      setFileContent(draft);
      setEditMode(false);
    } finally { setSaving(false); }
  }, [selectedFile, draft, setFileContent]);

  const handleReload = async () => {
    if (!selectedFile) return;
    try {
      const r = await fetch(`/api/files/content?path=${encodeURIComponent(selectedFile)}`);
      const d = await r.json();
      if (d.content !== undefined) { setFileContent(d.content); setDraft(d.content); }
    } catch {}
  };

  const lines = fileContent?.split('\n') || [];

  return (
    <motion.div
      key={selectedFile}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-bg-panel">
        <div className="flex items-center gap-2">
          <FileCode size={14} className="text-accent" />
          <span className="text-[11px] text-text font-mono truncate" title={selectedFile}>{selectedFile.split('/').pop()}</span>
          <span className="text-[10px] text-text-muted px-1.5 py-0.5 rounded bg-bg-surface uppercase">{lang}</span>
          {justOpened && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 1] }}
              transition={{ duration: 0.6 }}
              className="w-2 h-2 rounded-full bg-accent"
            />
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleReload} className="p-1.5 text-text-muted hover:text-text rounded-lg hover:bg-bg-hover transition-colors" title="Reload from disk">
            <RotateCw size={13} />
          </button>
          {!editMode && (
            <button onClick={() => setEditMode(true)} className="p-1.5 text-text-muted hover:text-accent rounded-lg hover:bg-bg-hover transition-colors" title="Edit">
              <Edit3 size={13} />
            </button>
          )}
          {editMode && (
            <button onClick={handleSave} disabled={saving} className="p-1.5 text-accent hover:text-bg hover:bg-accent rounded-lg transition-colors disabled:opacity-40" title="Save">
              <Save size={13} />
            </button>
          )}
          <button onClick={handleCopy} className="p-1.5 text-text-muted hover:text-text rounded-lg hover:bg-bg-hover transition-colors" title="Copy">
            {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
          </button>
          <button onClick={() => { setSelectedFile(null); setFileContent(null); setEditMode(false); }} className="p-1.5 text-text-muted hover:text-danger rounded-lg hover:bg-danger-bg transition-colors" title="Close">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto relative">
        <AnimatePresence mode="wait">
          {editMode ? (
            <motion.textarea
              key="edit"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              className="w-full min-h-full bg-bg text-text font-mono text-[12px] p-3 leading-relaxed focus:outline-none resize-none"
              spellCheck={false}
              autoComplete="off"
            />
          ) : (
            <motion.div
              key="view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="w-full min-h-full p-0"
            >
              <pre className="font-mono text-[12px] leading-relaxed m-0"
                style={{ background: theme.bg, color: theme.text, tabSize: 2 }}
              >
                {lines.map((line, idx) => (
                  <div key={idx} className="flex hover:bg-bg-hover/30 transition-colors"
                    style={{ minHeight: '1.5em' }}
                  >
                    <span className="select-none text-right pr-3 pl-2 shrink-0"
                      style={{ width: '3.5em', color: theme.textDim, fontSize: '10px', lineHeight: '1.8em' }}
                    >
                      {idx + 1}
                    </span>
                    <span className="flex-1 whitespace-pre pl-1"
                      dangerouslySetInnerHTML={{ __html: tokenize(line) || '<br/>' }}
                    />
                  </div>
                ))}
              </pre>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
