import type { AgentSpan } from '@agentscope/emitter';
import type { ChatMessage } from '@agentscope/contract';
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

const browserMessages = (history: ChatMessage[]): LlmMessage[] => history.map((message) => message);

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
  history: ChatMessage[],
  tools: ToolSet,
): Promise<string> {
  const messages: LlmMessage[] = [
    {
      role: 'system',
      content: '[researcher] Find and summarize evidence with the available tools.',
    },
    ...browserMessages(history),
  ];
  const request = {
    model: 'fake-model',
    messages,
    tools: [...tools.values()].map((tool) => tool.definition),
  };
  const decision = await callLlm(span, client, request);
  const toolMessages = await Promise.all(
    (decision.toolCalls ?? []).map((call) => executeTool(span, tools, call)),
  );
  const summary = await callLlm(span, client, {
    ...request,
    messages: [...messages, ...toolMessages],
  });
  if (!summary.text) throw new Error('Researcher returned no summary');
  return summary.text;
}
