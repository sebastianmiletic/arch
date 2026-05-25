import express from 'express';
import cors from 'cors';
import { router } from './routes.js';
import { createWSServer } from './ws.js';
import { seedFeatures } from './features.js';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3000;
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/api', router);
// Serve frontend static build
const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));
// Fallback for SPA routing
app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
});
const server = app.listen(PORT, () => {
    console.log(`API server on http://localhost:${PORT}`);
});
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Is another instance running?`);
        process.exit(1);
    }
    console.error('Server error:', err);
});
seedFeatures();
createWSServer(3001);
//# sourceMappingURL=server.js.map