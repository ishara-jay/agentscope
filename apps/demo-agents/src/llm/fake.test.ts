import { describe, expect, it } from 'vitest';
import { FakeLlmClient } from './fake.js';

describe('FakeLlmClient', () => {
  it('returns deterministic plans with token usage', async () => {
    const result = await new FakeLlmClient().generate({
      model: 'fake-model',
      messages: [
        { role: 'system', content: '[orchestrator:plan] Plan the work.' },
        { role: 'user', content: 'Explain reproducibility' },
      ],
    });

    expect(result.text).toContain('Explain reproducibility');
    expect(result.usage.inputTokens).toBeGreaterThan(0);
    expect(result.usage.outputTokens).toBeGreaterThan(0);
  });

  it('requests the two deterministic research tools in order', async () => {
    const result = await new FakeLlmClient().generate({
      model: 'fake-model',
      messages: [
        { role: 'system', content: '[researcher] Find evidence.' },
        { role: 'user', content: 'Explain reproducibility' },
      ],
    });

    expect(result.toolCalls?.map((call) => call.name)).toEqual(['search', 'read_source']);
  });
});
