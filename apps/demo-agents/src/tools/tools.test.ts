import { describe, expect, it } from 'vitest';
import { readSourceTool, searchTool } from './index.js';

describe('offline tools', () => {
  it('returns stable search and source results', async () => {
    await expect(searchTool.execute({ query: 'agents' })).resolves.toEqual([
      {
        sourceId: 'source-1',
        title: 'Offline result for agents',
        snippet: 'Deterministic background material about agents.',
      },
    ]);
    await expect(readSourceTool.execute({ sourceId: 'source-1' })).resolves.toEqual({
      sourceId: 'source-1',
      content: 'Verified offline demo content from source-1.',
    });
  });
});
