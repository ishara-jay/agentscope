import type { ToolImplementation } from '../llm/client.js';

export const readSourceTool: ToolImplementation<{ sourceId: string }, string> = {
  definition: {
    name: 'read_source',
    description: 'Read a source from the deterministic demo corpus.',
    parameters: {
      type: 'object',
      properties: { sourceId: { type: 'string' } },
      required: ['sourceId'],
    },
  },
  async execute(args) {
    return `Full text for ${args.sourceId}: deterministic execution supports reliable demos.`;
  },
};
