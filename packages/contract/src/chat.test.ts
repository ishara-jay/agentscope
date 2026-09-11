import { describe, expect, it } from 'vitest';
import { ChatRequest, ChatResponse } from './chat.js';

describe('chat contracts', () => {
  it('accepts a browser-held conversation and an assistant response', () => {
    expect(
      ChatRequest.parse({
        messages: [
          { role: 'user', content: 'First question' },
          { role: 'assistant', content: 'First answer' },
          { role: 'user', content: 'Follow-up' },
        ],
      }).messages,
    ).toHaveLength(3);

    expect(ChatResponse.parse({ message: { role: 'assistant', content: 'Final answer' } })).toEqual(
      { message: { role: 'assistant', content: 'Final answer' } },
    );
  });

  it('rejects empty histories, empty content, and non-chat roles', () => {
    expect(ChatRequest.safeParse({ messages: [] }).success).toBe(false);
    expect(ChatRequest.safeParse({ messages: [{ role: 'user', content: '' }] }).success).toBe(
      false,
    );
    expect(ChatRequest.safeParse({ messages: [{ role: 'tool', content: 'hidden' }] }).success).toBe(
      false,
    );
  });
});
