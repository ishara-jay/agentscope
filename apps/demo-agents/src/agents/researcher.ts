import type { AgentSpan } from '@agentscope/emitter';
import type {
  LlmClient,
  LlmMessage,
  LlmRequest,
  LlmResult,
  ToolCall,
  ToolImplementation,
} from '../llm/client.js';

export type ToolSet = ReadonlyMap<string, ToolImplementation>;

const callLlm = (span: AgentSpan, client: LlmClient, request: LlmRequest): Promise<LlmResult> =>
  span.llmCall({ model: request.model, provider: client.provider }, () => client.generate(request));

const executeTool = async (
  span: AgentSpan,
  tools: ToolSet,
  call: ToolCall,
): Promise<LlmMessage> => {
  const tool = tools.get(call.name);
  if (!tool) throw new Error(`Unknown tool requested: ${call.name}`);
  const value = await span.toolCall(call.name, call.args, () => tool.execute(call.args));
  return { role: 'tool', toolCallId: call.id, content: JSON.stringify(value) };
};

export async function runResearcher(
  span: AgentSpan,
  client: LlmClient,
  task: string,
  tools: ToolSet,
): Promise<string> {
  const messages: LlmMessage[] = [
    {
      role: 'system',
      content: '[researcher] Find and summarize evidence with the available tools.',
    },
    { role: 'user', content: task },
  ];
  const request = {
    model: 'fake-model',
    messages,
    tools: [...tools.values()].map((tool) => tool.definition),
  };
  const decision = await callLlm(span, client, request);
  const toolMessages: LlmMessage[] = [];
  for (const call of decision.toolCalls ?? []) {
    toolMessages.push(await executeTool(span, tools, call));
  }
  const summary = await callLlm(span, client, {
    ...request,
    messages: [...messages, ...toolMessages],
  });
  if (!summary.text) throw new Error('Researcher returned no summary');
  return summary.text;
}
