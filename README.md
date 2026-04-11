# HaloSupport
# Halosight AI Support Agent (MVP)

## Overview

This repository contains the implementation of the **Halosight AI Support Agent**, a Level 1 support triage system designed to:

* Answer basic product and support questions using approved documentation
* Guide users through simple troubleshooting workflows
* Collect structured diagnostic information
* Escalate complex or sensitive issues to human support

**Primary Goal:**
Resolve or properly pre-qualify 30–50% of inbound support requests without degrading customer trust.

---

## Scope (MVP)

### Included

* FAQ responses from knowledge base
* Basic troubleshooting (max 1–2 steps)
* Salesforce integration basics
* Mobile app usage issues
* Diagnostic data collection
* Structured escalation to human support

### Excluded

* Billing or payment issues
* Account changes or permissions
* Security or compliance topics
* Deep technical troubleshooting
* Any write operations into customer systems

---

## Architecture

* **Frontend:** Chat widget / in-app support panel
* **Backend:** Node.js or Python service
* **LLM Runtime:** OpenAI Responses API (preferred) or Anthropic API
* **Knowledge Base:** Structured documentation (Markdown / Notion export)
* **Tooling Layer:** Function calling (diagnostics, escalation, retrieval)
* **Escalation:** Slack, Email, or CRM (Salesforce optional)

---

## Core Components

### 1. Knowledge Base (KB)

Source of truth for all answers.
If it is not in the KB, the agent should not answer it.

### 2. AI Agent

* Uses KB for retrieval
* Executes limited troubleshooting flows
* Calls tools for diagnostics and escalation

### 3. Tooling Layer

Defined functions:

* `search_knowledge_base`
* `collect_diagnostics`
* `check_known_issues`
* `create_support_ticket`
* `handoff_to_human`

### 4. Escalation System

All unresolved or out-of-scope issues are routed to human support with:

* Issue summary
* Steps attempted
* Diagnostics collected

---

## Decision Rules (Critical)

### The agent MUST:

* Only answer from approved documentation
* Escalate when confidence is low
* Escalate all billing, account, and security issues
* Limit troubleshooting to 2 attempts maximum

### The agent MUST NOT:

* Guess or hallucinate answers
* Perform system changes
* Handle sensitive account issues
* Continue troubleshooting indefinitely

---

## Escalation Triggers

* Low confidence (<0.6)
* User repeats failure
* Integration issues (e.g., Salesforce sync)
* User frustration or escalation request
* Unknown or unsupported issue

---

## Success Metrics

* AI resolution rate
* Escalation rate
* Bad-answer (hallucination) rate
* Time to resolution
* Top unresolved queries

---

## Development Plan

### Phase 1 — Knowledge Base

* Identify top 50 support issues
* Convert into structured KB articles

### Phase 2 — Agent + Tools

* Implement retrieval + tool calling
* Build escalation pipeline

### Phase 3 — Testing

* Validate against historical support tickets
* Identify gaps and failure modes

### Phase 4 — Limited Launch

* Release to controlled user group
* Monitor performance and errors

### Phase 5 — Iteration

* Expand KB coverage
* Improve routing and accuracy

---

## Getting Started

1. Clone the repository
2. Review `/docs/` for architecture and tool definitions
3. Load system prompt from `/prompts/system_prompt.md`
4. Implement tool interfaces defined in `/tools/`
5. Connect knowledge base to retrieval layer
6. Run test cases from `/tests/`

---

## Codex Instructions

* Read all files in `/docs/`, `/prompts/`, and `/tools/` before generating code
* Do not expand scope beyond MVP
* Prioritize reliability over sophistication
* If uncertain, default to escalation behavior

---

## Risks

* Weak knowledge base → poor performance
* Over-expansion of scope → instability
* Lack of escalation discipline → user frustration
* Insufficient testing → hallucinations in production

---

## Guiding Principle

This system is not designed to be “smart.”

It is designed to be:

* predictable
* controlled
* trustworthy

When in doubt, escalate.

