import { type WebSocket } from 'ws';
export declare function createWSServer(port?: number): import("ws").Server<typeof WebSocket, typeof import("http").IncomingMessage>;
