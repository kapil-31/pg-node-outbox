# pg-node-outbox

> 🚧 **Work in Progress** — Actively developed to explore reliable event delivery using the Transactional Outbox Pattern with PostgreSQL.

**pg-node-outbox** is a Node.js library that implements the **Transactional Outbox Pattern** to ensure **database changes and external side effects remain consistent**, even in the presence of crashes, retries, and partial failures.

It is designed as a **low-level infrastructure library**, not a hosted service.

---

## Why pg-node-outbox?

In many systems, this pattern causes bugs:

```ts
await db.insert(order);
await sendWebhook(order); // ❌ unsafe
```

If the webhook fails after the DB commit, the system becomes inconsistent.

pg-node-outbox fixes this by making side effects transactional and retry-safe.

## Core Guarantees
| Guarantee                  | Status        |
| -------------------------- | ------------- |
| DB write + event atomicity | ✅             |
| Crash-safe delivery        | ✅             |
| Automatic retries          | ✅             |
| Exponential backoff        | ✅             |
| Idempotent side effects    | ✅             |
| Horizontal dispatchers     | ✅             |
| Exactly-once delivery      | ❌ (by design) |


If a database transaction commits, the side effect will eventually happen once.


# What pg-node-outbox Is NOT

❌ A message broker (Kafka, RabbitMQ)

❌ A streaming platform

❌ Exactly-once delivery system

❌ A job queue replacement

❌ A hosted service


# Requirements

Node.js 18+

PostgreSQL 13+


## Installation

- npm install pg-node-outbox 
- createdb dbname
- export DATABASE_URL=postgres://user@localhost:5432/node_outbox
- run migrations npx pg-node-outbox migrate

⚠️ The CLI does not load .env files automatically.
Ensure DATABASE_URL is present in the environment.


# Basic Concepts

- Outbox Event → A persisted intent to perform a side effect

- Transaction Boundary → DB write + event write are atomic

- Dispatcher → Background process that delivers events

- Idempotency → Side effects execute at most once


# Usage 

```bash 
import { createOutbox } from "pg-node-outbox";

const outbox = createOutbox({
  connectionString: process.env.DATABASE_URL!,
});

await outbox.withTransaction(async (tx) => {
  await tx.query(
    "INSERT INTO orders (amount) VALUES ($1)",
    [100]
  );

  await outbox.enqueue(tx, {
    type: "order.created",
    payload: { orderId: 123, amount: 100 },
  });

});


```
enqueue() must use the same transaction as your business write.
If the transaction rolls back → no event is created.



# Dispatcher Usage (Consumer)
```bash
import { createOutbox } from "pg-node-outbox";

const outbox = createOutbox({
  connectionString: process.env.DATABASE_URL!,
});

outbox.dispatch({
  "order.created": async (event, ctx) => {
    await ctx.runOnce(async () => {
      console.log(
        `📦 Sending webhook for order ${event.payload.orderId}`
      );
    });
  },
});

 ```

 You may run multiple dispatchers in parallel.


 # Idempotent Side Effects (ctx.runOnce)
 Outbox events may be delivered more than once.
Side effects must not.

Use ctx.runOnce() to guarantee at-most-once execution.
 ```bash 
 await ctx.runOnce(async () => {
  await sendWebhook(event.payload);
});

 ```

 # Guarantees
 - Safe under retries

- Safe under crashes

- Safe with multiple dispatchers


# Event-Driven Dispatching (Performance)

pg-node-outbox uses PostgreSQL LISTEN / NOTIFY to avoid busy polling.

## Behavior

- Dispatcher blocks when idle

- Wakes instantly when a new event is committed

 - No constant DB queries

- Near-zero idle CPU usage

This makes the system efficient even at low traffic.


# Retry & Backoff Model

- Failed deliveries retry automatically

- Backoff is exponential (2^retry_count)

- Backoff enforced at the database level

- Events exceeding retries can be inspected or handled separately

- No worker-side timers are used.


# Life Cycle
PENDING → PROCESSING → SENT  → RETRY (with backoff)
             


# Use Cases

- Reliable webhook delivery

- Email sending after DB commit

- Kafka / SQS / RabbitMQ publishing

 - Audit logs & compliance events

- Payment & billing propagation

- External API synchronization

- Microservice event propagation

# 
When to Use pg-node-outbox

Use it when:

- You need transactional consistency

- External systems are unreliable

- Side effects must not be duplicated

- You want crash-safe delivery

- PostgreSQL is already in your stack

# Do not use it for:

- High-throughput streaming

- Real-time pub/sub

- Exactly-once semantics



# Design Philosophy

- Assume failures will happen

- Embrace retries

- Make side effects idempotent

- Prefer explicit behavior over magic

- Use PostgreSQL as the source of truth


# Status

This project is under active development.
APIs may change before 1.0.0.


# License 
MIT License

Copyright (c) 2025 Kapil Karki

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.