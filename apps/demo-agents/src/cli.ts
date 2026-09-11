export function parseTask(args: string[]): string | undefined {
  const task = args.filter((arg, index) => !(index === 0 && arg === '--')).join(' ').trim();
  return task || undefined;
}

export function scaffoldMessage(task?: string): string {
  return task
    ? `Demo agents scaffold ready for task: ${task}`
    : 'Demo agents scaffold ready. Pass an optional task to the CLI.';
}
