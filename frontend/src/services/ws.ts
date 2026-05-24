import type { CodeChange } from '../types';

const WS_URL = typeof window !== 'undefined' && window.location.origin.includes('localhost:5173')
  ? 'ws://localhost:3001'
  : 'ws://localhost:3001';

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const listeners: Array<(data: any) => void> = [];

function connect() {
  if (ws) return;
  ws = new WebSocket(WS_URL);
  ws.onopen = () => {
    console.log('WS connected');
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  };
  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      for (const cb of listeners) cb(msg);
    } catch {}
  };
  ws.onclose = () => {
    ws = null;
    reconnectTimer = setTimeout(connect, 2000);
  };
  ws.onerror = () => {
    ws?.close();
  };
}

connect();

export function wsListen(cb: (data: any) => void) {
  listeners.push(cb);
  return () => {
    const i = listeners.indexOf(cb);
    if (i >= 0) listeners.splice(i, 1);
  };
}

export function wsSend(type: string, data?: any) {
  if (ws?.readyState === 1) ws.send(JSON.stringify({ type, data }));
}

export function sendChange(change: CodeChange) {
  wsSend('change', change);
}
export function startLoop(task?: string) {
  wsSend('loop:start', { task });
}
export function stopLoop() {
  wsSend('loop:stop');
}
