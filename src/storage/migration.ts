import { Pool } from "pg";

export async function migrate(config: { connectionString: string }) {
  if (!config.connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = new Pool({
    connectionString: config.connectionString,
  });

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS outbox_events (
        id UUID PRIMARY KEY,
        type TEXT NOT NULL,
        payload JSONB NOT NULL,

        status TEXT NOT NULL DEFAULT 'PENDING',
        retry_count INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT 5,

        next_run_at TIMESTAMP NOT NULL DEFAULT NOW(),
        last_error TEXT,

        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        processed_at TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_outbox_events_status
        ON outbox_events (status);

      CREATE INDEX IF NOT EXISTS idx_outbox_events_next_run
        ON outbox_events (next_run_at);

      CREATE TABLE IF NOT EXISTS outbox_idempotency (
        key TEXT PRIMARY KEY,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    console.log("✅ node-outbox migrations completed");
  } finally {
    await pool.end();
  }
}
