# Halosight Support MVP Production Readiness Gap List

## Purpose

This document summarizes where the Halosight support agent stands after the MVP build and what still needs to be done before broad production use.

It is intended for CTO and engineering review. It separates what is already working from what is staging-ready, what still blocks production, and the recommended order of next engineering work.

## Current Verdict

The support agent is ready for controlled staging review and internal pilot testing.

It is not yet ready for broad public production launch.

The core workflow has been proven:

1. A visitor can ask a question in the Halosight support chat.
2. The backend searches Halosight knowledge sources.
3. The agent answers when confidence and policy allow.
4. Restricted or low-confidence requests escalate.
5. Escalations notify Slack.
6. Escalations create Chatwoot conversations.
7. Local support tickets persist in Postgres.
8. Human replies from Chatwoot sync back into the chat client.

## Done And Verified

The following capabilities are implemented and have been verified in staging:

- Render-hosted backend is live.
- React chat client is served from the backend at `/chat-client`.
- Normal support questions return knowledge-grounded responses.
- Restricted claims, including security certifications and ROI guarantees, trigger escalation.
- Slack escalation delivery works.
- Chatwoot escalation creates real Chatwoot conversations.
- Chatwoot private notes include transcript and escalation context.
- Chatwoot human replies sync back into the Halosight chat client.
- Local ticket queue is available through protected support operations routes.
- Ticket records include session, transcript, escalation reason, and Chatwoot conversation link.
- Postgres persistence is active in Render.
- Tickets and sessions survive Render redeploys.
- Website allowed-origin controls are configured.
- Structured support event logs are emitted to Render logs.
- CTO demo checklist exists.
- Website team handoff documentation exists.
- Render deployment plan exists.

## Staging-Ready Uses

The current system is suitable for:

- CTO demo.
- Internal stakeholder review.
- Support operations workflow testing.
- Controlled website pilot behind a limited link or test page.
- Validation of Chatwoot handoff and reply sync.
- Validation of Slack notification expectations.
- Testing support knowledge boundaries before public launch.

The current system should remain treated as staging until the production blockers below are resolved.

## Production Blockers

These items should be resolved before exposing the support chat broadly on the public Halosight website.

### Knowledge And Policy

- Finalize the public-site support knowledge base.
- Separate public-safe support content from internal sales, implementation, or competitive context.
- Add approval ownership for support answers and escalation rules.
- Define what the agent may say about security, compliance, integrations, pricing, roadmap, and ROI.
- Add a repeatable review process for knowledge base updates.

### Abuse And Traffic Protection

- Add request rate limiting.
- Add abuse protection for repeated escalation attempts.
- Add payload size limits for chat messages.
- Add basic bot/spam controls before broad public launch.
- Decide whether anonymous visitors can open unlimited support sessions.

### Support Operations

- Decide whether Chatwoot or the local ticket queue is the long-term ticket source of truth.
- Define ticket ownership, response-time expectations, and escalation routing.
- Define when Slack notifications remain useful versus when Chatwoot alone is enough.
- Add operational runbooks for failed Slack delivery, failed Chatwoot delivery, and webhook signature failures.

### Persistence And Data Management

- Confirm Postgres backup and retention policy.
- Add explicit database migration management.
- Define data retention rules for chat transcripts.
- Define deletion/export policy for customer support data.
- Decide whether session, message, and ticket records should move from JSONB to relational tables.

### Security And Privacy

- Complete privacy review for storing visitor messages and transcripts.
- Confirm Chatwoot, Slack, and Render data handling expectations.
- Ensure secrets are only stored in Render environment variables or approved secret management.
- Keep ticket operations protected with strong credentials or platform authentication.
- Consider replacing basic auth with a proper internal identity provider before production.
- Confirm final CORS and embed domains before website launch.

### Monitoring And Reliability

- Add production alerting for failed escalations.
- Add alerting for Chatwoot webhook failures.
- Add uptime monitoring for `/health`.
- Add error-rate monitoring for `/chat/message` and `/chatwoot/webhook`.
- Define incident response ownership.
- Add automated smoke tests that run against staging after deploy.

### Website Integration

- Decide final website integration approach: hosted chat page, embedded page, or packaged support tab.
- Test on actual Halosight website templates.
- Validate mobile layout.
- Validate accessibility.
- Confirm analytics expectations.
- Confirm whether the support chat should be available to anonymous visitors, authenticated app users, or both.

## Recommended Next Engineering Order

1. Finalize public-safe support knowledge boundaries.
2. Add rate limiting and payload limits.
3. Add staging smoke tests for normal answer, escalation, Slack, Chatwoot, ticket persistence, and reply sync.
4. Add production alerts for failed escalation paths.
5. Confirm Postgres backups, retention, and migration approach.
6. Decide whether Chatwoot becomes the ticket source of truth.
7. Package the website support tab or embed flow for Halosight.com.
8. Run an internal pilot with a small support responder group.
9. Add authenticated account context later if the chat moves inside the Halosight product.

## Go / No-Go Checklist

Before public production launch, confirm:

- Public-safe knowledge base has been approved.
- Escalation rules have been approved.
- Rate limiting is active.
- Chatwoot creation works.
- Chatwoot reply sync works.
- Slack fallback expectations are clear.
- Postgres backups are enabled.
- Support ops routes are protected.
- Monitoring and alerting are active.
- Website allowed origins are final.
- Privacy and retention expectations are documented.
- Support owner and response process are assigned.

## CTO Decision Points

The main decisions still needed are:

- Should Chatwoot be the primary ticket system?
- Should Slack remain a parallel notification channel?
- Should the first website launch be anonymous public support or an authenticated customer support flow?
- What public knowledge is approved for automated answers?
- What support response-time expectations should this workflow create?
- What data retention policy applies to support transcripts?

## Recommendation

Proceed with a controlled staging pilot and website integration test.

Do not launch broadly on the public website until knowledge boundaries, rate limiting, monitoring, data retention, and operational ownership are finalized.
