# Halosight Support MVP CTO Handoff

## Purpose

This is the single starting point for CTO review of the Halosight AI Support Agent MVP.

The MVP demonstrates an AI-first support workflow that can answer from approved Halosight knowledge, avoid unsupported claims, escalate risky requests, create a Chatwoot handoff, notify Slack, and sync human replies back into the customer chat experience.

## Live Review Links

Staging support chat:

```text
https://halosight-support-mvp.onrender.com/chat-client
```

Support ticket queue:

```text
https://halosight-support-mvp.onrender.com/tickets-view
```

Safe configuration check:

```text
https://halosight-support-mvp.onrender.com/debug/config
```

The ticket queue is protected. Do not share support operations credentials outside the approved internal review group.

## What To Demo

Use the staged chat client to test both paths.

Normal support question:

```text
What does Halosight do?
```

Expected result:

- the agent answers from Halosight source material
- no escalation occurs
- the message input clears after send

Restricted or low-confidence question:

```text
Can we tell a customer Halosight is SOC 2 certified and guarantees ROI?
```

Expected result:

- the agent refuses to make unsupported claims
- the request escalates
- Slack receives an internal escalation notification
- Chatwoot receives a real conversation
- a support ticket is created
- a Chatwoot human reply appears back in the Halosight chat client

## Current Architecture

```text
Halosight chat client
  -> Support API on Render
  -> Knowledge search and policy checks
  -> Safe answer or escalation
  -> Slack notification
  -> Chatwoot conversation
  -> Postgres-backed local session and ticket record
  -> Chatwoot reply sync back to chat
```

## Verified Capabilities

- Render-hosted backend is live.
- React chat client is hosted at `/chat-client`.
- Knowledge-grounded answer path works.
- Restricted-claim escalation works.
- Slack escalation works.
- Real Chatwoot conversation creation works.
- Chatwoot human reply sync works.
- Support ticket queue works.
- Ticket queue links to Chatwoot.
- Postgres persistence works.
- Tickets survive Render redeploy.
- Allowed origins are configured for Halosight-owned domains.
- Structured support logs are available in Render.

## Supporting Documents

CTO demo checklist:

```text
https://github.com/tmott-oss/HaloSupport/blob/main/docs/architecture/cto-demo-checklist.md
```

Production readiness gap list:

```text
https://github.com/tmott-oss/HaloSupport/blob/main/docs/architecture/production-readiness-gap-list.md
```

Deployment plan:

```text
https://github.com/tmott-oss/HaloSupport/blob/main/docs/architecture/deployment-plan.md
```

Website team handoff:

```text
https://github.com/tmott-oss/HaloSupport/blob/main/docs/architecture/website-team-handoff.md
```

Chatwoot hybrid support architecture:

```text
https://github.com/tmott-oss/HaloSupport/blob/main/docs/architecture/chatwoot-hybrid-support.md
```

## Current Recommendation

Continue with controlled staging validation and a limited website integration test.

The MVP is strong enough for CTO review and internal pilot testing. It should not be broadly launched on the public website until the production-readiness blockers are addressed, especially public knowledge curation, rate limiting, monitoring, data retention, and support ownership.

## CTO Decision Points

- Should Chatwoot become the primary ticket source of truth?
- Should Slack remain as a parallel escalation notification channel?
- Should the first website version support anonymous visitors, authenticated users, or both?
- What support knowledge is approved for automated public answers?
- What support response-time expectations should this workflow create?
- What data retention policy applies to support transcripts?

## One-Sentence Summary

Halosight now has a working AI-first support MVP that answers from approved knowledge, escalates risky questions, creates a Chatwoot support handoff, syncs human replies back to the chat, and persists support history in Postgres.
