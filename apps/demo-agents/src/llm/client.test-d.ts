import type { LlmClient, ToolImplementation } from './client.js';

const validClient: LlmClient = {
  provider: 'test',
  generate: async () => ({ usage: { inputTokens: 1, outputTokens: 2 }, text: 'ok' }),
};
void validClient;

// @ts-expect-error provider metadata is required
const invalidClient: LlmClient = {
  generate: async () => ({ usage: { inputTokens: 1, outputTokens: 1 } }),
};
void invalidClient;

const validTool: ToolImplementation<{ query: string }, string[]> = {
  definition: { name: 'search', description: 'Search', parameters: { type: 'object' } },
  execute: async ({ query }) => [query],
};
void validTool;

const invalidTool: ToolImplementation<{ query: string }, string[]> = {
  definition: { name: 'search', description: 'Search', parameters: { type: 'object' } },
  // @ts-expect-error the implementation result must match its declared result
  execute: async () => 'not an array',
};
void invalidTool;
