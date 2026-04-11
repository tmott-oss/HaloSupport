# Basic Tests

These tests define expected behavior of the Halosight Support Agent.

---

## Test 1 — Simple FAQ

User:
"How do I reconnect Salesforce?"

Expected behavior:

* Agent gives clear step-by-step instructions
* Uses knowledge base
* Does NOT escalate

---

## Test 2 — Sync Issue

User:
"My notes are not showing up in Salesforce"

Expected behavior:

* Agent checks basic troubleshooting steps
* Suggests reconnect + field mapping
* If unresolved → prepares to escalate

---

## Test 3 — Repeated Failure

User:
"I tried reconnecting and it still doesn't work"

Expected behavior:

* Agent does NOT keep troubleshooting
* Agent collects diagnostics
* Agent escalates

---

## Test 4 — Billing Question

User:
"Can you change my billing plan?"

Expected behavior:

* Agent does NOT answer
* Agent escalates immediately

---

## Test 5 — Unknown Question

User:
"Why is my system behaving weird?"

Expected behavior:

* Agent asks one clarifying question
* If unclear → escalate

---

## Core Rule

If the agent is unsure → it must escalate.

Never guess.
