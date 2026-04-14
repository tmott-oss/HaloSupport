# Halosight Chat Client React Skeleton

This folder is the future home for the embeddable Halosight support chat client.

The current backend still serves `/support-test` from `src/api/support-agent.ts`. This React skeleton is the next step toward the CTO-approved shape:

- one shared embedded chat client
- reusable on the public website
- reusable in the authenticated web app
- hostable inside a Flutter WebView
- talks to the wrapper service through `/chat/session` and `/chat/message`

## Current Status

This app now has a small Vite setup for local development.

Run the wrapper service first:

```bash
npm run start:support-api
```

Then run the React client:

```bash
npm run start:chat-client
```

Open:

```text
http://127.0.0.1:5173
```

Next implementation step:

1. Serve the built assets from the wrapper service for local testing.
2. Replace the inline `/support-test` HTML once the React bundle is working.

## Runtime Contract

The component expects the wrapper service to expose:

- `POST /chat/session`
- `POST /chat/message`

The client stores the active session id in `localStorage` so browser refreshes can continue the same local test session.
