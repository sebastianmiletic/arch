import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TestTube, Play, CheckCircle, AlertCircle, Clock, BarChart3, RotateCw, Zap, Search, FileCode, Sparkles, ChevronDown, ChevronRight, Layout, Shield, Cpu, Globe, Eye } from 'lucide-react';
import { useStore } from '../stores/appStore';
import type { TestResult, TestIssue } from '../types';

const SCORE_LABELS: Record<string, { label: string; icon: any }> = {
  structure: { label: 'Structure', icon: Layout },
  security: { label: 'Security', icon: Shield },
  performance: { label: 'Performance', icon: Cpu },
  accessibility: { label: 'Accessibility', icon: Eye },
  quality: { label: 'Code Quality', icon: FileCode },
  ui: { label: 'UI / UX', icon: Layout },
  dependencies: { label: 'Dependencies', icon: Globe },
};

export default function TestingDashboard() {
  const projectRoot = useStore(s => s.projectRoot);
  const setSelectedFile = useStore(s => s.setSelectedFile);
  const setFileContent = useStore(s => s.setFileContent);
  const [result, setResult] = useState<TestResult | null>(null);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<'quick' | 'standard' | 'deep'>('standard');
  const [filter, setFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [fixing, setFixing] = useState<string | null>(null);

  const runTests = async () => {
    const root = projectRoot || (window as any).__PROJECT_ROOT__ || '/Users/sebastianmiletic/Arch';
    setRunning(true); setError(null); setResult(null);
    try {
      const res = await fetch('/api/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ root, mode }) });
      if (!res.ok) throw new Error(await res.text());
      setResult(await res.json());
    } catch (err) { setError((err as Error).message); }
    finally { setRunning(false); }
  };

  const filteredIssues = result?.issues.filter(t => {
    if (filter === 'all') return true;
    if (filter === 'critical') return t.severity === 'critical';
    if (filter === 'error') return t.severity === 'error';
    if (filter === 'warning') return t.severity === 'warning';
    return t.category === filter;
  }) || [];

  const categories = [...new Set(result?.issues.map(t => t.category) || [])];

  const severityOrder = { critical: 0, error: 1, warning: 2, info: 3 };
  const byFile = new Map<string, TestIssue[]>();
  filteredIssues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  for (const i of filteredIssues) {
    const key = i.file || 'Unknown file';
    if (!byFile.has(key)) byFile.set(key, []);
    byFile.get(key)!.push(i);
  }

  const toggleFile = (f: string) => {
    const s = new Set(expandedFiles);
    if (s.has(f)) s.delete(f); else s.add(f);
    setExpandedFiles(s);
  };

  const openFileAtLine = async (file: string, _line?: number) => {
    setSelectedFile(file);
    try {
      const res = await fetch(`/api/files/content?path=${encodeURIComponent(file)}`);
      if (res.ok) {
        const data = await res.json();
        setFileContent(data.content);
      }
    } catch { setFileContent('// Unable to load'); }
  };

  const fixWithAI = async (issueId: string, fixSuggestion: string, file?: string) => {
    setFixing(issueId);
    const provider = useStore.getState().providers.find(p => p.enabled);
    if (!provider) { setFixing(null); return; }
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 'test-fix-' + Date.now(), content: `Fix this issue in ${file || 'project'}:\n${fixSuggestion}`, providerId: provider.id }),
      });
      await res.json();
      setResult(prev => prev ? { ...prev, issues: prev.issues.map(i => i.id === issueId ? { ...i, severity: 'info' } : i) } : null);
    } finally { setFixing(null); }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border space-y-3">
        <div className="flex items-center gap-2">
          <TestTube size={16} className="text-accent" />
          <span className="font-bold text-sm text-text-heading">Testing Engine</span>
          <span className="ml-auto text-[10px] text-text-muted px-2 py-1 rounded bg-bg-surface">
            {result ? `${result.overallScore}/100` : 'Ready'}
          </span>
        </div>
        <p className="text-[11px] text-text-muted">Scans project structure, security, performance, code quality, UI/UX, dependencies.</p>
        <div className="flex items-center gap-2">
          {(['quick', 'standard', 'deep'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg border transition-all ${mode === m ? 'bg-accent text-bg border-accent' : 'border-border text-text-secondary hover:bg-bg-hover'}`}>
              {m === 'quick' && <Zap size={12} />}{m === 'standard' && <CheckCircle size={12} />}{m === 'deep' && <Search size={12} />}{m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
          <div className="flex-1" />
          <button onClick={runTests} disabled={running}
            className="px-4 py-1.5 bg-accent text-bg text-[11px] font-bold rounded-lg hover:opacity-90 disabled:opacity-30 transition-all flex items-center gap-2">
            <Play size={12} /> {running ? 'Scanning...' : `Run ${mode}`}
          </button>
        </div>
        {error && (
          <div className="flex items-center gap-1.5 p-2 rounded-lg bg-danger-bg border border-danger/20">
            <AlertCircle size={12} className="text-danger" />
            <span className="text-[10px] text-danger">{error}</span>
          </div>
        )}
      </div>

      {running && (
        <div className="flex flex-col items-center justify-center flex-1 gap-3">
          <RotateCw size={24} className="text-accent animate-spin" />
          <p className="text-[11px] text-text-muted">Scanning project files and running tests...</p>
        </div>
      )}

      {!running && !result && !error && (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-text-muted">
          <div className="w-12 h-12 rounded-2xl bg-accent-bg flex items-center justify-center">
            <TestTube size={24} className="text-accent/50" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-text-secondary font-medium text-[12px]">No tests run yet</p>
            <p className="text-[11px]">Select a mode and hit Run to scan your project</p>
          </div>
          <div className="text-[10px] text-text-dim max-w-sm text-center mt-2">
            <strong>Quick</strong>: structure only · <strong>Standard</strong>: + security, quality, UI · <strong>Deep</strong>: + performance, accessibility, dependencies
          </div>
        </div>
      )}

      {result && !running && (
        <>
          {/* Score cards */}
          <div className="p-3 border-b border-border">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 size={14} className="text-accent" />
              <span className="text-[11px] font-bold text-text">Overall Score</span>
              <span className={`ml-auto text-lg font-bold ${result.overallScore >= 80 ? 'text-success' : result.overallScore >= 50 ? 'text-warning' : 'text-danger'}`}>{result.overallScore}/100</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(result.scores).map(([key, score]) => {
                const meta = SCORE_LABELS[key] || { label: key, icon: CheckCircle };
                const I = meta.icon;
                return (
                  <div key={key} className="p-2 rounded-xl border border-border bg-bg-surface">
                    <div className="flex items-center gap-1 mb-1">
                      <I size={11} className={score >= 80 ? 'text-success' : score >= 50 ? 'text-warning' : 'text-danger'} />
                      <span className="text-[10px] text-text-muted font-medium">{meta.label}</span>
                    </div>
                    <div className={`text-base font-bold ${score >= 80 ? 'text-success' : score >= 50 ? 'text-warning' : 'text-danger'}`}>{score}</div>
                    <div className="w-full h-1.5 rounded-full bg-border mt-1">
                      <div className={`h-full rounded-full transition-all ${score >= 80 ? 'bg-success' : score >= 50 ? 'bg-warning' : 'bg-danger'}`} style={{ width: `${score}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Filters */}
          <div className="px-3 pt-2 flex items-center gap-1 flex-wrap">
            {['all', 'critical', 'error', 'warning'].map(f => (
              <button key={f} onClick={() => setFilter(f === filter ? 'all' : f)}
                className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all ${filter === f ? 'bg-accent text-bg' : 'text-text-secondary hover:bg-bg-hover'}`}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
            <div className="w-px h-4 bg-border mx-1" />
            {categories.map(cat => (
              <button key={cat} onClick={() => setFilter(filter === cat ? 'all' : cat)}
                className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all ${filter === cat ? 'bg-accent-bg text-accent border border-accent/20' : 'text-text-secondary hover:bg-bg-hover'}`}>
                {cat}
              </button>
            ))}
          </div>

          {/* Issues by file */}
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            {Array.from(byFile.entries()).map(([file, issues]) => {
              const isOpen = expandedFiles.has(file);
              const critical = issues.filter(i => i.severity === 'critical').length;
              const errors = issues.filter(i => i.severity === 'error').length;
              const warnings = issues.filter(i => i.severity === 'warning').length;
              return (
                <div key={file} className="border border-border rounded-xl mb-2 overflow-hidden">
                  <button onClick={() => toggleFile(file)} className="w-full flex items-center justify-between px-3 py-2 bg-bg-surface hover:bg-bg-hover transition-colors">
                    <div className="flex items-center gap-2">
                      {isOpen ? <ChevronDown size={13} className="text-text-muted" /> : <ChevronRight size={13} className="text-text-muted" />}
                      <FileCode size={13} className="text-accent" />
                      <span className="text-[11px] font-semibold text-text truncate font-mono">{file}</span>
                      <div className="flex items-center gap-1">
                        {critical > 0 && <Badge count={critical} color="bg-danger" />}
                        {errors > 0 && <Badge count={errors} color="bg-danger" style="bg-opacity-70" />}
                        {warnings > 0 && <Badge count={warnings} color="bg-warning" />}
                      </div>
                    </div>
                    <span className="text-[10px] text-text-muted">{issues.length} {issues.length === 1 ? 'issue' : 'issues'}</span>
                  </button>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                        <div className="divide-y divide-border">
                          {issues.map((issue) => (
                            <div key={issue.id} className="px-3 py-2.5 hover:bg-bg-hover transition-colors">
                              <div className="flex items-start gap-2">
                                {issue.severity === 'critical' && <AlertCircle size={13} className="text-danger shrink-0 mt-0.5" />}
                                {issue.severity === 'error' && <AlertCircle size={13} className="text-danger/70 shrink-0 mt-0.5" />}
                                {issue.severity === 'warning' && <Clock size={13} className="text-warning shrink-0 mt-0.5" />}
                                {issue.severity === 'info' && <CheckCircle size={13} className="text-success shrink-0 mt-0.5" />}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[11px] font-medium text-text">{issue.message}</span>
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-bg-hover text-text-muted">{issue.category}</span>
                                    {issue.line && <span className="text-[9px] font-mono text-text-muted">L{issue.line}{issue.column ? `:${issue.column}` : ''}</span>}
                                  </div>
                                  <p className="text-[10px] text-text-muted mt-1">{issue.fixSuggestion}</p>
                                  <div className="flex items-center gap-2 mt-2">
                                    <button onClick={() => openFileAtLine(file, issue.line)}
                                      className="flex items-center gap-1 px-2 py-1 text-[9px] bg-bg-surface border border-border rounded hover:bg-bg-hover transition-colors">
                                      <Eye size={10} /> Open
                                    </button>
                                    <button onClick={() => fixWithAI(issue.id, file, issue.fixSuggestion)}
                                      disabled={fixing === issue.id}
                                      className="flex items-center gap-1 px-2 py-1 text-[9px] bg-accent-bg border border-accent/20 text-accent rounded hover:bg-accent/10 transition-colors disabled:opacity-50">
                                      <Sparkles size={10} /> {fixing === issue.id ? 'Fixing...' : 'Fix with AI'}
                                    </button>
                                  </div>
                                </div>
                                <span className="text-[10px] text-text-muted">-{issue.scoreImpact}pts</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
            {filteredIssues.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-text-muted">
                <CheckCircle size={20} className="text-success" />
                <span className="text-[11px]">No issues match this filter — great work!</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Badge({ count, color, style }: { count: number; color: string; style?: string }) {
  return <span className={`px-1 py-0.5 rounded text-[9px] font-bold text-bg ${color} ${style || ''}`}>{count}</span>;
}
