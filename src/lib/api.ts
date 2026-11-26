// Talks to our API (api/ in this project). Every request carries the signed-in person's
// Kinde access token; the API checks it before touching the database.

type TokenGetter = () => Promise<string | null | undefined>;
let getToken: TokenGetter = async () => null;

export function setTokenGetter(fn: TokenGetter) {
  getToken = fn;
}

// Locally this is empty and Vite proxies /api to the dev API server. In production the API is
// a DigitalOcean function reached at /api/core/api (set VITE_API_BASE at build time).
const BASE = import.meta.env.VITE_API_BASE ?? '';

export async function api<T = unknown>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(BASE + path, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // not JSON (e.g. the API isn't running)
  }
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `The server didn't respond as expected (${res.status}).`);
  return data as T;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Wraps the stored-token getter so a token about to expire is refreshed before it's sent.
 * Kinde refreshes on a timer, but phones pause timers in the background. Requests that
 * arrive together share one refresh.
 */
export function freshTokenGetter(getStored: () => Promise<string | null | undefined>, refresh: () => Promise<unknown>): TokenGetter {
  let refreshing: Promise<unknown> | null = null;
  return async () => {
    const token = await getStored();
    if (!token || !expiresSoon(token)) return token;
    refreshing ??= refresh()
      .catch(() => undefined)
      .finally(() => {
        refreshing = null;
      });
    await refreshing;
    return getStored();
  };
}

function expiresSoon(token: string): boolean {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(payload));
    return typeof exp === 'number' && exp - 30 <= Date.now() / 1000;
  } catch {
    return false;
  }
}
