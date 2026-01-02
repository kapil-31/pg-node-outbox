import { Pool, PoolClient } from "pg";
import { randomUUID } from "crypto";
import { Dispatcher } from "./dispatcher";
import { EventHandler } from "./types";

export function createOutbox({pool}: { pool: Pool }) {
  return new Outbox(pool);
}

export class Outbox {
  constructor(private pool: Pool) {}

  async withTransaction(fn: (tx: PoolClient ) => Promise<void>) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await fn(client);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async enqueue(tx: PoolClient, event: { type: string; payload: any }) {
    await tx.query(
      `
      INSERT INTO outbox_events (id, type, payload)
      VALUES ($1, $2, $3)
      `,
      [randomUUID(), event.type, event.payload]
    );
    // database level trigger 
      await tx.query(`NOTIFY outbox_events`);

  }

  dispatch(handlers: Record<string, EventHandler>) {
    new Dispatcher(this.pool, handlers).start();
  }
}
