import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleChatPayload } from './server.js';

afterEach(() => vi.restoreAllMocks());

describe('chat API', () => {
  it('validates requests and forwards the whole history', async () => {
    const history = [
      { role: 'user' as const, content: 'One' },
      { role: 'assistant' as const, content: 'Two' },
      { role: 'user' as const, content: 'Three' },
    ];
    const runner = vi.fn().mockResolvedValue('final only');

    await expect(handleChatPayload({ messages: [] }, runner)).resolves.toEqual({
      status: 400,
      body: { error: 'Invalid chat request' },
    });
    await expect(handleChatPayload({ messages: history }, runner)).resolves.toEqual({
      status: 200,
      body: { message: { role: 'assistant', content: 'final only' } },
    });
    expect(runner).toHaveBeenCalledWith(history);
  });

  it('converts agent failures into a stable API error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const result = await handleChatPayload({ messages: [{ role: 'user', content: 'hello' }] }, () =>
      Promise.reject(new Error('private failure')),
    );
    expect(result).toEqual({ status: 500, body: { error: 'Agent execution failed' } });
  });
});
