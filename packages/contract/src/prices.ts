import { z } from 'zod';

/**
 * Schema for the runtime-read price file (FR-3.3 / DD-8), keyed by model ID.
 * A missing or malformed file degrades to an empty table — every model then
 * shows cost as "unknown" (FR-3.3.1); it never crashes anything.
 */
export const ModelPrice = z.object({
  /** USD per 1M input tokens. */
  input_per_mtok: z.number().nonnegative(),
  /** USD per 1M output tokens. */
  output_per_mtok: z.number().nonnegative(),
});
export type ModelPrice = z.infer<typeof ModelPrice>;

export const PriceTable = z.record(z.string(), ModelPrice);
export type PriceTable = z.infer<typeof PriceTable>;
