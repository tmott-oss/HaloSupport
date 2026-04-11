# Halosight AI Support Agent (MVP)

## What this is

This project is a simple AI support agent for Halosight.

It helps answer basic questions, solve simple problems, and send anything complex to a human.

---

## What it does

* Answers common support questions
* Helps troubleshoot simple issues
* Collects information about problems
* Sends hard issues to a human support team

---

## What it does NOT do

* It does NOT handle billing or payments
* It does NOT change accounts or permissions
* It does NOT guess answers
* It does NOT try to solve complex problems

If it is not sure → it escalates.

---

## Goal

Handle 30–50% of support requests automatically without making things worse.

---

## How it works (simple)

1. User asks a question
2. Agent looks in the knowledge base
3. If answer exists → respond
4. If simple problem → try 1–2 steps
5. If still stuck → send to human

---

## Main pieces

* Knowledge Base (answers)
* AI Agent (decision maker)
* Tools (search, diagnostics, escalation)
* Human Support (fallback)

---

## Rules (IMPORTANT)

The agent must:

* Only use approved information
* Be clear and short
* Escalate when unsure

The agent must NOT:

* Make things up
* Keep trying forever
* Handle sensitive issues

---

## Status

🚧 In development (MVP phase)

---

## Next Steps

* Add knowledge base
* Build backend
* Connect AI
* Test with real support questions
