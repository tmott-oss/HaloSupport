# Halosight Support Escalation Checkpoint

## Purpose

This document summarizes the current state of the Halosight AI Support Agent MVP and the near-term path toward a production support chat and ticketing workflow.

The current system is intentionally simple. It proves the core loop:

1. Accept a support message.
2. Search approved Halosight knowledge.
3. Answer only when the knowledge base supports the answer.
4. Escalate when confidence is low or the question touches restricted claims.
5. Notify the human support path.

## What Is Built Now

### Backend Support API

The Node.js backend exposes support endpoints from `src/api/support-agent.ts`.

Current endpoints:

- `POST /support`
- `POST /chat/session`
- `POST /chat/message`
- `GET /support-test`
- `GET /chat-client`

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

The chat session API tracks an in-memory support session with:

- session ID
- surface, such as public website
- route
- knowledge set
- human support status
- transcript messages

This is currently local and in-memory. Restarting the backend clears active sessions.

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

The current client is a local integration test surface. It is the starting point for a future embeddable website support tab.

### Chatwoot Adapter Skeleton

The repo includes a Chatwoot provider boundary:

- `src/providers/chatwoot.ts`
- `src/providers/interfaces.ts`
- `src/providers/factory.ts`

Current state:

- mock Chatwoot escalation can create a mock conversation object
- real Chatwoot API provider is scaffolded
- production credentials and real API behavior are not active yet

## What Is Still Mocked

The following are not production-ready yet:

- session persistence
- real Chatwoot conversation creation
- human reply synchronization
- ticket lifecycle state
- authenticated user/account context
- production knowledge retrieval
- production deployment
- website embed packaging
- security controls around public API exposure

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

## Recommended Next Milestones

### Milestone 1: Stabilize Local MVP

- Keep `.env` loading simple and documented.
- Add a small health/debug endpoint for local environment validation.
- Add automated tests for low-confidence and restricted-claim escalation.
- Keep Slack as the temporary human notification channel.

### Milestone 2: Real Chatwoot Escalation

- Configure Chatwoot credentials through `.env`.
- Create real Chatwoot contacts and conversations on escalation.
- Forward transcript and source context into Chatwoot.
- Return the Chatwoot conversation URL to the backend response.

### Milestone 3: Support Ticket Model

- Define a minimal ticket state model:
  - open
  - waiting_on_human
  - waiting_on_customer
  - resolved
- Persist ticket/session records.
- Connect escalation reason and transcript to the ticket.

### Milestone 4: Website Support Tab

- Package the React client as an embeddable support widget.
- Add a website-safe initialization script.
- Restrict public-site knowledge to approved public support content.
- Add CORS and origin controls before external deployment.

### Milestone 5: Production Deployment

- Deploy the backend as a small service.
- Store secrets in the deployment platform, not in local files.
- Add logging for escalation outcomes.
- Add monitoring for Slack and Chatwoot delivery failures.

## Engineering Notes

The current architecture keeps the AI wrapper separate from Chatwoot. This is the right MVP shape because:

- the support AI can answer simple questions without creating a ticket
- Chatwoot can remain focused on human escalation and ticket handling
- the wrapper can enforce Halosight-specific knowledge and guardrails
- Slack can remain an interim alerting path while Chatwoot is wired up

The next engineering priority should be persistence and real Chatwoot escalation, not more AI complexity.
