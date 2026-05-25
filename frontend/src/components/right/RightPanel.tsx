import ChatPanel from './ChatPanel';
import { MessageSquare } from 'lucide-react';

export default function RightPanel() {
  return (
    <div className="w-[380px] min-w-[320px] max-w-[500px] flex flex-col border-l border-border bg-bg-panel">
      <div className="flex items-center h-9 px-3 border-b border-border shrink-0 select-none">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-text"
        >
          <MessageSquare size={12} />
          AI Chat
        </div>
      </div>
      <div className="flex-1 overflow-hidden"
      >
        <ChatPanel />
      </div>
    </div>
  );
}
