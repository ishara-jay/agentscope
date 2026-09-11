import { describe, expect, it } from 'vitest';
import { FakeLlmClient } from './fake.js';

describe('FakeLlmClient', () => {
  it('returns deterministic text and token usage', async () => {
    const client = new FakeLlmClient();
    const request = {
      model: 'fake-model',
      messages: [
        { role: 'system' as const, content: '[orchestrator:plan] Plan it.' },
        { role: 'user' as const, content: 'Explain agent testing' },
      ],
    };

    const first = await client.generate(request);
    const second = await client.generate(request);

    expect(first).toEqual(second);
    expect(first.text).toContain('Explain agent testing');
    expect(first.usage.inputTokens).toBe(6);
    expect(first.usage.outputTokens).toBeGreaterThan(0);
  });

  it('requests both offline research tools', async () => {
    const result = await new FakeLlmClient().generate({
      model: 'fake-model',
      messages: [
        { role: 'system', content: '[researcher] Research.' },
        { role: 'user', content: 'topic' },
      ],
    });

    expect(result.toolCalls?.map((call) => call.name)).toEqual(['search', 'read_source']);
  });
});
