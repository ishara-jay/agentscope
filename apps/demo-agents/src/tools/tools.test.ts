import { describe, expect, it } from 'vitest';
import { readSourceTool, searchTool } from './index.js';

describe('fake tools', () => {
  it('returns deterministic search evidence', async () => {
    await expect(searchTool.execute({ query: 'reliable demos' })).resolves.toMatchObject({
      sourceId: 'source-1',
      snippet: expect.stringContaining('Deterministic tools'),
    });
  });

  it('reads the selected source', async () => {
    await expect(readSourceTool.execute({ sourceId: 'source-1' })).resolves.toContain('source-1');
  });
});
