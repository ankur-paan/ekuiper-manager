import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

declare global {
  var ekuiperManagerPool: Pool | undefined;
}

const connectionString = process.env.DATABASE_URL?.trim() || undefined;

function createPool() {
  return new Pool({
    ...(connectionString ? { connectionString } : {}),
    max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    statement_timeout: 30_000,
    application_name: 'ekuiper-manager',
  });
}

export const db = globalThis.ekuiperManagerPool ?? createPool();

if (process.env.NODE_ENV !== 'production') {
  globalThis.ekuiperManagerPool = db;
}

export function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<QueryResult<T>> {
  return db.query<T>(text, values);
}

export async function withTransaction<T>(
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function checkDatabase(): Promise<void> {
  await query('SELECT 1');
}
