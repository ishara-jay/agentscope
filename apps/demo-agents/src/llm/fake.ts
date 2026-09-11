import type { LlmClient, LlmRequest, LlmResult } from './client.js';

const tokens = (text: string): number => Math.max(1, text.trim().split(/\s+/).length);

const result = (
  request: LlmRequest,
  text?: string,
  toolCalls?: LlmResult['toolCalls'],
): LlmResult => ({
  ...(text === undefined ? {} : { text }),
  ...(toolCalls === undefined ? {} : { toolCalls }),
  usage: {
    inputTokens: request.messages.reduce((total, message) => total + tokens(message.content), 0),
    outputTokens: tokens(text ?? JSON.stringify(toolCalls)),
  },
});

const systemInstruction = (request: LlmRequest): string =>
  request.messages.find((message) => message.role === 'system')?.content ?? '';

export class FakeLlmClient implements LlmClient {
  readonly provider = 'fake';

  async generate(request: LlmRequest): Promise<LlmResult> {
    const system = systemInstruction(request);
    const lastUser = [...request.messages].reverse().find((message) => message.role === 'user');
    const prompt = lastUser?.content ?? 'the request';

    if (system.includes('[orchestrator:plan]')) {
      return result(
        request,
        `Plan: research reliable background for ${prompt}, then write a concise answer.`,
      );
    }

    if (
      system.includes('[researcher]') &&
      !request.messages.some((message) => message.role === 'tool')
    ) {
      return result(request, undefined, [
        { id: 'fake-search-1', name: 'search', args: { query: prompt } },
        { id: 'fake-source-1', name: 'read_source', args: { sourceId: 'source-1' } },
      ]);
    }

    if (system.includes('[researcher]')) {
      const evidence = request.messages
        .filter((message) => message.role === 'tool')
        .map((message) => message.content)
        .join(' ');
      return result(request, `Research summary for ${prompt}: ${evidence}`);
    }

    if (system.includes('[writer]')) {
      return result(
        request,
        `Draft answer for ${prompt}: the research was reviewed and condensed.`,
      );
    }

    if (system.includes('[orchestrator:final]')) {
      const browserMessages = request.messages.filter(
        (message) => message.role === 'user' || message.role === 'assistant',
      );
      const priorUser = browserMessages
        .filter((message) => message.role === 'user')
        .at(-2)?.content;
      const context = priorUser ? ` I also retained the earlier context about “${priorUser}”.` : '';
      return result(
        request,
        `Final response to “${prompt}”: the orchestrator completed research and writing.${context}`,
      );
    }

    return result(request, `Fake response for ${prompt}.`);
  }
}
