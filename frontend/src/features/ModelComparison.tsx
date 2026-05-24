import { useState } from 'react';
import { useStore } from '../stores/appStore';
import { chatApi } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, Play, Clock, MessageSquare, Zap, Trophy } from 'lucide-react';

export default function ModelComparison() {
  const providers = useStore(s => s.providers);
  const [results, setResults] = useState<any[]>([]);
  const [prompt, setPrompt] = useState('Explain quantum computing in simple terms');
  const [running, setRunning] = useState(false);
  const [selectedResult, setSelectedResult] = useState<any>(null);

  const enabledProviders = providers.filter(p => p.enabled);

  const runComparison = async () => {
    if (enabledProviders.length === 0 || !prompt.trim()) return;
    setRunning(true);
    setResults([]);
    setSelectedResult(null);

    const initialResults = enabledProviders.map(p => ({
      provider: p.name, model: p.defaultModel, response: '', latency: 0, tokens: 0, status: 'pending',
    }));
    setResults(initialResults);

    for (let i = 0; i < enabledProviders.length; i++) {
      const p = enabledProviders[i];
      setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'running' } : r));
      const start = Date.now();
      try {
        const session = await (await fetch('/api/sessions', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Comparison', providerId: p.id, model: p.defaultModel }),
        })).json();
        const res = await chatApi.send({ sessionId: session.id, content: prompt, providerId: p.id });
        const latency = Date.now() - start;
        const assistantMsg = res.messages?.find((m: any) => m.role === 'assistant');
        setResults(prev => prev.map((r, idx) => idx === i ? {
          ...r, response: assistantMsg?.content || 'No response', latency,
          tokens: assistantMsg?.content?.length || 0, status: 'done',
        } : r));
      } catch (err) {
        setResults(prev => prev.map((r, idx) => idx === i ? {
          ...r, error: (err as Error).message, status: 'error',
        } : r));
      }
    }
    setRunning(false);
  };

  const bestLatency = results.filter(r => r.status === 'done').sort((a, b) => a.latency - b.latency)[0];

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border space-y-3">
        <div className="flex items-center gap-2">
          <Cpu size={16} className="text-accent" />
          <span className="font-bold text-sm text-text-heading">Model Arena</span>
          <span className="ml-auto text-[10px] text-text-muted px-2 py-1 rounded bg-bg-surface">{enabledProviders.length} providers enabled</span>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="text-[10px] text-text-muted uppercase tracking-wider font-bold mb-1 block">Test Prompt</label>
            <input value={prompt} onChange={e => setPrompt(e.target.value)} className="w-full bg-bg-surface border border-border rounded-lg px-3 py-2 text-[11px] text-text focus:outline-none focus:border-accent transition-colors" />
          </div>
          <button onClick={runComparison} disabled={running || enabledProviders.length === 0} className="px-4 py-2 bg-accent text-bg text-[12px] font-bold rounded-xl hover:opacity-90 disabled:opacity-30 transition-all flex items-center gap-2">
            <Play size={14} /> {running ? 'Running...' : 'Compare'}
          </button>
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 border-r border-border overflow-y-auto">
          {results.length === 0 && !running && (
            <div className="flex flex-col items-center justify-center h-full gap-2 p-4">
              <Trophy size={24} className="text-text-dim" />
              <span className="text-[11px] text-text-muted text-center">Run a comparison to see results</span>
            </div>
          )}
          {results.map((result, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
              onClick={() => setSelectedResult(result)}
              className={`p-3 border-b border-border cursor-pointer transition-colors ${selectedResult === result ? 'bg-accent-bg border-l-2 border-l-accent' : 'hover:bg-bg-hover'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-[11px] text-text">{result.provider}</span>
                {result === bestLatency && result.status === 'done' && <Zap size={10} className="text-accent" />}
                <span className={`ml-auto text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                  result.status === 'done' ? 'bg-success/10 text-success' : result.status === 'error' ? 'bg-danger-bg text-danger' : result.status === 'running' ? 'bg-accent-bg text-accent animate-pulse' : 'bg-bg-surface text-text-muted'
                }`}>{result.status}</span>
              </div>
              <div className="text-[10px] text-text-muted">{result.model}</div>
              {result.status === 'done' && (
                <div className="flex items-center gap-3 mt-1.5 text-[10px]">
                  <span className="flex items-center gap-1 text-text-secondary"><Clock size={10} /> {result.latency}ms</span>
                  <span className="flex items-center gap-1 text-text-secondary"><MessageSquare size={10} /> {result.tokens} chars</span>
                </div>
              )}
            </motion.div>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <AnimatePresence mode="wait">
            {selectedResult ? (
              <motion.div key={selectedResult.provider} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-bold text-sm text-text-heading">{selectedResult.provider}</span>
                  <span className="text-[11px] text-text-muted">{selectedResult.model}</span>
                </div>
                {selectedResult.error ? (
                  <div className="p-3 rounded-lg bg-danger-bg border border-danger/20 text-danger text-[11px]">{selectedResult.error}</div>
                ) : (
                  <>
                    <div className="flex items-center gap-4 mb-3 text-[11px]">
                      <span className="flex items-center gap-1.5 text-text-secondary"><Clock size={12} /> Latency: <span className="font-mono text-text">{selectedResult.latency}ms</span></span>
                      <span className="flex items-center gap-1.5 text-text-secondary"><MessageSquare size={12} /> Tokens: <span className="font-mono text-text">{selectedResult.tokens}</span></span>
                    </div>
                    <div className="bg-bg-surface border border-border rounded-xl p-4">
                      <pre className="text-[12px] text-text-secondary whitespace-pre-wrap leading-relaxed">{selectedResult.response}</pre>
                    </div>
                  </>
                )}
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full gap-3 text-text-muted">
                <Cpu size={32} className="text-text-dim" />
                <p className="text-[11px]">Select a result to view details</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
