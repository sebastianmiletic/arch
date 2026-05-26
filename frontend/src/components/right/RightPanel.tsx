import ChatPanel from './ChatPanel';

export default function RightPanel() {
  return (
    <div className="w-[420px] min-w-[340px] max-w-[560px] flex flex-col border-l border-border bg-bg-panel"
    >
      <ChatPanel />
    </div>
  );
}
