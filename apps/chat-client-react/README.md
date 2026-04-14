# Halosight Chat Client React Skeleton

This folder is the future home for the embeddable Halosight support chat client.

The current backend still serves `/support-test` from `src/api/support-agent.ts`. This React skeleton is the next step toward the CTO-approved shape:

- one shared embedded chat client
- reusable on the public website
- reusable in the authenticated web app
- hostable inside a Flutter WebView
- talks to the wrapper service through `/chat/session` and `/chat/message`

## Current Status

This is source-only scaffolding. It is not wired into a bundler yet.

Next implementation step:

1. Add a small Vite build for this app.
2. Serve the built assets from the wrapper service for local testing.
3. Replace the inline `/support-test` HTML once the React bundle is working.

## Runtime Contract

The component expects the wrapper service to expose:

- `POST /chat/session`
- `POST /chat/message`

The client stores the active session id in `localStorage` so browser refreshes can continue the same local test session.
