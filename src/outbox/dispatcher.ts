import {  Pool, PoolClient } from "pg";
import { IdempotencyStore } from "../idempotency";

export class Dispatcher {
  private idempotency: IdempotencyStore;
  private listener!: PoolClient
   private stopped = false;

  constructor(
    private pool: Pool,
    private handlers: Record<string, any>
  ) {
    this.idempotency = new IdempotencyStore(pool);
  }

  async start() {
    await this.setupListener();

    while (!this.stopped) {
      const event = await this.claim();
      if (!event) {
        await this.waitForNotification()
        continue;
      }

      try {
        const handler = this.handlers[event.type];
        if (!handler) throw new Error("No handler");

        await handler(event, {
          runOnce: (fn: any) =>
            this.idempotency.runOnce(event.id, fn),
        });

        await this.complete(event.id);
      } catch (e: any) {
        await this.fail(event.id, e.message);
      }
    }
  }

  private async claim() {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const res = await client.query(
        `
        WITH evt AS (
          SELECT id
          FROM outbox_events
          WHERE status = 'PENDING'
            AND next_run_at <= NOW()
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        UPDATE outbox_events
        SET status = 'PROCESSING'
        WHERE id = (SELECT id FROM evt)
        RETURNING *;
        `
      );
      await client.query("COMMIT");
      return res.rows[0] ?? null;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  private async complete(id: string) {
    await this.pool.query(
      `UPDATE outbox_events
       SET status='SENT', processed_at=NOW()
       WHERE id=$1`,
      [id]
    );
  }

  private async fail(id: string, error: string) {
    await this.pool.query(
      `
      UPDATE outbox_events
      SET retry_count = retry_count + 1,
          status = 'PENDING',
          next_run_at = NOW() + INTERVAL '1 second' * POWER(2, retry_count),
          last_error = $2
      WHERE id = $1
      `,
      [id, error]
    );
  }

   private async setupListener() {
    this.listener = await this.pool.connect();
    await this.listener.query(`LISTEN outbox_events`);
  }
   private waitForNotification(): Promise<void> {
    return new Promise((resolve) => {
      const handler = () => {
        this.listener.off("notification", handler);
        resolve();
      };

      this.listener.on("notification", handler);
    });
  }
}

