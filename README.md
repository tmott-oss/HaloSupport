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
- It does not implement real support integrations
- It does not handle billing, payments, account permissions, or sensitive account actions
- It does not invent answers outside the supplied knowledge base
- It does not send customer-facing messages automatically

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

For local secrets, copy `.env.example` to `.env` and fill in private values:

```bash
cp .env.example .env
```

Health check:

```bash
curl http://localhost:3000/health
```

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
