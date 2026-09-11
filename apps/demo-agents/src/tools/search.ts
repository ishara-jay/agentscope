import type { ToolImplementation } from '../llm/client.js';

export type SearchResult = { sourceId: string; title: string; snippet: string };

export const searchTool: ToolImplementation<{ query: string }, SearchResult> = {
  definition: {
    name: 'search',
    description: 'Search the deterministic demo corpus for relevant evidence.',
    parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
  async execute(args) {
    return {
      sourceId: 'source-1',
      title: `Evidence for ${args.query}`,
      snippet: 'Deterministic tools make agent behavior easy to review and reproduce.',
    };
  },
};
