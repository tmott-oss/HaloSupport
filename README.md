# Halosight AI Support Agent (MVP)

## What This Is

This project is a simple MVP backend for a Halosight AI support agent.

It accepts a user message, searches the local Halosight knowledge base, returns a grounded answer when confidence is high enough, and simulates escalation when the answer is uncertain or the request touches restricted claims.

## What It Does

- Answers common support and positioning questions from approved local source material
- Searches the Halosight knowledge base with simple keyword matching
- Returns source paths and snippets used for the response
- Escalates when confidence is low
- Escalates when requests require authoritative confirmation, such as security certifications, ROI claims, customer proof, or exact integration behavior

## What It Does Not Do

- It does not call a real LLM yet
- It does not handle billing, payments, account permissions, or sensitive account actions
- It does not invent answers outside the supplied knowledge base
- It does not send customer-facing messages automatically
- It does not host or modify Chatwoot itself

If it is not sure, it escalates.

## Project Layout

- `src/api/support-agent.ts`: MVP HTTP API
- `data/halosight/`: Halosight knowledge base and guardrails
- `prompts/halosight/`: global and specialist agent instructions
- `docs/`: agent blueprint and original MVP planning docs
- `src/runtime/halosight.ts`: prompt and context loading helpers
- `src/providers/`: mock and future integration provider boundaries

## Run Locally

Install dependencies:

```bash
npm install
```

Start the support API:

```bash
npm run start:support-api
```

Build for a staging deployment:

```bash
npm run build:staging
```

Start the compiled support API:

```bash
npm run start:support-api:prod
```

For local secrets, copy `.env.example` to `.env` and fill in private values:

```bash
cp .env.example .env
```

Health check:

```bash
curl http://localhost:3000/health
```

Safe local config check:

```bash
curl http://localhost:3000/debug/config
```

This reports whether Slack and Chatwoot are configured without exposing secret values.

Set `SUPPORT_OPS_USERNAME` and `SUPPORT_OPS_PASSWORD` to protect local support operations routes with Basic Auth. When those values are set, `/tickets-view`, `/tickets`, `/tickets/:ticketId`, and `/debug/config` require credentials. Chat and `/health` remain public.

Local chat sessions are stored in `.halosight-runtime/chat-sessions.json` so test sessions survive backend restarts. This runtime folder is ignored by Git.
If `POST /chat/message` receives a `sessionId` that cannot be found, the API returns `404` instead of silently creating a replacement session.
When a chat message escalates, the API creates or reuses a local ticket on the session with an `open` status, escalation reason, and source paths. This is an MVP bridge toward a real Chatwoot ticket workflow.

List local tickets:

```bash
curl http://localhost:3000/tickets
```

Inspect one local ticket:

```bash
curl http://localhost:3000/tickets/ticket-id-here
```

Update local ticket status:

```bash
curl -X PATCH http://localhost:3000/tickets/ticket-id-here \
  -H 'Content-Type: application/json' \
  -d '{"status":"resolved"}'
```

Open the local ticket operations page:

```text
http://localhost:3000/tickets-view
```

## Chatwoot Hosting Expectations

Chatwoot is expected to run as a separate service. This repo does not fork, vendor, deploy, or customize Chatwoot source code.

The Halosight support agent treats Chatwoot as the human-support backend. The support agent owns the AI chat flow, knowledge search, guardrails, and escalation decision. Chatwoot owns the human inbox, agent workflow, and escalated conversation record.

Acceptable Chatwoot hosting options include:

- Chatwoot Cloud
- a self-hosted Chatwoot deployment managed separately
- a future company-standard deployment target approved by engineering

The support agent only needs Chatwoot to provide:

- a reachable Chatwoot base URL
- a Chatwoot account ID
- an inbox ID for Halosight support escalations
- an API access token with permission to create contacts, conversations, and messages
- a support team process for monitoring and responding to the Chatwoot inbox

Configure these values as environment variables:

```text
CHATWOOT_BASE_URL=https://app.chatwoot.com
CHATWOOT_ACCOUNT_ID=your-account-id
CHATWOOT_INBOX_ID=your-inbox-id
CHATWOOT_API_TOKEN=your-api-token
CHATWOOT_WEBHOOK_TOKEN=optional-shared-secret
```

When these values are present, an escalation creates or reuses a Chatwoot conversation and posts the transcript/context as a private note. The local ticket stores the Chatwoot conversation ID and URL so operators can open the real conversation from `/tickets-view`.

When these values are missing, the backend uses a mock Chatwoot provider. That is useful for local development, but it is not a production support workflow.

For human reply sync, configure Chatwoot to send message webhooks to:

```text
https://your-support-service.example.com/chatwoot/webhook
```

If `CHATWOOT_WEBHOOK_TOKEN` is set, include the same value as either the `x-halosight-webhook-token` header, the `x-chatwoot-webhook-token` header, or a `?token=` query parameter. The backend records non-private Chatwoot `outgoing` messages as `human` transcript messages, and the React chat client polls `GET /chat/messages` after escalation so the user can see human replies.

For production, Chatwoot should be treated as the support ticket source of truth unless engineering decides otherwise. The local ticket store is only MVP/debug metadata and should not become a parallel long-term ticketing system.

Still to be decided before production:

- whether webhook-based human reply sync is sufficient or should move to a stronger realtime path
- whether Slack remains as a parallel internal notification channel
- whether Chatwoot is hosted through Chatwoot Cloud or a self-hosted environment
- what retention, backup, access-control, and support-agent assignment policies apply inside Chatwoot

Ask a support question:

```bash
curl -s -X POST http://localhost:3000/support \
  -H 'Content-Type: application/json' \
  -d '{"message":"How should Halosight respond when someone says they already use Salesforce?"}'
```

## API

### `POST /support`

Request:

```json
{
  "message": "Can we tell a customer Halosight is SOC 2 certified?"
}
```

Response:

```json
{
  "response": "I do not have enough verified Halosight source material to answer that confidently...",
  "confidence": 1,
  "escalated": true,
  "escalationReason": "The request touches claims that require authoritative confirmation before external use.",
  "sources": []
}
```

## Guardrails

The agent must:

- Only use approved information
- Be clear and short
- Escalate when unsure
- Avoid unsupported security, ROI, certification, customer proof, or integration claims

The agent must not:

- Make things up
- Keep trying forever
- Handle sensitive issues
- Present inference as fact

## Verification

```bash
npm run check
npm run build
```

## Current Status

MVP backend implemented with mock escalation and local keyword search. Real integrations and LLM calls are intentionally out of scope for this version.
