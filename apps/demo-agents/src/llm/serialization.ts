import type { LlmRequest } from './client.js';

/** Stable JSON representation recorded as the observable LLM prompt. */
export const serializeLlmRequest = (request: LlmRequest): string => JSON.stringify(request);
