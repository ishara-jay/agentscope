import { describe, expect, it } from 'vitest';
import { startSession } from './index.js';
import type { LlmCallResultLike } from './index.js';

/** Stands in for `LlmClient.generate`: a result that carries usage, like `LlmResult`. */
const fakeLlm = (text: string): Promise<LlmCallResultLike & { text: string }> =>
  Promise.resolve({ text, usage: { inputTokens: 12, outputTokens: 3 } });

describe('emitter B1 stubs — the wrappers are transparent', () => {
  it('agent → delegate → llmCall / toolCall pass results straight through', async () => {
    const session = startSession({ endpoint: 'http://localhost:0' });

    const result = await session.agent('orchestrator', { input: 'task' }, async (span) => {
      const plan = await span.llmCall({ model: 'fake-model', provider: 'fake' }, () =>
        fakeLlm('plan'),
      );
      const research = await span.delegate('researcher', 'dig', async (child) => {
        const hits = await child.toolCall('search', { q: 'x' }, () => Promise.resolve(['a', 'b']));
        const summary = await child.llmCall({ model: 'fake-model', provider: 'fake' }, () =>
          fakeLlm('sum'),
        );
        return { hits, summary: summary.text };
      });
      return { plan: plan.text, research };
    });
    await session.flush();

    expect(result).toEqual({ plan: 'plan', research: { hits: ['a', 'b'], summary: 'sum' } });
  });

  it('an error thrown inside a span propagates unchanged — the wrapper never swallows it', async () => {
    const session = startSession({ endpoint: 'http://localhost:0', onError: 'silent' });
    const boom = new Error('boom');

    await expect(
      session.agent('orchestrator', {}, (span) =>
        span.toolCall('search', {}, () => Promise.reject(boom)),
      ),
    ).rejects.toBe(boom);
  });

  it('llmCall only accepts results that carry usage (the LlmClient seam, checked at compile time)', async () => {
    const session = startSession({ endpoint: 'http://localhost:0' });

    await session.agent('orchestrator', {}, async (span) => {
      const noUsage = () => Promise.resolve({ text: 'no usage' });
      // @ts-expect-error a result without `usage` must not satisfy LlmCallResultLike
      await span.llmCall({ model: 'm', provider: 'p' }, noUsage);
    });
  });
});
