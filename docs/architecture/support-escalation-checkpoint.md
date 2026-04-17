# Halosight Support Escalation Checkpoint

## Purpose

This document summarizes the current state of the Halosight AI Support Agent MVP and the near-term path toward a production support chat and ticketing workflow.

The current system is intentionally simple. It proves the core loop:

1. Accept a support message.
2. Search approved Halosight knowledge.
3. Answer only when the knowledge base supports the answer.
4. Escalate when confidence is low or the question touches restricted claims.
5. Notify the human support path.
6. Create a local support ticket for escalated conversations.
7. Link the local ticket to the real Chatwoot conversation when Chatwoot is configured.
8. Let support operators inspect and update ticket status locally while opening Chatwoot for human handling.
9. Sync normal Chatwoot agent replies back into the Halosight chat client.

## What Is Built Now

### Backend Support API

The Node.js backend exposes support endpoints from `src/api/support-agent.ts`.

Current endpoints:

- `POST /support`
- `POST /chat/session`
- `POST /chat/message`
- `GET /chat/messages`
- `POST /chatwoot/webhook`
- `GET /support-test`
- `GET /chat-client`
- `GET /debug/config`
- `GET /tickets`
- `GET /tickets/:ticketId`
- `PATCH /tickets/:ticketId`
- `GET /tickets-view`

The backend runs locally with:

```bash
npm run start:support-api
```

The default local port is controlled by `.env`.

### Knowledge-Based Answers

The agent searches local Halosight knowledge files and uses simple keyword scoring to find relevant sources.

Current knowledge sources include:

- `data/halosight`
- `docs/prompts`
- supporting Markdown, JSON, YAML, and YML files

This is enough for MVP validation. It is not intended to be the final retrieval architecture.

### Guardrails and Escalation Rules

The agent escalates instead of inventing answers when:

- confidence is low
- the user asks about restricted claims
- the question requires authoritative confirmation

Examples of restricted areas:

- SOC 2 or other security certifications
- HIPAA
- SSO
- data retention
- encryption
- customer-data training
- exact ROI numbers
- guaranteed revenue lift
- customer logos or case studies

### Slack Escalation

Slack escalation is currently wired through an Incoming Webhook stored locally in `.env`.

When escalation is triggered, the backend posts a message to the configured Slack channel with:

- escalation heading
- user message
- escalation reason
- source files used by the knowledge search

Slack delivery is now validated strictly. The backend only marks Slack delivery as successful when Slack returns the expected `ok` response.

### Chat Sessions

The chat session API tracks a support session with:

- session ID
- surface, such as public website
- route
- knowledge set
- human support status
- transcript messages
- local ticket metadata when escalation occurs
- linked Chatwoot conversation ID and URL when Chatwoot escalation succeeds
- human support replies received from Chatwoot webhooks

Sessions are persisted locally in:

```text
.halosight-runtime/chat-sessions.json
```

When `DATABASE_URL` is configured, sessions are persisted in Postgres instead. The first durable store uses a JSONB-backed `support_chat_sessions` table so the API behavior can stay stable while the storage layer becomes deploy-safe.

The local JSON file remains the fallback for development. It is useful because local conversations and tickets survive backend restarts during testing, but it should not be used for production traffic.

### Local Ticket System

Escalated chat sessions now create or reuse a local support ticket.

Current ticket fields:

- ticket ID
- session ID
- status
- escalation reason
- source paths
- Chatwoot conversation ID, when available
- Chatwoot conversation URL, when available
- created timestamp
- updated timestamp

Supported ticket statuses:

- open
- waiting_on_human
- waiting_on_customer
- resolved

Ticket data is stored with the local chat session record. This provides a simple support-ticket model before real Chatwoot ticket workflow is active.

### Local Ticket Operations Page

The backend serves a local support-ops page at:

```text
http://localhost:3001/tickets-view
```

The page supports:

- listing local tickets
- selecting a ticket
- viewing escalation reason
- viewing source paths
- viewing transcript
- opening the linked Chatwoot conversation
- changing ticket status
- saving the status update through the backend API

This is a local/staging operator test surface. It is not yet a production admin interface.

### Safe Debug Endpoint

The backend exposes:

```text
http://localhost:3001/debug/config
```

This reports safe configuration state without exposing secrets. It includes Slack webhook shape checks, Chatwoot mode, session count, ticket count, and local store status.

### React Chat Client

A React chat client skeleton exists in:

```text
apps/chat-client-react
```

The backend can serve the built client at:

```text
http://localhost:3001/chat-client
```

Build the client with:

```bash
npm run build:chat-client
```

The current client is a local/staging integration test surface. It starts sessions, sends user messages, shows AI/escalation responses, and polls for human replies after escalation. It is the starting point for a future embeddable website support tab.

### Chatwoot Escalation

The repo includes a Chatwoot provider boundary:

- `src/providers/chatwoot.ts`
- `src/providers/interfaces.ts`
- `src/providers/factory.ts`

Current state:

