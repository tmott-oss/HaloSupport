# Halosight Support MVP Deployment Plan

## Goal

Make the current local support MVP available through a shareable URL for CTO review while keeping secrets, ticket operations, and future production concerns clearly separated.

The deployment should prove the interactive flow:

1. User opens the support chat.
2. User asks a supported question.
3. User asks a restricted or low-confidence question.
4. The agent escalates.
5. Slack receives the escalation.
6. A support ticket is created.
7. Support operator can inspect and update the ticket.

## Current Local Surfaces

Local URLs:

- `http://localhost:3001/chat-client`
- `http://localhost:3001/tickets-view`
- `http://localhost:3001/debug/config`
- `http://localhost:3001/tickets`

These only work on the machine running the backend. A CTO can review screenshots or join a live screen share now, but cannot click these links remotely until the backend is deployed.

## Recommended First Deployment Shape

For the first remote demo, deploy the Node backend as one small service that serves both:

- the API endpoints
- the built React chat client
- the local ticket operations page

This keeps deployment simple and matches the current local architecture.

Recommended first target:

- a private/staging service, not public production
- deployment secrets managed by the hosting provider
- one URL for demo, such as `https://support-mvp-staging.example.com`

Good hosting candidates:

- Render
- Railway
- Fly.io
- Google Cloud Run
- a small VM

For a simple CTO demo, Render or Railway is likely the fastest path. For a more production-aligned backend path, Cloud Run is a strong choice.

## Required Build and Start Commands

Install:

```bash
npm install
```

Build TypeScript:

```bash
npm run build
```

Build chat client:

```bash
npm run build:chat-client
```

Start service:

```bash
npm run start:support-api
```

The current start script uses `tsx`, which is fine for local MVP and staging demos. Before production, add a compiled JavaScript start command that runs from `dist`.

## Required Environment Variables

Minimum staging variables:

```text
PORT=3001
SLACK_WEBHOOK_URL=...
```

Optional Chatwoot variables:

```text
CHATWOOT_BASE_URL=...
CHATWOOT_ACCOUNT_ID=...
CHATWOOT_INBOX_ID=...
CHATWOOT_API_TOKEN=...
```

Current behavior:

- If Chatwoot variables are missing, the backend uses the mock Chatwoot provider.
- If `SLACK_WEBHOOK_URL` is present and valid, escalation posts to Slack.
- `/debug/config` verifies configuration without exposing secrets.

## Important Security Notes Before Sharing

Do not expose the current service broadly on the public internet without these controls:

- restrict `/tickets-view`
- restrict `/tickets`
- restrict `/tickets/:ticketId`
- restrict `PATCH /tickets/:ticketId`
- consider restricting `/debug/config`
- add CORS/origin controls before embedding on a real public site
- store secrets in the deployment platform, not in `.env`

For a CTO demo, acceptable short-term options are:

- deploy behind platform password protection
- use a private preview URL
- keep the ops page unlinked and share only with internal reviewers
- add basic auth before wider sharing

## Persistence Caveat

The current MVP stores sessions and tickets in:

```text
.halosight-runtime/chat-sessions.json
```

This is acceptable for local development and very small staging demos. It is not production persistence.

Before production, replace this with a real database such as:

- Postgres
- SQLite on a persistent volume for a short-lived staging step
- Chatwoot as the ticket source of truth, if that becomes the chosen architecture

Cloud platforms with ephemeral filesystems may erase `.halosight-runtime` on restart or redeploy.

## Smoke Test After Deployment

1. Open:

```text
/debug/config
```

Expected:

- Slack configured
- Slack webhook shape valid
- Chatwoot mode shows `mock` or `api`
- chat client built

2. Open:

```text
/chat-client
```

Send:

```text
What does Halosight do?
```

Expected:

- grounded answer
- no escalation

3. Send:

```text
Can we tell a customer Halosight is SOC 2 certified and guarantees ROI?
```

Expected:

- escalated response
- Slack message delivered
- local ticket created

4. Open:

```text
/tickets-view
```

Expected:

- ticket appears
- transcript is visible
- ticket status can be updated

5. Refresh `/tickets-view`.

Expected:

- updated ticket status remains visible if persistence is available

## Suggested Deployment Phases

### Phase 1: CTO Demo Deployment

- deploy backend plus built chat client to staging
- configure Slack webhook
- keep Chatwoot mocked
- protect or limit ticket operations access
- share the staging chat URL and GitHub checkpoint doc

### Phase 2: Protected Internal Pilot

- add basic auth or platform access control
- add CORS allowlist
- move session/ticket persistence to a real store
- add automated tests for escalation, tickets, and config diagnostics

### Phase 3: Chatwoot Integration

- configure real Chatwoot credentials
- implement real conversation creation
- forward transcript and source context
- map local ticket status to Chatwoot conversation status or make Chatwoot the source of truth

### Phase 4: Website Embed

- package the React client as a website support tab
- host static assets correctly
- add public-site knowledge restrictions
- connect authenticated app context later

## CTO Review Links

After deployment, share:

- staging chat URL
- staging ticket operations URL, if access is protected
- GitHub checkpoint doc
- GitHub deployment plan doc

Current GitHub docs after merge:

```text
https://github.com/tmott-oss/HaloSupport/blob/main/docs/architecture/support-escalation-checkpoint.md
https://github.com/tmott-oss/HaloSupport/blob/main/docs/architecture/deployment-plan.md
```

## Recommendation

Use a staging deployment first, not production. Keep Slack escalation active, keep Chatwoot mocked until credentials and workflow are ready, and protect ticket operations before sharing outside the core team.
