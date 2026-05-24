import { useStore } from '../stores/appStore';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { motion } from 'framer-motion';
import { FileCode, X, Copy, Check } from 'lucide-react';
import { useState } from 'react';

export default function CodeViewer() {
  const fileContent = useStore(s => s.fileContent);
  const selectedFile = useStore(s => s.selectedFile);
  const setSelectedFile = useStore(s => s.setSelectedFile);
  const setFileContent = useStore(s => s.setFileContent);
  const theme = useStore(s => s.theme);
  const [copied, setCopied] = useState(false);

  if (!selectedFile || !fileContent) return null;

  const ext = selectedFile.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
    css: 'css', scss: 'scss', html: 'html', json: 'json',
    md: 'markdown', py: 'python', go: 'go', rs: 'rust',
    java: 'java', cpp: 'cpp', c: 'c', cs: 'csharp',
    rb: 'ruby', php: 'php', sh: 'bash', yaml: 'yaml',
    yml: 'yaml', xml: 'xml', sql: 'sql',
  };

  const lang = langMap[ext] || 'text';

  const handleCopy = () => {
    navigator.clipboard.writeText(fileContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-full"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-bg-panel">
        <div className="flex items-center gap-2">
          <FileCode size={14} className="text-accent" />
          <span className="text-[11px] text-text font-mono truncate">{selectedFile}</span>
          <span className="text-[10px] text-text-muted px-1.5 py-0.5 rounded bg-bg-surface uppercase">{lang}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1.5 text-text-muted hover:text-text rounded-lg hover:bg-bg-hover transition-colors"
            title="Copy"
          >
            {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
          </button>
          <button
            onClick={() => { setSelectedFile(null); setFileContent(null); }}
            className="p-1.5 text-text-muted hover:text-danger rounded-lg hover:bg-danger-bg transition-colors"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <SyntaxHighlighter
          language={lang}
          style={oneDark}
          customStyle={{
            margin: 0,
            fontSize: '12px',
            background: theme.bg,
            minHeight: '100%',
          }}
          showLineNumbers
          lineNumberStyle={{
            fontSize: '10px',
            color: theme.textDim,
            minWidth: '3em',
            paddingRight: '1em',
          }}
        >
          {fileContent}
        </SyntaxHighlighter>
      </div>
    </motion.div>
  );
}
