import { FormEvent, useEffect, useMemo, useState } from "react";

import { SupportApiClient, SupportApiError } from "./api";
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
  const [sessionId, setSessionId] = useState<string | undefined>(() => window.localStorage.getItem(sessionStorageKey) ?? undefined);
  const [error, setError] = useState<string | undefined>();
  const shouldPollForReplies = Boolean(open && sessionId && lastResponse?.session.humanSupportStatus === "escalated");

  useEffect(() => {
    if (!shouldPollForReplies || !sessionId) {
      return;
    }

    let active = true;

    async function refreshMessages() {
      try {
        const response = await api.getMessages(sessionId);
        if (active) {
          setMessages(response.messages);
        }
      } catch (caught) {
        if (caught instanceof SupportApiError && caught.status === 404) {
          window.localStorage.removeItem(sessionStorageKey);
          setSessionId(undefined);
        }
      }
    }

    refreshMessages();
    const interval = window.setInterval(refreshMessages, 5000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [api, sessionId, shouldPollForReplies]);

  async function ensureSessionId() {
    const existing = window.localStorage.getItem(sessionStorageKey);
    if (existing) {
      return existing;
    }

    return startFreshSession();
  }

  async function startFreshSession() {
    const session = await api.startSession(context);
    window.localStorage.setItem(sessionStorageKey, session.sessionId);
    setSessionId(session.sessionId);
    return session.sessionId;
  }

  function messageLabel(message: ChatMessage) {
    if (message.role === "user") {
      return "You";
    }

    if (message.role === "human") {
      return "Support";
    }

    return message.escalated ? "Escalated" : "Halosight";
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
      let response: ChatMessageResponse;

      try {
        response = await api.sendMessage({ sessionId, message, context });
      } catch (caught) {
        // A redeploy can leave the browser with an old local session ID.
        // If the API cannot find that session, clear it and retry once.
        if (!(caught instanceof SupportApiError) || caught.status !== 404) {
          throw caught;
        }

        window.localStorage.removeItem(sessionStorageKey);
        setSessionId(undefined);
        const freshSessionId = await startFreshSession();
        response = await api.sendMessage({ sessionId: freshSessionId, message, context });
      }

      setLastResponse(response);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: response.reply.content,
          escalated: response.reply.escalated
        }
      ]);
      setInput("");
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
                <strong>{messageLabel(message)}</strong>
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
