#!/usr/bin/env node
import { parseTask } from './cli.js';
import { runTask } from './run.js';

const task =
  parseTask(process.argv.slice(2)) ?? 'Explain why deterministic agent demos are useful.';

try {
  console.log(await runTask(task));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
