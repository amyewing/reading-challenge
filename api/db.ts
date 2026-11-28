import pg from 'pg';
import { config } from './config';
import { HttpError } from './http';

// One small pool per process. A serverless function handles one request at a time, so one
// connection is enough there; Neon's pooler handles the fan-in across function instances.
let pool: pg.Pool | null = null;
function getPool() {
  pool ??= new pg.Pool({
    connectionString: config.databaseUrl,
    max: process.env.SERVERLESS ? 1 : 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  return pool;
}

export type Query = <T = any>(text: string, params?: unknown[]) => Promise<T[]>;

/**
 * Run `fn` in a transaction as the signed-in user.
 *
 * The transaction switches to the restricted `app_user` role and records the verified user id
 * in the `app.user_id` setting, which the database's current_user_id() reads. That way the
 * Row Level Security rules in db/schema.sql apply to everything the API does, as a second
 * layer behind the checks in the API code.
 */
export async function asUser<T>(userId: string, fn: (q: Query) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  const q: Query = async (text, params) => (await client.query(text, params as any[])).rows;
  try {
    await client.query('begin');
    // Same as SET LOCAL ROLE app_user + SET LOCAL app.user_id, in one round trip
    await client.query("select set_config('role', 'app_user', true), set_config('app.user_id', $1, true)", [userId]);
    const result = await fn(q);
    await client.query('commit');
    return result;
  } catch (e) {
    await client.query('rollback').catch(() => undefined);
    throw toHttpError(e);
  } finally {
    client.release();
  }
}

/**
 * Run `fn` as the restricted app role with nobody signed in. Only for the few public endpoints
 * (such as an uploaded book cover): everything else the role can reach needs a signed-in user.
 */
export async function asPublic<T>(fn: (q: Query) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  const q: Query = async (text, params) => (await client.query(text, params as any[])).rows;
  try {
    await client.query('begin');
    await client.query("select set_config('role', 'app_user', true)");
    const result = await fn(q);
    await client.query('commit');
    return result;
  } catch (e) {
    await client.query('rollback').catch(() => undefined);
    throw toHttpError(e);
  } finally {
    client.release();
  }
}

/** Turn database errors into messages people can act on. */
function toHttpError(e: any): unknown {
  if (e instanceof HttpError) return e;
  switch (e?.code) {
    case 'P0001': // raise exception '...' in our SQL functions: the message is for people
      return new HttpError(400, e.message);
    case '42501': // a Row Level Security rule said no
      return new HttpError(403, "You don't have permission to do that.");
    case '23505':
      return new HttpError(409, 'That already exists.');
    case '23503':
      return new HttpError(400, 'Something this refers to no longer exists.');
    case '23514':
    case '22001':
    case '22007':
    case '22008':
    case '22P02':
      return new HttpError(400, 'Some of the details entered are not valid.');
    default:
      return e;
  }
}
