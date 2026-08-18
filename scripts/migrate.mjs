import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const { Pool } = pg;
const MIGRATION_LOCK_ID = 2_421_001;
const connectionString = process.env.DATABASE_URL?.trim() || undefined;
const pool = new Pool({
  ...(connectionString ? { connectionString } : {}),
  connectionTimeoutMillis: 5_000,
});

async function migrate() {
  const client = await pool.connect();
  let locked = false;
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    locked = true;
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const directory = path.join(process.cwd(), 'database', 'migrations');
    const files = (await readdir(directory))
      .filter((file) => /^\d+_.+\.sql$/.test(file))
      .sort();

    for (const file of files) {
      const sql = await readFile(path.join(directory, file), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const existing = await client.query(
        'SELECT checksum FROM schema_migrations WHERE name = $1',
        [file],
      );
      if (existing.rowCount) {
        if (existing.rows[0].checksum !== checksum) {
          throw new Error(`Migration ${file} changed after it was applied`);
        }
        continue;
      }

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)',
          [file, checksum],
        );
        await client.query('COMMIT');
        console.log(`Applied ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    if (process.env.DEFAULT_EKUIPER_URL) {
      await client.query(
        `INSERT INTO managed_nodes (id, name, base_url, description, is_default)
         SELECT 'bundled-ekuiper', 'eKuiper', $1, 'Installed with eKuiper Manager', true
          WHERE NOT EXISTS (SELECT 1 FROM managed_nodes)
         ON CONFLICT DO NOTHING`,
        [process.env.DEFAULT_EKUIPER_URL],
      );
    }
  } finally {
    if (locked) await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]);
    client.release();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
