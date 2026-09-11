export type JsonSchema = Record<string, unknown>;

export type LlmMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
};

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: JsonSchema;
};

export type ToolCall = {
  id: string;
  name: string;
  args: unknown;
};

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type LlmRequest = {
  model: string;
  messages: LlmMessage[];
  tools?: ToolDefinition[];
};

export type LlmResult = {
  text?: string;
  toolCalls?: ToolCall[];
  usage: TokenUsage;
};

export interface LlmClient {
  readonly provider: string;
  generate(request: LlmRequest): Promise<LlmResult>;
}

/** Executable behavior is kept separate from the provider-facing metadata. */
export interface ToolImplementation<TArgs = unknown, TResult = unknown> {
  readonly definition: ToolDefinition;
  execute(args: TArgs): Promise<TResult>;
}
