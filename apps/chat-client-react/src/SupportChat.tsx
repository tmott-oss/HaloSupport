import { FormEvent, useMemo, useState } from "react";

import { SupportApiClient } from "./api";
import type { ChatMessage, ChatMessageResponse, SupportChatContext } from "./types";
import "./styles.css";

const defaultQuestion = "Can we tell a customer Halosight is SOC 2 certified and guarantees ROI?";
const sessionStorageKey = "halosightSupportSessionId";

export interface SupportChatProps {
  apiBaseUrl?: string;
  context: SupportChatContext;
}

export function SupportChat({ apiBaseUrl, context }: SupportChatProps) {
  const api = useMemo(() => new SupportApiClient({ baseUrl: apiBaseUrl }), [apiBaseUrl]);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(defaultQuestion);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastResponse, setLastResponse] = useState<ChatMessageResponse | undefined>();
  const [error, setError] = useState<string | undefined>();

  async function ensureSessionId() {
    const existing = window.localStorage.getItem(sessionStorageKey);
    if (existing) {
      return existing;
    }

    const session = await api.startSession(context);
    window.localStorage.setItem(sessionStorageKey, session.sessionId);
    return session.sessionId;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const message = input.trim();
    if (!message) {
      return;
    }

    setLoading(true);
    setError(undefined);
    setMessages((current) => [...current, { role: "user", content: message }]);

    try {
      const sessionId = await ensureSessionId();
      const response = await api.sendMessage({ sessionId, message, context });
      setLastResponse(response);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: response.reply.content,
          escalated: response.reply.escalated
        }
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The support request could not be sent.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        className="hs-support-tab"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Support
      </button>
      <aside className={`hs-support-panel ${open ? "open" : ""}`} aria-label="Halosight support chat">
        <header className="hs-panel-head">
          <div>
            <h2>Halosight Support</h2>
            <p>Answers from approved content. Escalations create a human-support handoff.</p>
          </div>
          <button className="hs-close" type="button" aria-label="Close support panel" onClick={() => setOpen(false)}>
            x
          </button>
        </header>

        <div className="hs-thread">
          {messages.length === 0 ? (
            <p className="hs-placeholder">Send a question to start a support session.</p>
          ) : (
            messages.map((message, index) => (
              <article className={`hs-message ${message.role}`} key={`${message.role}-${index}`}>
                <strong>{message.role === "user" ? "You" : message.escalated ? "Escalated" : "Halosight"}</strong>
                <p>{message.content}</p>
              </article>
            ))
          )}
          {error ? <p className="hs-error">{error}</p> : null}
        </div>

        <form className="hs-form" onSubmit={handleSubmit}>
          <textarea value={input} onChange={(event) => setInput(event.target.value)} required />
          <div className="hs-actions">
            <button
              type="button"
              onClick={() => setInput("How should Halosight respond when someone says they already use Salesforce?")}
            >
              Salesforce sample
            </button>
            <button type="submit" disabled={loading}>
              {loading ? "Sending" : "Send"}
            </button>
          </div>
        </form>

        {lastResponse ? (
          <details className="hs-details">
            <summary>Response details</summary>
            <pre>
              {JSON.stringify(
                {
                  session: lastResponse.session,
                  chatwoot: lastResponse.reply.chatwoot,
                  slackDelivery: lastResponse.reply.slackDelivery,
                  sources: lastResponse.reply.sources
                },
                null,
                2
              )}
            </pre>
          </details>
        ) : null}
      </aside>
    </>
  );
}
