#!/usr/bin/env node
import { createChatServer } from './server.js';

const port = Number(process.env.DEMO_AGENT_PORT ?? 3002);
const server = createChatServer();
server.listen(port, '0.0.0.0', () => {
  console.log(`Demo agent service listening on http://0.0.0.0:${port}`);
});
