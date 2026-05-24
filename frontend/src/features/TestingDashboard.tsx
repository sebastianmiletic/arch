import { useState } from 'react';

import { motion } from 'framer-motion';
import { TestTube, Play, CheckCircle, AlertCircle, Clock, BarChart3, RotateCw } from 'lucide-react';

interface TestRun {
  id: string;
  name: string;
  status: 'passed' | 'failed' | 'pending' | 'skipped';
  duration: number;
  timestamp: string;
  error?: string;
  category: string;
}

const demoTests: TestRun[] = [
  { id: '1', name: 'App renders without crashing', status: 'passed', duration: 124, timestamp: new Date().toISOString(), category: 'rendering' },
  { id: '2', name: 'File tree loads correctly', status: 'passed', duration: 340, timestamp: new Date().toISOString(), category: 'integration' },
  { id: '3', name: 'Chat message sends successfully', status: 'passed', duration: 890, timestamp: new Date().toISOString(), category: 'api' },
  { id: '4', name: 'Provider configuration saves', status: 'passed', duration: 210, timestamp: new Date().toISOString(), category: 'api' },
  { id: '5', name: 'Autonomous loop starts and stops', status: 'pending', duration: 0, timestamp: new Date().toISOString(), category: 'integration' },
  { id: '6', name: '3D architecture renders', status: 'passed', duration: 1560, timestamp: new Date().toISOString(), category: 'rendering' },
  { id: '7', name: 'Theme switching works', status: 'passed', duration: 180, timestamp: new Date().toISOString(), category: 'ui' },
  { id: '8', name: 'Model comparison runs', status: 'passed', duration: 4500, timestamp: new Date().toISOString(), category: 'api' },
  { id: '9', name: 'Code search finds results', status: 'failed', duration: 2100, timestamp: new Date().toISOString(), category: 'integration', error: 'Timeout after 2000ms' },
  { id: '10', name: 'Skills toggle persists', status: 'passed', duration: 95, timestamp: new Date().toISOString(), category: 'ui' },
];

export default function TestingDashboard() {
  const [tests, setTests] = useState<TestRun[]>(demoTests);
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState<'passed' | 'failed' | 'pending' | 'all'>('all');

  const passed = tests.filter(t => t.status === 'passed').length;
  const failed = tests.filter(t => t.status === 'failed').length;
  const pending = tests.filter(t => t.status === 'pending').length;
  
  const totalDuration = tests.reduce((a, t) => a + t.duration, 0);

  const filtered = filter === 'all' ? tests : tests.filter(t => t.status === filter);

  const runTests = async () => {
    setRunning(true);
    setTests(prev => prev.map(t => ({ ...t, status: 'pending' as const, duration: 0 })));

    for (let i = 0; i < tests.length; i++) {
      await new Promise(r => setTimeout(r, 200 + Math.random() * 800));
      setTests(prev => prev.map((t, idx) => {
        if (idx !== i) return t;
        const isPass = Math.random() > 0.15;
        return {
          ...t,
          status: isPass ? 'passed' as const : 'failed' as const,
          duration: Math.floor(50 + Math.random() * 3000),
          error: isPass ? undefined : 'Assertion failed: expected true, got false',
        };
      }));
    }
    setRunning(false);
  };

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === 'passed') return <CheckCircle size={14} className="text-success" />;
    if (status === 'failed') return <AlertCircle size={14} className="text-danger" />;
    if (status === 'pending') return <RotateCw size={14} className="text-warning animate-spin" />;
    return <Clock size={14} className="text-text-muted" />;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border space-y-3">
        <div className="flex items-center gap-2">
          <TestTube size={16} className="text-accent" />
          <span className="font-bold text-sm text-text-heading">Testing Dashboard</span>
          <button
            onClick={runTests}
            disabled={running}
            className="ml-auto px-4 py-1.5 bg-accent text-bg text-[11px] font-bold rounded-lg hover:opacity-90 disabled:opacity-30 transition-all flex items-center gap-2"
          >
            <Play size={12} />
            {running ? 'Running...' : 'Run Tests'}
          </button>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-4 gap-2">
          <StatCard icon={CheckCircle} label="Passed" value={passed} color="text-success" bg="bg-success/10" />
          <StatCard icon={AlertCircle} label="Failed" value={failed} color="text-danger" bg="bg-danger-bg" />
          <StatCard icon={Clock} label="Pending" value={pending} color="text-warning" bg="bg-warning/10" />
          <StatCard icon={BarChart3} label="Duration" value={`${(totalDuration / 1000).toFixed(1)}s`} color="text-accent" bg="bg-accent-bg" />
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1">
          {(['all', 'passed', 'failed', 'pending'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all ${
                filter === f ? 'bg-accent text-bg' : 'text-text-secondary hover:bg-bg-hover'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Test list */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-3 px-3 py-2 text-[10px] text-text-muted font-semibold uppercase tracking-wider border-b border-border bg-bg-surface">
          <span>Status</span>
          <span>Test</span>
          <span className="text-right">Category</span>
          <span className="text-right">Duration</span>
          <span className="text-right"></span>
        </div>
        {filtered.map((test, i) => (
          <motion.div
            key={test.id}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-3 px-3 py-2.5 border-b border-border hover:bg-bg-hover transition-colors items-center"
          >
            <StatusIcon status={test.status} />
            <div className="min-w-0">
              <div className="text-[11px] text-text font-medium truncate">{test.name}</div>
              {test.error && (
                <div className="text-[10px] text-danger truncate mt-0.5">{test.error}</div>
              )}
            </div>
            <span className="text-[10px] text-text-muted text-right">{test.category}</span>
            <span className="text-[10px] text-text-muted font-mono text-right">{test.duration > 0 ? `${test.duration}ms` : '-'}</span>
            <span className="text-right">
              {test.status === 'failed' && (
                <button className="text-[10px] text-accent hover:text-text transition-colors">Retry</button>
              )}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, bg }: any) {
  return (
    <div className={`p-2.5 rounded-xl ${bg} border border-border`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={12} className={color} />
        <span className="text-[10px] text-text-muted font-medium">{label}</span>
      </div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}
