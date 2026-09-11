import { describe, expect, it } from 'vitest';
import { parseTask, scaffoldMessage } from './cli.js';

describe('demo-agent CLI scaffold', () => {
  it('accepts an optional positional task', () => {
    expect(parseTask([])).toBeUndefined();
    expect(parseTask(['summarize', 'the report'])).toBe('summarize the report');
    expect(parseTask(['--', 'summarize', 'the report'])).toBe('summarize the report');
  });

  it('prints a scaffold-ready message without running agents', () => {
    expect(scaffoldMessage()).toContain('scaffold ready');
    expect(scaffoldMessage('review this')).toContain('review this');
  });
});