- if Chatwoot credentials are not configured, mock Chatwoot escalation creates a mock conversation object
- if Chatwoot credentials are configured, the backend creates a real Chatwoot contact and conversation
- escalation transcript and context are posted into Chatwoot as a private note
- Chatwoot conversation URL is returned in the backend escalation response
- the local support ticket stores the Chatwoot conversation ID and URL
- repeated escalations for the same session reuse the existing linked Chatwoot conversation
- Chatwoot `message_created` webhooks are verified with Chatwoot's HMAC signature headers
- normal public Chatwoot agent replies are stored as `human` transcript messages
- the React chat client polls `GET /chat/messages` after escalation and displays human replies as `Support`
- verified in Render staging on April 17, 2026 with a real Chatwoot conversation created in account `161157`
- verified in Render staging on April 17, 2026 with a real Chatwoot agent reply appearing back in the Halosight chat client

Verified staging result:

- Chatwoot contact name: `Halosight Support Visitor {session prefix}`
- Chatwoot conversation status: `open`
- private note includes escalation reason, transcript, session ID, source, route, and knowledge set
- public agent reply in Chatwoot appears in the Halosight chat client as a `Support` message

## What Is Still Mocked

The following are not production-ready yet:

- authenticated user/account context
- production knowledge retrieval
- website embed packaging
- security controls around public API exposure
- durable production persistence

Session persistence and ticket lifecycle now exist locally, in staging, and through optional Postgres durability. Chatwoot conversation creation and human reply sync are real when credentials and webhooks are configured. The current Postgres store is an MVP durability layer, not the final long-term analytics or reporting model.

## Current Local Test Flow

1. Set local environment variables in `.env`.
2. Build the React client:

```bash
npm run build:chat-client
```

3. Start the backend:

```bash
npm run start:support-api
```

4. Open:

```text
http://localhost:3001/chat-client
```

5. Test a normal answer:

```text
What does Halosight do?
```

6. Test escalation:

```text
Can we tell a customer Halosight is SOC 2 certified and guarantees ROI?
```

Expected result:

- chat UI marks the response as escalated
- Slack receives an escalation message
- backend response shows Slack delivery as `delivered: true`
- Chatwoot creates a real open conversation when credentials are configured
- local ticket is created with status `open`
- ticket appears in `http://localhost:3001/tickets-view`
- ticket detail includes an `Open in Chatwoot` link when Chatwoot escalation succeeds
- public Chatwoot agent replies appear back in the chat client after a short polling delay

7. Open local ticket operations:

```text
http://localhost:3001/tickets-view
```

8. Select the ticket and update its status.

Expected result:

- ticket detail loads with transcript
- status can be changed to `waiting_on_human`, `waiting_on_customer`, `open`, or `resolved`
- status persists after refresh and backend restart

## Shareable Links

The local app links only work on the machine running the backend. They are useful for live screen share or local demo:

```text
http://localhost:3001/chat-client
http://localhost:3001/tickets-view
http://localhost:3001/debug/config
```

For a CTO review outside the local machine, share the GitHub document after this branch is merged:

```text
https://github.com/tmott-oss/HaloSupport/blob/main/docs/architecture/support-escalation-checkpoint.md
```

For an interactive remote demo, the backend and chat/ticket pages need to be deployed first.

## Recommended Next Milestones

### Milestone 1: Stabilize Local MVP

- Keep `.env` loading simple and documented.
- Keep the safe health/debug endpoint for local environment validation.
- Add automated tests for low-confidence and restricted-claim escalation.
- Keep Slack as the temporary human notification channel.

### Milestone 2: Real Chatwoot Escalation

- Keep validating Chatwoot credentials in staging as environments change.
- Confirm real Chatwoot contacts and conversations are created on escalation after each deployment.
- Confirm transcript and source context remain visible to support agents.
- Confirm Chatwoot webhook signature verification and reply sync after webhook or secret changes.
- Decide whether Slack remains as a parallel notification after Chatwoot is live.

### Milestone 3: Support Ticket Model

- Continue moving toward Chatwoot as the source of truth for ticket state.
- Keep local tickets as debug/cache metadata and avoid building a parallel ticketing system.
- If no, move the local ticket/session store to production persistence and sync with Chatwoot.
- Add ownership, priority, and internal notes only after the source-of-truth decision.

### Milestone 4: Website Support Tab

- Package the React client as an embeddable support widget.
- Add a website-safe initialization script.
- Restrict public-site knowledge to approved public support content.
- Add CORS and origin controls before external deployment.

### Milestone 5: Production Deployment

- Deploy the backend as a small service.
- Store secrets in the deployment platform, not in local files.
- Configure `DATABASE_URL` for durable persistence.
- Add logging for escalation outcomes.
- Add monitoring for Slack and Chatwoot delivery failures.
- Protect ticket operations behind authentication before any public deployment.
- Add backup, retention, and migration policy for Postgres before production traffic.

## Engineering Notes

The current architecture keeps the AI wrapper separate from Chatwoot. This is the right MVP shape because:

- the support AI can answer simple questions without creating a ticket
- Chatwoot can remain focused on human escalation and ticket handling
- the wrapper can enforce Halosight-specific knowledge and guardrails
- Slack can remain an interim or parallel alerting path while Chatwoot owns human support workflow

The next engineering priority should be validating Postgres persistence in deployment and hardening the website embed path. Avoid adding more AI complexity until the support workflow is stable.
