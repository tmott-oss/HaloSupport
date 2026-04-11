# Tools

These are the functions the Halosight Support Agent can use.

---

## 1. search_knowledge_base

Purpose: Find answers from approved support content

Input:

* query (string)

Output:

* answer_snippets
* confidence_score (0 to 1)

---

## 2. collect_diagnostics

Purpose: Gather useful information before escalation

Fields:

* user_email
* company
* device (mobile / desktop)
* browser
* CRM (e.g., Salesforce)
* issue_type
* error_message
* urgency

---

## 3. check_known_issues

Purpose: Check if the issue is already known

Output:

* known_issue (true/false)
* description
* workaround

---

## 4. create_support_ticket

Purpose: Send issue to human support

Includes:

* issue_summary
* category
* priority
* steps_attempted
* diagnostics

---

## 5. handoff_to_human

Purpose: Notify support team and transfer issue

Trigger:

* after ticket is created
