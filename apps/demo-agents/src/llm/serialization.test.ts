import { describe, expect, it } from 'vitest';
import type { LlmRequest } from './client.js';
import { serializeLlmRequest } from './serialization.js';

describe('serializeLlmRequest', () => {
  it('stably preserves messages, tool-call IDs, and tool definitions', () => {
    const request: LlmRequest = {
      model: 'fake-model',
      messages: [
        { role: 'user', content: 'Find evidence' },
        { role: 'tool', content: '{"hits":[]}', toolCallId: 'call-1' },
      ],
      tools: [
        {
          name: 'search',
          description: 'Search for evidence',
          parameters: { type: 'object', properties: { query: { type: 'string' } } },
        },
      ],
    };

    const first = serializeLlmRequest(request);
    const second = serializeLlmRequest(request);

    expect(second).toBe(first);
    expect(JSON.parse(first)).toEqual(request);
  });
});
