# Sales Agent Blueprint

This blueprint maps the first five agents into concrete triggers, inputs, outputs, and approval boundaries for Google Workspace, Salesforce, Slack, and Apollo.

## 1. Meeting Prep Agent

### Trigger

- Google Calendar event starts in 30 minutes
- Salesforce opportunity owner manually requests a brief

### Inputs

- Google Calendar event metadata
- Salesforce account, contact, opportunity, and recent activity
- Apollo buying signals and messaging angles

### Outputs

- Google Doc meeting brief in `AI Drafts`
- Slack post in `#sales-ai-approvals` or a rep enablement channel

### Approval Boundary

- No approval required when the output stays internal
- If future versions generate external follow-up drafts, they should move into approval mode

## 2. Call Summary + Salesforce Update Agent

### Trigger

- New meeting transcript or rep notes arrive
- Rep pastes notes into a Slack shortcut or Google Doc template

### Inputs

- Transcript or call notes
- Salesforce opportunity and current next-step fields
- Calendar meeting metadata

### Outputs

- Draft summary
- Proposed Salesforce updates
- Gmail follow-up draft
- Slack approval post

### Approval Boundary

- Salesforce updates require approval
- Gmail send requires approval

### Proposed Review Payload

- Summary of what happened
- Stage change recommendation
- Next-step recommendation
- Risk flags
- Link to Gmail draft

## 3. Pipeline Inspection Agent

### Trigger

- Daily at 8:00 AM Central
- Weekly before forecast review

### Inputs

- Salesforce opportunities
- Activity recency
- Close-date hygiene
- Missing required fields

### Outputs

- Slack digest with flagged deals
- Optional Google Sheet review log

### Approval Boundary

- No approval required for read-only digest mode
- Task creation or CRM correction requires approval

## 4. Account Research Agent

### Trigger

- Account owner assignment in Salesforce
- SDR requests a brief from Slack

### Inputs

- Salesforce account and contact context
- Apollo enrichment and engagement signals
- Internal notes and prior activity

### Outputs

- Google Doc or Slack dossier
- Suggested messaging angles
- Suggested stakeholders to target

### Approval Boundary

- No approval required when the output is internal

## 5. Personalized Outreach Agent

### Trigger

- SDR selects target account/contact
- Sequence step needs a custom touch

### Inputs

- Salesforce contact and account context
- Apollo enrichment and prior touch data
- Internal messaging framework

### Outputs

- Gmail draft
- Apollo sequence copy recommendation
- Slack approval post for rep review

### Approval Boundary

- Email sending requires approval
- Apollo enrollment requires approval

## Shared Approval Workflow

All write-capable agents should route through a single review channel and use the same shape:

- `Agent`
- `Account`
- `Requested action`
- `Why now`
- `Proposed changes`
- `Source links`
- `Approve / Reject / Needs Edit`

## Delivery Milestones

### Milestone 1

- Shared config
- Draft-mode policy
- Provider interfaces
- Meeting prep agent

### Milestone 2

- Real Slack adapter
- Real Google Docs adapter
- Approval-post formatter

### Milestone 3

- Call summary + Salesforce proposal agent
- Salesforce review object or Google Sheet review queue

### Milestone 4

- Pipeline inspection digest
- Account research brief generator

### Milestone 5

- Personalized outreach drafts
- Rep approval flow and audited approvals
