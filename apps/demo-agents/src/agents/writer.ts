import type { AgentSpan } from '@agentscope/emitter';
import type { LlmClient, LlmRequest } from '../llm/client.js';
import { serializeLlmRequest } from '../llm/serialization.js';

export async function runWriter(
  span: AgentSpan,
  client: LlmClient,
  task: string,
  research: string,
): Promise<string> {
  const request: LlmRequest = {
    model: 'fake-model',
    messages: [
      { role: 'system', content: '[writer] Draft a clear answer from the research.' },
      { role: 'user', content: task },
      { role: 'assistant', content: `Internal research: ${research}` },
    ],
  };
  const result = await span.llmCall(
    {
      model: request.model,
      provider: client.provider,
      prompt: serializeLlmRequest(request),
    },
    () => client.generate(request),
  );
  if (!result.text) throw new Error('Writer returned no draft');
  return result.text;
}
