import { useState } from 'react';

export default function WorkflowBuilder() {
  const [nodes] = useState([
    { id: 1, label: 'On Code Change', x: 100, y: 50 },
    { id: 2, label: 'Analyze', x: 100, y: 130 },
    { id: 3, label: 'Build', x: 100, y: 210 },
    { id: 4, label: 'Test', x: 100, y: 290 },
    { id: 5, label: 'Notify', x: 100, y: 370 },
  ]);

  return (
    <div className="p-4 space-y-3 h-full overflow-y-auto">
      <div className="flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
        <span className="font-semibold text-sm text-text">Agent Workflow Builder</span>
      </div>
      <div className="border border-border rounded-lg p-4 bg-bg-surface min-h-[400px]">
        <svg viewBox="0 0 300 450" className="w-full h-full">
          {nodes.map((n, i) => (
            <g key={n.id}>
              {i > 0 && <line x1="150" y1={nodes[i-1].y + 30} x2="150" y2={n.y} stroke="#333336" />}
              <rect x="75" y={n.y} width="150" height="36" rx="8" fill="#161618" stroke="#55555a" />
              <text x="150" y={n.y + 22} textAnchor="middle" fill="#c0c0c5" fontSize="12">{n.label}</text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
