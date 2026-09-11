import type { LlmClient } from './client.js';
import { FakeLlmClient } from './fake.js';

export function createLlmClient(provider = process.env.LLM_PROVIDER ?? 'fake'): LlmClient {
  if (provider === 'fake') return new FakeLlmClient();
  throw new Error(`Unsupported LLM_PROVIDER: ${provider}`);
}
