import type { LlmClient, LlmMessage, LlmResult, ToolImplementation } from './client.js';

const validMessage: LlmMessage = { role: 'tool', content: 'result', toolCallId: 'call-1' };
void validMessage;

const validClient: LlmClient = {
  provider: 'test',
  async generate(request): Promise<LlmResult> {
    return {
      text: request.messages.at(-1)?.content,
      usage: { inputTokens: 2, outputTokens: 3 },
    };
  },
};
void validClient;

const validTool: ToolImplementation<{ query: string }, string[]> = {
  definition: {
    name: 'search',
    description: 'Search for evidence',
    parameters: { type: 'object' },
  },
  async execute(args) {
    return [args.query];
  },
};
void validTool;

// @ts-expect-error Provider messages only support the four defined roles.
const invalidMessage: LlmMessage = { role: 'developer', content: 'not supported' };
void invalidMessage;

// @ts-expect-error Every provider result must expose token usage for emitter compatibility.
const invalidResult: LlmResult = { text: 'missing usage' };
void invalidResult;

// @ts-expect-error Executable tools must provide separate metadata and an implementation.
const invalidTool: ToolImplementation = { execute: async () => undefined };
void invalidTool;
