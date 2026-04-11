# B2B Sales Agents Starter

This project bootstraps the first safe version of five B2B sales agents for a stack built on Google Workspace, Salesforce, Slack, and Apollo.

## Current Scope

The first implementation focuses on draft mode:

- internal briefs are allowed
- Gmail drafts are allowed
- Slack approval posts are allowed
- Salesforce writes are blocked
- Apollo enrollment is blocked
- Gmail sending is blocked

## Included Today

- a shared draft-mode policy
- provider interfaces for Google Workspace, Salesforce, Slack, and Apollo
- mock providers for local development
- a first `meeting-prep` agent flow
- starter approval payloads for later write actions
- a Halosight master context package with prompts, schemas, and CRM field mapping

## Project Layout

- `src/config.ts`: application config and draft-mode flags
- `src/domain/types.ts`: shared agent domain types
- `src/providers/interfaces.ts`: tool provider contracts
- `src/providers/mock.ts`: local mock integrations
- `src/policies/draft-mode.ts`: permission decisions
- `src/agents/meeting-prep.ts`: first working agent flow
- `src/approval/builders.ts`: approval request builders
- `src/cli/run-meeting-prep.ts`: local runner
- `data/halosight/`: company context, schemas, field map, and examples
- `data/halosight/context-pack/`: richer global, persona, competitive, stage, and account-template context pack
- `data/halosight/sales-process/`: Halosight-specific stage definitions, validation rules, enforcement logic, and deal scoring
- `data/halosight/manual-account-contexts.json`: editable local replacement for CRM context until Salesforce is live
- `prompts/halosight/`: global and agent-specific prompt files

## Install

```bash
npm install
```

## Run The First Agent

```bash
npm run start:meeting-prep -- meeting-demo-001
```

You can also resolve a real calendar event by title/time with environment variables:

```bash
MEETING_TITLE="INTERNAL | Demand Gen Planning" MEETING_STARTS_AT="2026-04-03T10:30:00-05:00" node dist/cli/run-meeting-prep.js
```

## Inspect Prompt Assembly

```bash
npm run inspect:halosight-runtime -- icp_sentinel
```

## Create A Gmail Draft

```bash
GMAIL_DRAFT_TO="someone@example.com" npm run create:gmail-draft
```

## Run The Call Summary Agent

```bash
MEETING_TITLE="INTERNAL | Demand Gen Planning" MEETING_STARTS_AT="2026-04-03T11:00:00-05:00" npm run start:call-summary
```

## Run The Deal Inspection Helper

```bash
npm run inspect:deal
```

## Draft-Mode Policy

### Allowed by default

- read Google Calendar, Gmail metadata, Salesforce, Apollo, and Slack
- create Google Docs draft briefs
- create Gmail drafts
- post internal Slack messages for approvals and brief distribution

### Blocked by default

- sending emails
- writing to Salesforce records
- enrolling contacts into Apollo sequences
- posting to external or customer-facing Slack channels

## Halosight Prompt Stack

The runtime should inject Halosight context before any specialist agent runs.

Recommended prompt assembly order:

1. `data/halosight/halosight_master_context.md`
2. targeted supplemental context from `data/halosight/context-pack/`
3. stage enforcement context from `data/halosight/sales-process/`
4. `data/halosight/compliance_guardrails.md`
5. `prompts/halosight/global_master_instructions.md`
6. the specialist agent prompt from `prompts/halosight/`
7. schema contract from `data/halosight/schemas.json`

Runtime helpers now live in:

- `src/runtime/halosight.ts`
- `src/runtime/schema-validation.ts`

The meeting-prep flow already loads this shared Halosight context so internal briefs stay aligned with company positioning.

## Real Adapter Path

The meeting-prep runner now selects live providers when credentials are present and falls back to mocks otherwise.

Current live-capable adapters:

- Google Calendar event read
- Google Docs draft creation
- Gmail draft creation
- Slack internal posting to the approval channel

Current mock-only adapters:

- none for the default local workflow

Current local replacement for CRM context:

- `data/halosight/manual-account-contexts.json`

This file maps attendee domains, contact emails, and meeting-title keywords to:

- account context
- primary contact
- recent activity
- buying signals
- messaging angles

Until Salesforce and Apollo are connected, this local data source is the system of truth for account context in the agents.

Current live-ready draft-mode agents:

- meeting prep
- call summary plus follow-up draft

### Required Environment Variables For Live Meeting Prep

```bash
GOOGLE_WORKSPACE_CLIENT_ID=
GOOGLE_WORKSPACE_CLIENT_SECRET=
GOOGLE_WORKSPACE_REFRESH_TOKEN=
GOOGLE_CALENDAR_ID=primary
GOOGLE_DOCS_FOLDER_ID=
SLACK_BOT_TOKEN=
SLACK_APPROVAL_CHANNEL_ID=
```

Notes:

- `SLACK_APPROVAL_CHANNEL_ID` should be a Slack channel ID like `C0123456789`
- Google Workspace auth assumes OAuth refresh-token flow
- if these variables are absent, the runner safely uses mock providers instead

Specialist agents included:

- ICP Sentinel
- Outreach Strategist
- Discovery Qualifier
- Objection Navigator
- Deal Progression Analyst
- CRM Structurer

The package also includes:

- `data/halosight/salesforce_field_map.json`
- `data/halosight/example_payloads.json`
- `data/halosight/context-pack/README.md`

## Suggested Next Build Order

1. Load the Halosight context package into runtime assembly.
2. Add schema validation between agent handoffs.
3. Add real adapters for Google Workspace, Salesforce, Slack, and Apollo.
4. Build the call-summary agent with Salesforce update proposals and Gmail follow-up drafts.
5. Build the pipeline inspection agent as a read-only Slack digest.
6. Build the account research agent as an internal brief generator.
7. Build the personalized outreach agent as a Gmail-draft-only workflow.

## Recommended Environment Variables

```bash
GOOGLE_WORKSPACE_CLIENT_ID=
GOOGLE_WORKSPACE_CLIENT_SECRET=
GOOGLE_WORKSPACE_REFRESH_TOKEN=
GOOGLE_CALENDAR_ID=
GOOGLE_DOCS_FOLDER_ID=
SALESFORCE_CLIENT_ID=
SALESFORCE_CLIENT_SECRET=
SALESFORCE_REFRESH_TOKEN=
SLACK_BOT_TOKEN=
SLACK_APPROVAL_CHANNEL=
SLACK_APPROVAL_CHANNEL_ID=
APOLLO_API_KEY=
```
