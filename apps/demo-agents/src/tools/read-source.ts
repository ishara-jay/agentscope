import type { ToolImplementation } from '../llm/client.js';

export type ReadSourceArgs = { sourceId: string };
export type ReadSourceResult = { sourceId: string; content: string };

export const readSourceTool: ToolImplementation<ReadSourceArgs, ReadSourceResult> = {
  definition: {
    name: 'read_source',
    description: 'Read one source from the deterministic offline demo corpus.',
    parameters: {
      type: 'object',
      properties: { sourceId: { type: 'string' } },
      required: ['sourceId'],
      additionalProperties: false,
    },
  },
  async execute({ sourceId }) {
    return {
      sourceId,
      content: `Verified offline demo content from ${sourceId}.`,
    };
  },
};
