import type { AgentSpan } from '@agentscope/emitter';
import type { LlmClient } from '../llm/client.js';

export async function runWriter(
  span: AgentSpan,
  client: LlmClient,
  task: string,
  research: string,
): Promise<string> {
  const result = await span.llmCall({ model: 'fake-model', provider: client.provider }, () =>
    client.generate({
      model: 'fake-model',
      messages: [
        { role: 'system', content: '[writer] Draft a clear answer from the research.' },
        { role: 'user', content: task },
        { role: 'assistant', content: `Internal research: ${research}` },
      ],
    }),
  );
  if (!result.text) throw new Error('Writer returned no draft');
  return result.text;
}
