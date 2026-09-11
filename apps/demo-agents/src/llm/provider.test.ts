import { describe, expect, it } from 'vitest';
import { FakeLlmClient } from './fake.js';
import { createLlmClient } from './provider.js';

describe('LLM provider selection', () => {
  it('defaults to the offline fake provider', () => {
    expect(createLlmClient()).toBeInstanceOf(FakeLlmClient);
    expect(createLlmClient('fake').provider).toBe('fake');
  });

  it('rejects providers that have no adapter yet', () => {
    expect(() => createLlmClient('gemini')).toThrow('Unsupported LLM_PROVIDER: gemini');
  });
});
