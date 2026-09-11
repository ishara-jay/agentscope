import type { ChatMessage } from '@agentscope/contract';
import type { AgentSpan } from '@agentscope/emitter';
import type { LlmClient } from '../llm/client.js';
import { runResearcher, type ToolSet } from './researcher.js';
import { runWriter } from './writer.js';

export async function runOrchestrator(
  span: AgentSpan,
  client: LlmClient,
  history: ChatMessage[],
  tools: ToolSet,
): Promise<string> {
  const plan = await span.llmCall({ model: 'fake-model', provider: client.provider }, () =>
    client.generate({
      model: 'fake-model',
      messages: [
        { role: 'system', content: '[orchestrator:plan] Plan the work for the user request.' },
        ...history,
      ],
    }),
  );
  if (!plan.text) throw new Error('Orchestrator returned no plan');

  const latestTask = [...history].reverse().find((message) => message.role === 'user')?.content;
  if (!latestTask) throw new Error('Conversation must contain a user message');

  const research = await span.delegate('researcher', latestTask, (child) =>
    runResearcher(child, client, history, tools),
  );
  const draft = await span.delegate('writer', latestTask, (child) =>
    runWriter(child, client, history, research),
  );
  const final = await span.llmCall({ model: 'fake-model', provider: client.provider }, () =>
    client.generate({
      model: 'fake-model',
      messages: [
        {
          role: 'system',
          content: '[orchestrator:final] Return only the final answer to the user.',
        },
        ...history,
        { role: 'assistant', content: `Internal plan: ${plan.text}` },
        { role: 'assistant', content: `Internal research: ${research}` },
        { role: 'assistant', content: `Internal draft: ${draft}` },
      ],
    }),
  );
  if (!final.text) throw new Error('Orchestrator returned no final response');
  return final.text;
}
