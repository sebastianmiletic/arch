import { WebSocketServer, type WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { AutonomousLoop } from './loop.js';
import { addCodeChange } from './db.js';

export function createWSServer(port = 3001) {
  const wss = new WebSocketServer({ port });
  const clients = new Set<WebSocket>();
  let loop: AutonomousLoop | null = null;

  function broadcast(data: any) {
    const json = JSON.stringify(data);
    for (const client of clients) {
      if (client.readyState === 1) client.send(json);
    }
  }

  wss.on('connection', (ws) => {
    clients.add(ws);
    ws.send(JSON.stringify({ type: 'connected', data: { id: randomUUID() } }));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'loop:start') {
          if (!loop) loop = new AutonomousLoop(broadcast);
          loop.start(msg.task);
        }
        if (msg.type === 'loop:stop') {
          loop?.stop();
        }
        if (msg.type === 'change') {
          addCodeChange(msg.data);
          broadcast({ type: 'change', data: msg.data });
        }
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch {
        // ignore invalid messages
      }
    });

    ws.on('close', () => clients.delete(ws));
  });

  console.log(`WebSocket server on ws://localhost:${port}`);
  return wss;
}
