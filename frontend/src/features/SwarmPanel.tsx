import { useState, useCallback } from 'react';
import { useStore } from '../stores/appStore';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Play, Pause, Clock, ChevronDown,
  Copy, Check
} from 'lucide-react';
import type { SwarmJob } from '../types';

export default function SwarmPanel() {
  const agents = useStore(s => s.swarmAgents);
  const jobs = useStore(s => s.swarmJobs);
  const addJob = useStore(s => s.addSwarmJob);
  const providers = useStore(s => s.providers);

  const [prompt, setPrompt] = useState('');
  const [selectedAgents, setSelectedAgents] = useState<string[]>(agents.filter(a => a.active).map(a => a.id));
  const [running, setRunning] = useState(false);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggleAgent = (id: string) => {
    setSelectedAgents(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const runSwarm = useCallback(async () => {
    if (!prompt.trim() || selectedAgents.length === 0) return;
    setRunning(true);

    const job: SwarmJob = {
      id: Date.now().toString(),
      prompt,
      agents: selectedAgents,
      status: 'running',
      results: [],
      createdAt: new Date().toISOString(),
    };
    addJob(job);

    try {
      const selectedAgentConfigs = agents.filter(a => selectedAgents.includes(a.id));
      const res = await fetch('/api/swarm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, agentIds: selectedAgents, agents: selectedAgentConfigs }),
      });
      const data = await res.json();
      if (data.results) {
        addJob({ ...job, status: 'done', results: data.results, completedAt: new Date().toISOString() });
      }
    } catch {
      addJob({ ...job, status: 'error', completedAt: new Date().toISOString() });
    }

    setRunning(false);
  }, [prompt, selectedAgents, addJob]);

  const activeAgents = agents.filter(a => selectedAgents.includes(a.id));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <Users size={16} className="text-accent" />
          <span className="font-bold text-sm text-text-heading">Swarm Engine</span>
          <span className="ml-auto text-[10px] text-text-muted px-2 py-1 rounded bg-bg-surface">
            {activeAgents.length} agents active
          </span>
        </div>
        <p className="text-[11px] text-text-muted">
          Dispatch a single prompt to multiple models simultaneously — each with a specialized role.
        </p>
      </div>

      {/* Agent selector */}
      <div className="px-3 py-2 border-b border-border shrink-0">
        <div className="text-[10px] text-text-muted uppercase tracking-wider font-bold mb-1.5">Select Agents</div>
        <div className="flex flex-wrap gap-1.5">
          {agents.map(agent => {
            const prov = providers.find(p => p.id === agent.providerId);
            const isActive = selectedAgents.includes(agent.id);
            return (
              <button
                key={agent.id}
                onClick={() => toggleAgent(agent.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border transition-all ${
                  isActive
                    ? 'border-transparent text-bg'
                    : 'border-border bg-bg-surface text-text-secondary hover:bg-bg-hover'
                }`}
                style={isActive ? { background: agent.color, borderColor: agent.color } : undefined}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: agent.color }} />
                {agent.name}
                <span className="opacity-60 text-[10px]">{prov?.name || agent.providerId}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Prompt + Run */}
      <div className="p-3 border-b border-border shrink-0">
        <div className="flex items-end gap-2">
          <div className="flex-1 bg-bg-surface border border-border rounded-xl p-2.5 focus-within:border-accent transition-colors">
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Describe the task — each selected agent will receive this prompt plus their role-specific system prompt..."
              rows={3}
              className="w-full bg-transparent text-[11px] text-text placeholder:text-text-dim focus:outline-none resize-none"
            />
          </div>
          <button
            onClick={runSwarm}
            disabled={running || !prompt.trim() || selectedAgents.length === 0}
            className="px-4 py-3 bg-accent text-bg text-[12px] font-bold rounded-xl hover:opacity-90 disabled:opacity-20 transition-all flex items-center gap-2 shrink-0"
          >
            {running ? <Pause size={14} /> : <Play size={14} />}
            {running ? 'Running...' : 'Run Swarm'}
          </button>
        </div>
      </div>

      {/* Jobs */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {jobs.length === 0 && !running && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-text-muted">
            <div className="w-12 h-12 rounded-2xl bg-accent-bg flex items-center justify-center">
              <Users size={24} className="text-accent/50" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-text-secondary font-medium text-[12px]">No swarm jobs yet</p>
              <p className="text-[11px]">Select agents, write a prompt, and hit Run</p>
            </div>
          </div>
        )}

        {jobs.map((job, i) => (
          <motion.div
            key={job.id}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="border border-border rounded-xl bg-bg-surface overflow-hidden"
          >
            <div
              onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
              className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-bg-hover transition-colors"
            >
              <span className={`w-2 h-2 rounded-full ${
                job.status === 'done' ? 'bg-success' : job.status === 'error' ? 'bg-danger' : job.status === 'running' ? 'bg-warning animate-pulse' : 'bg-text-muted'
              }`} />
              <span className="text-[11px] text-text font-mono truncate flex-1">{job.prompt.slice(0, 80)}{job.prompt.length > 80 ? '...' : ''}</span>
              <span className="text-[10px] text-text-muted">{job.agents.length} agents</span>
              <span className="text-[10px] text-text-muted">{new Date(job.createdAt).toLocaleTimeString()}</span>
              <ChevronDown size={12} className={`text-text-muted transition-transform ${expandedJob === job.id ? 'rotate-180' : ''}`} />
            </div>

            <AnimatePresence>
              {expandedJob === job.id && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-3 pb-3 space-y-2">
                    {job.results.length === 0 && job.status === 'running' && (
                      <div className="flex items-center gap-2 py-2 text-[11px] text-text-muted">
                        <div className="w-4 h-4 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
                        Agents are working...
                      </div>
                    )}
                    {job.results.map((result, ri) => {
                      const agent = agents.find(a => a.id === result.agentId);
                      if (!agent) return null;
                      return (
                        <motion.div
                          key={ri}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: ri * 0.1 }}
                          className="border border-border rounded-lg overflow-hidden"
                        >
                          <div className="flex items-center gap-2 px-3 py-2 border-b border-border" style={{ background: `${agent.color}10` }}>
                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: agent.color }} />
                            <span className="text-[11px] font-bold" style={{ color: agent.color }}>{agent.name}</span>
                            <span className="text-[10px] text-text-muted">{agent.role}</span>
                            <span className="ml-auto text-[10px] text-text-muted flex items-center gap-1">
                              <Clock size={10} /> {result.latency}ms
                            </span>
                            <span className="text-[10px] text-text-muted">{result.tokens} tokens</span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(result.content);
                                setCopiedId(`${job.id}-${ri}`);
                                setTimeout(() => setCopiedId(null), 2000);
                              }}
                              className="text-text-muted hover:text-text"
                            >
                              {copiedId === `${job.id}-${ri}` ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                            </button>
                          </div>
                          <div className="p-3 text-[11px] text-text-secondary whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                            {result.content}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
