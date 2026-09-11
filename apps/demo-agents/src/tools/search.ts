import type { ToolImplementation } from '../llm/client.js';

export type SearchArgs = { query: string };
export type SearchResult = { sourceId: string; title: string; snippet: string }[];

export const searchTool: ToolImplementation<SearchArgs, SearchResult> = {
  definition: {
    name: 'search',
    description: 'Search the deterministic offline demo corpus.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
      additionalProperties: false,
    },
  },
  async execute({ query }) {
    return [
      {
        sourceId: 'source-1',
        title: `Offline result for ${query}`,
        snippet: `Deterministic background material about ${query}.`,
      },
    ];
  },
};
