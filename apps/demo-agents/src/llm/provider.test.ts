import { describe, expect, it } from 'vitest';
import { FakeLlmClient } from './fake.js';
import { createLlmClient } from './provider.js';

describe('LLM provider selection', () => {
  it('defaults to the fake provider', () => {
    expect(createLlmClient()).toBeInstanceOf(FakeLlmClient);
    expect(createLlmClient('fake')).toBeInstanceOf(FakeLlmClient);
  });

  it('rejects providers that are not implemented yet', () => {
    expect(() => createLlmClient('gemini')).toThrow('Unsupported LLM_PROVIDER');
  });
});
