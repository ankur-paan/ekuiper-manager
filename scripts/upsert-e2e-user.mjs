import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL?.trim() || 'postgres://ekuiper_manager:ekuiper-manager-internal@127.0.0.1:5432/ekuiper_manager';
const pool = new Pool({ connectionString });

async function run() {
  const client = await pool.connect();
  try {
    const hash = 'scrypt$16384$8$1$YWJjZGVmZ2hpamtsbW5vcA$Q26OvCf-KwrvHkXMe9oV0oR8VrRJuXe1dLE3Ry1Ebk8SuxnzeQWc4KvPnap3ZWib2CrKjSJ2wK6MxIlZGMcW6g';
    await client.query(`
      INSERT INTO users (id, username, username_normalized, password_hash, role, must_change_password)
      VALUES ('e2e00000-0000-0000-0000-000000000001', 'e2e-owner', 'e2e-owner', $1, 'OWNER', false)
      ON CONFLICT (username_normalized) DO UPDATE SET password_hash = EXCLUDED.password_hash, must_change_password = false;
    `, [hash]);
    console.log('e2e-owner user upserted successfully!');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
