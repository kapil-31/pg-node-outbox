#!/usr/bin/env node
import { spawn } from "child_process";
import { migrate } from "../storage/migration";

const command = process.argv[2];

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

switch (command) {
  case "migrate":
    migrate({ connectionString: process.env.DATABASE_URL })
      .then(() => {
        console.log("node-outbox migrations complete");
        process.exit(0);
      })
      .catch(err => {
        console.error(err);
        process.exit(1);
      });
    break;

  case "worker":
    spawn("node", ["dist/worker.js"], {
      stdio: "inherit",
    });
    break;

  default:
    console.log(`
Usage:
  node-queue migrate
  node-queue worker
`);
}