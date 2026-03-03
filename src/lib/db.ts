import { Pool, PoolClient } from 'pg';
import { requireDatabaseUrl } from '@/lib/env';

const globalForPg = globalThis as unknown as { pool?: Pool };

export const db =
  globalForPg.pool ??
  new Pool({
    connectionString: requireDatabaseUrl(),
    max: 20,
    idleTimeoutMillis: 30_000
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPg.pool = db;
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  await client.query('BEGIN');
  try {
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
