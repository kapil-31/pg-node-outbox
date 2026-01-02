import "dotenv/config";
import { Pool } from "pg";
import { createOutbox } from "node-outbox";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const outbox = createOutbox({ pool });

async function main() {
  await outbox.withTransaction(async (pg) => {
    await pg.query(`CREATE TABLE IF NOT EXISTS orders
             (
            id SERIAL PRIMARY KEY,
            amount INT NOT NULL
             )`);

    const res = await pg.query(
      `INSERT INTO orders (amount) VALUES ($1) RETURNING id`,
      [100]
    );

    const order = res.rows[0];

    // Transaction outbox write
    await outbox.enqueue(pg, {
      type: "order.created",
      payload: {
        order,
      },
    });
    
    outbox.dispatch({
      "order.created": async function (event, ctx) {
          await ctx.runOnce(async ()=>{
            console.log("Sending webhook for order", event);
          })
      },
    });

    console.log("Order Created,", order.id);
  });
}
main().catch(console.error);

// this is where dispatcher runs function by pulling events on database outbox
