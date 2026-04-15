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

1. Build the client:

```bash
npm run build:chat-client
```

2. Start the wrapper service:

```bash
npm run start:support-api
```

3. Open the backend-served client:

```text
http://localhost:3001/chat-client
```

Future implementation step:

Replace the inline `/support-test` HTML once the React bundle is fully accepted as the local test surface.

## Runtime Contract

The component expects the wrapper service to expose:

- `POST /chat/session`
- `POST /chat/message`

When served from the backend at `/chat-client`, the client calls the API on the same origin. This lets the same built bundle work locally and on staging hosts such as Render.

The client stores the active session id in `localStorage` so browser refreshes can continue the same local test session.
