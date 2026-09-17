import type { AgentSpan } from '@agentscope/emitter';
import type { LlmClient, LlmRequest } from '../llm/client.js';
import { serializeLlmRequest } from '../llm/serialization.js';
import { runResearcher, type ToolSet } from './researcher.js';
import { runWriter } from './writer.js';

export async function runOrchestrator(
  span: AgentSpan,
  client: LlmClient,
  task: string,
  tools: ToolSet,
): Promise<string> {
  const planRequest: LlmRequest = {
    model: 'fake-model',
    messages: [
      { role: 'system', content: '[orchestrator:plan] Plan the work for the user request.' },
      { role: 'user', content: task },
    ],
  };
  const plan = await span.llmCall(
    {
      model: planRequest.model,
      provider: client.provider,
      prompt: serializeLlmRequest(planRequest),
    },
    () => client.generate(planRequest),
  );
  if (!plan.text) throw new Error('Orchestrator returned no plan');

  const research = await span.delegate('researcher', task, (child) =>
    runResearcher(child, client, task, tools),
  );
  const draft = await span.delegate('writer', task, (child) =>
    runWriter(child, client, task, research),
  );
  const finalRequest: LlmRequest = {
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
  };
  const final = await span.llmCall(
    {
      model: finalRequest.model,
      provider: client.provider,
      prompt: serializeLlmRequest(finalRequest),
    },
    () => client.generate(finalRequest),
  );
  if (!final.text) throw new Error('Orchestrator returned no final response');
  return final.text;
}
