# Website Embed Hardening

## Goal

Prepare the Halosight support chat for a controlled website embed on Halosight-owned domains.

This is not the final production widget package. It is the first safety pass before attaching the current hosted chat client to the public website.

## Current Embed Shape

The current support chat client is hosted by the backend service:

```text
https://halosight-support-mvp.onrender.com/chat-client
```

For the first website test, Halosight.com can link to this page or embed it in a controlled page/iframe while the team validates the experience.

A later pass can package the React client as a script-based widget, for example:

```html
<script src="https://support.halosight.com/chat-client/embed.js"></script>
```

That packaging step is intentionally separate from this hardening step.

## Allowed Origins

Set this environment variable on the deployed support backend:

```text
SUPPORT_ALLOWED_ORIGINS=https://halosight.com,https://www.halosight.com,https://halosight-support-mvp.onrender.com
```

Behavior:

- browser requests from listed origins are allowed
- same-origin Render requests remain allowed
- server-to-server requests without an `Origin` header remain allowed
- unlisted browser origins receive `403`
- local development remains permissive when `SUPPORT_ALLOWED_ORIGINS` is not set

This protects public chat endpoints from being casually embedded or called from unrelated websites.

## Public Routes

These routes are intended to remain public for the website chat:

- `GET /health`
- `GET /chat-client`
- `GET /chat-client/*`
- `POST /chat/session`
- `POST /chat/message`
- `GET /chat/messages`

These routes are server-to-server or operational:

- `POST /chatwoot/webhook`
- `GET /tickets-view`
- `GET /tickets`
- `GET /tickets/:ticketId`
- `PATCH /tickets/:ticketId`
- `GET /debug/config`

Ticket and debug routes should stay protected by `SUPPORT_OPS_USERNAME` and `SUPPORT_OPS_PASSWORD`.

## Secrets

Do not expose these values to browser code:

- `SLACK_WEBHOOK_URL`
- `CHATWOOT_API_TOKEN`
- `CHATWOOT_WEBHOOK_TOKEN`
- `DATABASE_URL`
- `SUPPORT_OPS_PASSWORD`

The browser only talks to the support backend. The backend owns Slack, Chatwoot, and database credentials.

## Verification

After setting `SUPPORT_ALLOWED_ORIGINS`, verify:

1. `/debug/config` shows `allowedOriginsConfigured: true`.
2. `/chat-client` still works from the Render URL.
3. A normal support question still returns an answer.
4. A restricted question still escalates.
5. Chatwoot reply sync still works.
6. Requests from an unlisted browser origin are blocked.

## Remaining Production Work

Before a full public launch:

- package a stable script/widget embed
- choose the production support subdomain
- add observability for blocked origins and escalation failures
- finalize public-site knowledge restrictions
- confirm privacy, retention, and customer-data handling requirements
