# Chatwoot Hybrid Support Architecture

## Goal

Build an embeddable AI-first support chat experience for:

- the public Halosight website
- an authenticated Halosight web app
- a Flutter app through a hosted WebView experience

The system should answer only from approved knowledge content, refuse or escalate when it cannot answer safely, and use Chatwoot as the human support backend when escalation is required.

## Default V1 Model

The custom wrapper service owns the AI support flow.

A Chatwoot conversation is created only when escalation to a human is required.

This keeps the first version simple, avoids unnecessary Chatwoot traffic for AI-only sessions, and lets Chatwoot stay separately maintainable and upgradeable.

## Hard Requirements

- Do not fork Chatwoot.
- Do not modify Chatwoot source code.
- Treat Chatwoot as an external service accessed through supported APIs and configuration.
- Do not depend on paid-only or proprietary Chatwoot capabilities unless explicitly approved.
- Keep the custom AI wrapper and Chatwoot deployment independently upgradeable.

## Components

### Embedded React Chat Client

Responsibilities:

- render the support chat UI
- start or resume a support session
- send host context such as surface, route, user, and account context
- display AI messages, refusal messages, and escalation states
- switch to human waiting or connected states after escalation
- run inside the public site, authenticated app, or Flutter WebView

### Wrapper / Orchestrator Service

Responsibilities:

- accept chat messages from the embedded client
- initialize and resume sessions
- detect support scenario and knowledge set
- retrieve approved knowledge
- apply answer guardrails
- decide whether to answer, refuse, or escalate
- create or resume Chatwoot conversations on escalation
- forward relevant transcript and context to Chatwoot
- return human-support state to the client
- record transcript and analytics metadata

### Knowledge Layer

Responsibilities:

- provide source-constrained support content
- support scenario-specific knowledge selection
- support separate knowledge sets at minimum for public website and authenticated app
- keep retrieval swappable so the source can later be Chatwoot Help Center, CMS content, or a dedicated knowledge store

### Chatwoot Server

Responsibilities:

- agent inboxes
- human assignment
- escalation conversation persistence
- agent replies after escalation

Chatwoot should not be used as the default store for AI-only conversations in v1 unless that decision changes later.

## V1 Request Flow

1. User opens embedded support chat.
2. Front end starts or resumes a session with the wrapper.
3. Front end sends scenario metadata, such as public site vs authenticated app, route, user identity, and account context when available.
4. Wrapper selects the allowed knowledge set.
5. Wrapper retrieves relevant knowledge.
6. Wrapper answers safely, refuses, or escalates.
7. If escalation is triggered, wrapper creates or resumes a Chatwoot conversation.
8. Wrapper forwards the transcript and escalation context to Chatwoot.
9. User enters human waiting or connected state.
10. Human replies flow back through the wrapper to the embedded client.

## Current MVP Bridge

The current MVP already has:

- `POST /support`
- local knowledge-base search
- restricted-claim guardrails
- Slack webhook escalation
- `/support-test` browser test page

Slack escalation is an interim path. The Chatwoot-backed implementation should eventually replace or sit beside Slack escalation, depending on operations preference.

## Suggested Phases

### Phase 1: Local Skeleton

- add embedded chat client structure
- add wrapper session API shape
- add local startup scripts
- keep the existing support endpoint working

### Phase 2: AI-First Chat

- add session initialization
- add chat-style message history
- add scenario-based knowledge-set selection
- add explicit refusal and escalation response states

### Phase 3: Chatwoot Escalation

- add Chatwoot adapter boundary
- create Chatwoot conversation only on escalation
- forward transcript and context
- support waiting / connected states in the client
- support human reply synchronization path

### Phase 4: Persistence and Analytics

- persist sessions and transcripts
- record escalation reason and outcome
- make sessions inspectable locally and in deployment

### Phase 5: Deployment Packaging

- add Docker packaging
- add shell scripts for local startup and deployment
- document Cloud Run path for the wrapper service
- document the preferred Chatwoot deployment path separately

## Open Decisions

- Primary knowledge source for public-site support
- Separate knowledge source for authenticated-app support
- Transcript storage choice: PostgreSQL, MongoDB, or simple local storage for MVP
- Chatwoot hosting target: VM, GKE, or another documented path
- Human-unavailable fallback: message only or ticket/contact form
- Whether Slack remains as an internal notification channel after Chatwoot escalation is live
