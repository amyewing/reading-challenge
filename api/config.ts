/** Server-side settings, read from environment variables. */

function required(name: string, fallback?: string): string {
  const value = process.env[name] || (fallback ? process.env[fallback] : undefined);
  if (!value) throw new Error(`${name} is not set`);
  return value.replace(/\/+$/, '');
}

export const config = {
  /** Neon connection string (use the pooled one, with -pooler in the host). Secret. */
  get databaseUrl() {
    return required('DATABASE_URL');
  },
  /** e.g. https://amyewing.kinde.com — falls back to the front end's value in local dev. */
  get kindeDomain() {
    return required('KINDE_DOMAIN', 'VITE_KINDE_DOMAIN');
  },
  /** The API audience registered in Kinde, e.g. https://api.readingchallenge */
  get kindeAudience() {
    return required('KINDE_AUDIENCE', 'VITE_KINDE_AUDIENCE');
  },
};
