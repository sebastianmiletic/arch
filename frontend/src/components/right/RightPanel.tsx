
import { useStore } from '../../stores/appStore';
import ChatPanel from './ChatPanel';
import ProviderSettings from './ProviderSettings';
import { MessageSquare, Settings } from 'lucide-react';

export default function RightPanel() {
  const rightTab = useStore(s => s.rightTab);
  const setRightTab = useStore(s => s.setRightTab);

  return (
    <div className="w-[340px] min-w-[280px] max-w-[450px] flex flex-col border-l border-border bg-bg-panel">
      <div className="flex items-center h-9 px-2 gap-0.5 border-b border-border">
        <button
          onClick={() => setRightTab('chat')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-md transition-all duration-150 ${
            rightTab === 'chat'
              ? 'bg-bg-surface text-text shadow-sm'
              : 'text-text-secondary hover:text-text hover:bg-bg-hover'
          }`}
        >
          <MessageSquare size={12} />
          Chat
        </button>
        <button
          onClick={() => setRightTab('providers')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-md transition-all duration-150 ${
            rightTab === 'providers'
              ? 'bg-bg-surface text-text shadow-sm'
              : 'text-text-secondary hover:text-text hover:bg-bg-hover'
          }`}
        >
          <Settings size={12} />
          Providers
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        {rightTab === 'chat' ? <ChatPanel /> : <ProviderSettings />}
      </div>
    </div>
  );
}
