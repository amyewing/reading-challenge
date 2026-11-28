/**
 * DigitalOcean Functions entry point (web: raw). App Platform sends /api/core/api/<rest> to
 * this function with http.path = /<rest>; the front end calls /api/core/api/api/..., so the
 * router sees the same /api/... paths as in local development.
 *
 * Bundled into functions/packages/core/api/index.js by `npm run build:api`.
 */
import { handle } from './routes';

process.env.SERVERLESS = 'true';

interface WebEvent {
  http?: {
    method?: string;
    path?: string;
    headers?: Record<string, string>;
    body?: string;
    isBase64Encoded?: boolean;
  };
}

export async function main(event: WebEvent) {
  const http = event.http ?? {};
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(http.headers ?? {})) headers[key.toLowerCase()] = value;
  const raw = http.body ?? '';
  const body = http.isBase64Encoded ? Buffer.from(raw, 'base64').toString('utf8') : raw;

  const result = await handle({ method: http.method ?? 'GET', path: http.path || '/', headers, body });
  if (result.binary) {
    // A picture: the platform decodes a base64 body for a non-text content type
    return {
      statusCode: result.status,
      headers: {
        'Content-Type': result.binary.contentType,
        'Cache-Control': `public, max-age=${result.binary.cacheSeconds}, immutable`,
      },
      body: result.binary.base64,
    };
  }
  return {
    statusCode: result.status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: result.body === undefined ? '' : JSON.stringify(result.body),
  };
}
