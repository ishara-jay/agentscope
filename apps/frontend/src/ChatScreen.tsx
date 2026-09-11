import { FormEvent, useState } from 'react';
import { ChatResponse, type ChatMessage, type ChatRequest } from '@agentscope/contract';

const requestChat = async (messages: ChatMessage[]): Promise<ChatMessage> => {
  const payload: ChatRequest = { messages };
  const response = await fetch('/demo-api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
  const parsed = ChatResponse.safeParse(await response.json());
  if (!parsed.success) throw new Error('The demo service returned an invalid response');
  return parsed.data.message;
};

export function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedHistory, setFailedHistory] = useState<ChatMessage[] | null>(null);

  const send = async (history: ChatMessage[]) => {
    if (pending) return;
    setPending(true);
    setError(null);
    setFailedHistory(null);
    try {
      const assistant = await requestChat(history);
      setMessages([...history, assistant]);
    } catch {
      setError('The agents could not complete that request. Your conversation is still here.');
      setFailedHistory(history);
    } finally {
      setPending(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || pending) return;
    const history = [...messages, { role: 'user' as const, content }];
    setMessages(history);
    setDraft('');
    void send(history);
  };

  return (
    <main className="chat-shell">
      <header className="chat-header">
        <div className="brand-mark" aria-hidden="true">
          A
        </div>
        <div>
          <p className="eyebrow">AgentScope demo</p>
          <h1>Ask the agent team</h1>
        </div>
        <span className="status">
          <i /> Service ready
        </span>
      </header>

      <section className="transcript" aria-label="Conversation" aria-live="polite">
        {messages.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon" aria-hidden="true">
              ✦
            </span>
            <h2>Research, then write.</h2>
            <p>A specialist workflow handles the work. You only see its final answer.</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <article className={`message ${message.role}`} key={`${message.role}-${index}`}>
              <span className="message-label">
                {message.role === 'user' ? 'You' : 'Agent team'}
              </span>
              <p>{message.content}</p>
            </article>
          ))
        )}

        {pending && (
          <div className="waiting" role="status">
            <span />
            <span />
            <span />
            <em>Agents are working</em>
          </div>
        )}

        {error && (
          <div className="request-error" role="alert">
            <span>{error}</span>
            <button
              type="button"
              disabled={pending}
              onClick={() => failedHistory && void send(failedHistory)}
            >
              Retry
            </button>
          </div>
        )}
      </section>

      <form className="composer" onSubmit={submit}>
        <label htmlFor="message">Message the agent team</label>
        <div className="composer-row">
          <textarea
            id="message"
            value={draft}
            disabled={pending}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask a question or follow up…"
            rows={2}
          />
          <button type="submit" disabled={pending || !draft.trim()} aria-label="Send message">
            <span aria-hidden="true">↑</span>
          </button>
        </div>
        <p>Conversation history lives only in this browser tab.</p>
      </form>
    </main>
  );
}
