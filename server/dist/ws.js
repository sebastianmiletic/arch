import { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';
import { AutonomousLoop } from './loop.js';
import { addCodeChange } from './db.js';
import { setBroadcast } from './ws-shared.js';
import { createTerminalSession, getTerminalSession, killTerminalSession, resizeTerminalSession, writeToTerminal, } from './terminal.js';
export function createWSServer(startPort = 3001) {
    let port = startPort;
    let wss = null;
    while (port < startPort + 10) {
        try {
            wss = new WebSocketServer({ port, host: '127.0.0.1' });
            console.log(`WebSocket server on ws://localhost:${port}`);
            break;
        }
        catch (err) {
            if (err.code === 'EADDRINUSE') {
                console.log(`Port ${port} in use, trying ${port + 1}`);
                port++;
            }
            else {
                throw err;
            }
        }
    }
    if (!wss) {
        console.error('Could not start WebSocket server: all ports in use');
        return null;
    }
    const clients = new Set();
    const clientIdMap = new WeakMap();
    let loop = null;
    function broadcast(data) {
        const json = JSON.stringify(data);
        for (const client of clients) {
            if (client.readyState === 1)
                client.send(json);
        }
    }
    setBroadcast(broadcast);
    wss.on('connection', (ws) => {
        const clientId = randomUUID();
        clientIdMap.set(ws, clientId);
        clients.add(ws);
        ws.send(JSON.stringify({ type: 'connected', data: { id: clientId } }));
        ws.on('message', (raw) => {
            try {
                const msg = JSON.parse(raw.toString());
                if (msg.type === 'loop:start') {
                    if (!loop)
                        loop = new AutonomousLoop(broadcast);
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
                // ─── Terminal protocol ───
                if (msg.type === 'terminal:create') {
                    const sessionId = msg.sessionId || clientId;
                    createTerminalSession(sessionId, (data) => {
                        if (ws.readyState === 1) {
                            ws.send(JSON.stringify({ type: 'terminal:data', sessionId, data }));
                        }
                    }, (code) => {
                        if (ws.readyState === 1) {
                            ws.send(JSON.stringify({ type: 'terminal:exit', sessionId, code }));
                        }
                    });
                    const session = getTerminalSession(sessionId);
                    ws.send(JSON.stringify({
                        type: 'terminal:created',
                        sessionId,
                        pid: session?.pty.pid,
                    }));
                }
                if (msg.type === 'terminal:input') {
                    const sessionId = msg.sessionId || clientId;
                    writeToTerminal(sessionId, msg.data);
                }
                if (msg.type === 'terminal:kill') {
                    const sessionId = msg.sessionId || clientId;
                    killTerminalSession(sessionId);
                    ws.send(JSON.stringify({ type: 'terminal:killed', sessionId }));
                }
                if (msg.type === 'terminal:resize') {
                    const sessionId = msg.sessionId || clientId;
                    resizeTerminalSession(sessionId, msg.cols || 80, msg.rows || 24);
                }
            }
            catch {
                // ignore invalid messages
            }
        });
        ws.on('close', () => {
            clients.delete(ws);
            const sessionId = clientIdMap.get(ws);
            if (sessionId) {
                killTerminalSession(sessionId);
            }
        });
    });
    wss.on('error', (err) => {
        if (err.code !== 'EADDRINUSE') {
            console.error('WebSocket error:', err.message);
        }
    });
    return wss;
}
//# sourceMappingURL=ws.js.map