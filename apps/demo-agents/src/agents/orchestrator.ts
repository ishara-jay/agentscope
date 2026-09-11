import type { AgentSpan } from '@agentscope/emitter';
import type { LlmClient } from '../llm/client.js';
import { runResearcher, type ToolSet } from './researcher.js';
import { runWriter } from './writer.js';

export async function runOrchestrator(
  span: AgentSpan,
  client: LlmClient,
  task: string,
  tools: ToolSet,
): Promise<string> {
  const plan = await span.llmCall({ model: 'fake-model', provider: client.provider }, () =>
    client.generate({
      model: 'fake-model',
      messages: [
        { role: 'system', content: '[orchestrator:plan] Plan the work for the user request.' },
        { role: 'user', content: task },
      ],
    }),
  );
  if (!plan.text) throw new Error('Orchestrator returned no plan');

  const research = await span.delegate('researcher', task, (child) =>
    runResearcher(child, client, task, tools),
  );
  const draft = await span.delegate('writer', task, (child) =>
    runWriter(child, client, task, research),
  );
  const final = await span.llmCall({ model: 'fake-model', provider: client.provider }, () =>
    client.generate({
      model: 'fake-model',
      messages: [
        {
          role: 'system',
          content: '[orchestrator:final] Return only the final answer to the user.',
        },
        { role: 'user', content: task },
        { role: 'assistant', content: `Internal plan: ${plan.text}` },
        { role: 'assistant', content: `Internal research: ${research}` },
        { role: 'assistant', content: `Internal draft: ${draft}` },
      ],
    }),
  );
  if (!final.text) throw new Error('Orchestrator returned no final response');
  return final.text;
}
