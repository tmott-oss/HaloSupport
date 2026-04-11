# Halosight Sales Process — AI Enforcement Rules

## Core Principles
1. No stage advancement without required evidence.
2. Evidence beats optimism.
3. Champion is not power.
4. Late-stage claims require concrete proof.
5. Unknown means not qualified.
6. Stage regression is allowed when required evidence disappears.

---

## Stage Advancement Rules

### Stage 1 — Identifying an Opportunity
Advance only if all are true:
- `economic_buyer_identified == true`
- `business_challenge_defined == true`
- `compelling_event_defined == true`
- `competition_identified == true`
- `executive_sponsor_identified == true`
- `timeline_defined == true`
- `next_meeting_scheduled == true`
- `close_date != null`

Block advancement if any are false.

### Stage 2 — Determine Problem / Impact
Advance only if all are true:
- `decision_criteria_defined == true`
- `decision_process_defined == true`
- `timeline_defined == true`
- `budget_defined == true` or credible budget path exists
- problem summary includes operational impact

### Stage 3 — Validate Benefits & Value
Advance only if all are true:
- `business_value_defined == true`
- `roi_defined == true`
- `political_influence_map_complete == true`
- `implementation_scope_defined == true`

### Stage 4 — Confirm Value with Power
Advance only if all are true:
- `economic_buyer_identified == true`
- `business_value_defined == true`
- `roi_defined == true`
- `mutual_close_plan_exists == true`
- buyer confirms the Why Buy story

### Stage 5 — Negotiating & Mutual Plan
Advance only if all are true:
- `internal_approvals_complete == true`
- `implementation_plan_finalized == true`
- `pricing_agreement_reached == true`
- `terms_and_conditions_aligned == true`
- `order_form_aligned == true`
- `mutual_close_plan_exists == true`

### Stage 6 — Finalizing Closure
Advance only if:
- `executed_agreement_received == true`

### Stage 7 — Pending Closed
Remain in stage only if:
- `executed_agreement_received == true`

Closed-won complete only if:
- `executed_agreement_received == true`
- `customer_invoiced == true`

---

## Forecast Rules

### Pipeline
Allowed when current stage is one of:
- Identifying an Opportunity
- Determine Problem / Impact
- Validate Benefits & Value

### Best Case
Allowed only if:
- current stage is Confirm Value with Power
- economic buyer is identified
- business value is defined
- ROI is defined

### Commit
Allowed only if:
- current stage is Negotiating & Mutual Plan or Finalizing Closure
- mutual close plan exists
- pricing agreement reached
- implementation plan finalized

### Forecast Downgrade Rules
- If forecast is Commit but no mutual close plan exists, downgrade.
- If forecast is Best Case but no economic buyer is identified, downgrade.

---

## Regression Rules
- If `economic_buyer_identified` becomes false, regress to at most Stage 1.
- If `decision_process_defined` becomes false, regress to at most Stage 2.
- If `roi_defined` becomes false, regress to at most Stage 3.
- If `mutual_close_plan_exists` becomes false, regress to at most Stage 4.
- If `executed_agreement_received != true` and stage is Pending Closed, regress to Stage 6.

---

## Stall Detection Rules
- Stage 1 stalled if no meaningful customer interaction for more than 14 days.
- Stage 2 or 3 stalled if no meaningful customer interaction for more than 10 days.
- Stage 4, 5, or 6 stalled if no meaningful customer interaction for more than 5 days.
- Any stage is stalled if no next step is defined or no next step date exists.

---

## Red Flag Rules
- No compelling event -> `No urgency`
- No economic buyer beyond Stage 1 -> `No power access`
- No decision process beyond Stage 2 -> `Unknown buying process`
- No ROI beyond Stage 3 -> `No value case`
- No mutual close plan beyond Stage 4 -> `No close plan`
- Positive sentiment without pricing agreement late stage -> `Sentiment without commercial alignment`
- Legal or procurement cited but no PO/signature process -> `Fake late-stage motion`

---

## Next-Step Recommendation Rules
- Missing economic buyer -> identify budget owner and path to power
- Missing decision process -> map stakeholders, approvals, and sequence
- Missing ROI -> quantify time saved, data quality impact, and business value
- Missing power validation -> run economic buyer meeting and validate cost of inaction
- Missing mutual close plan -> document milestones, owners, and dates
- Missing signature process -> confirm signer, route, PO requirement, and deadline

---

## Deal Inspection Policy
- Never advance a deal based on rep optimism alone.
- Never treat a champion as the economic buyer unless explicitly confirmed.
- Never mark a deal Commit without a mutual close plan.
- Never mark Best Case unless value has been confirmed with power.
- Always recommend the single most important missing qualification.
- Always explain why a stage change is blocked.
