/**
 * Local development server for the API. Vite proxies /api here (see vite.config.ts).
 * Run with:  npm run dev:api   (reads .env.local)
 */
import http from 'node:http';
import { handle } from './routes';

const PORT = Number(process.env.API_PORT ?? 8787);

http
  .createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const result = await handle({
      method: req.method ?? 'GET',
      path: req.url ?? '/',
      headers: req.headers as Record<string, string | undefined>,
      body: Buffer.concat(chunks).toString('utf8'),
    });
    res.writeHead(result.status, { 'Content-Type': 'application/json' });
    res.end(result.body === undefined ? '' : JSON.stringify(result.body));
  })
  .listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
