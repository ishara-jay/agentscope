import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatScreen } from './ChatScreen.js';

const assistantResponse = (content: string) =>
  Promise.resolve(
    new Response(JSON.stringify({ message: { role: 'assistant', content } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );

afterEach(() => vi.restoreAllMocks());

describe('ChatScreen', () => {
  it('renders the empty chat and prevents empty submission', () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    render(<ChatScreen />);

    expect(screen.getByText('Research, then write.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renders user messages on the right and final assistant messages on the left', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => assistantResponse('Final result'));
    render(<ChatScreen />);

    fireEvent.change(screen.getByLabelText('Message the agent team'), {
      target: { value: 'Hello agents' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    expect((await screen.findByText('Hello agents')).closest('article')).toHaveClass('user');
    expect((await screen.findByText('Final result')).closest('article')).toHaveClass('assistant');
  });

  it('sends all earlier user and assistant messages on each turn', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementationOnce(() => assistantResponse('Answer one'))
      .mockImplementationOnce(() => assistantResponse('Answer two'));
    render(<ChatScreen />);

    const input = screen.getByLabelText('Message the agent team');
    fireEvent.change(input, { target: { value: 'Question one' } });
    fireEvent.submit(input.closest('form')!);
    await screen.findByText('Answer one');
    fireEvent.change(input, { target: { value: 'Follow up' } });
    fireEvent.submit(input.closest('form')!);
    await screen.findByText('Answer two');

    const secondRequest = fetchMock.mock.calls[1]?.[1];
    expect(JSON.parse(String(secondRequest?.body))).toEqual({
      messages: [
        { role: 'user', content: 'Question one' },
        { role: 'assistant', content: 'Answer one' },
        { role: 'user', content: 'Follow up' },
      ],
    });
  });

  it('shows loading, blocks duplicates, and recovers after an inline error', async () => {
    let rejectRequest: ((error: Error) => void) | undefined;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise<Response>((_resolve, reject) => {
          rejectRequest = reject;
        }),
    );
    render(<ChatScreen />);

    fireEvent.change(screen.getByLabelText('Message the agent team'), {
      target: { value: 'Keep this' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    expect(screen.getByRole('status')).toHaveTextContent('Agents are working');
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    fireEvent.submit(screen.getByLabelText('Message the agent team').closest('form')!);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    rejectRequest?.(new Error('offline'));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Your conversation is still here');
    expect(screen.getByText('Keep this')).toBeInTheDocument();

    fetchMock.mockImplementation(() => assistantResponse('Recovered'));
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByText('Recovered')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
