import { z } from 'zod';

export const ChatMessage = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
});
export type ChatMessage = z.infer<typeof ChatMessage>;

export const ChatRequest = z.object({
  messages: z.array(ChatMessage).min(1),
});
export type ChatRequest = z.infer<typeof ChatRequest>;

export const ChatResponse = z.object({
  message: z.object({
    role: z.literal('assistant'),
    content: z.string().min(1),
  }),
});
export type ChatResponse = z.infer<typeof ChatResponse>;
