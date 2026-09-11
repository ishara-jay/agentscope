#!/usr/bin/env node
import { runChat } from './run.js';

const task =
  process.argv.slice(2).join(' ').trim() || 'Explain why deterministic agent demos are useful.';

try {
  const response = await runChat([{ role: 'user', content: task }]);
  console.log(response);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
