# Halosight Sales Process — Validation Dictionary

## Purpose
Convert subjective fields into objective, verifiable criteria.

Each boolean field must satisfy:
- required evidence
- minimum quality standard
- disqualifiers that force the field false

---

## Early Stage Fields

### economic_buyer_identified
**True only if:**
- named individual identified
- title indicates budget or decision authority
- role in decision explicitly confirmed

**Required evidence:**
- `economic_buyer_name != null`
- notes include `final decision maker` or `owns budget`, or equivalent confirmed wording

**False if:**
- only a guess
- only champion is known
- no access path exists

### executive_sponsor_identified
**True only if:**
- senior stakeholder supports the initiative internally
- evidence of active support exists

**False if:**
- stakeholder is only copied or passively present

### business_challenge_defined
**True only if:**
- problem described in operational terms
- tied to a workflow or function

**Required evidence:**
- current state
- failure point
- affected workflow

**False if:**
- generic efficiency language only
- AI curiosity without business context

### compelling_event_defined
**True only if:**
- specific forcing event exists
- event is time-bound

**False if:**
- no deadline
- no trigger forcing action

### competition_identified
**True only if:**
- at least one alternative identified: competitor, internal build, or status quo

**False if:**
- rep claims there is no competition without evidence

### timeline_defined
**True only if:**
- a specific timeframe, date, or bounded range exists

**False if:**
- only vague timing such as ASAP or someday this year

### next_meeting_scheduled
**True only if:**
- calendar-confirmed meeting exists

**False if:**
- verbal promise to reconnect only

---

## Mid-Stage Fields

### budget_defined
**True only if:**
- budget exists or path to budget exists
- budget owner or funding path identified

**False if:**
- rep assumes money exists without a source or owner

### decision_criteria_defined
**True only if:**
- customer has stated how solutions will be evaluated

**False if:**
- criteria are assumed by the rep

### decision_process_defined
**True only if:**
- decision sequence, stakeholders, and timing are known

**False if:**
- process is reduced to `they will decide later`

---

## Value Stage Fields

### business_value_defined
**True only if:**
- problem translated into measurable business outcome
- impact is tied to time, revenue, risk, data quality, visibility, or process adherence

**False if:**
- value is purely qualitative

### roi_defined
**True only if:**
- quantified value exists in numbers
- example: hours saved, cost avoided, or measurable performance change

**False if:**
- no numbers
- only generic qualitative benefit

### implementation_scope_defined
**True only if:**
- user group, workflows, and systems are defined

**False if:**
- scope is deferred or vague

### political_influence_map_complete
**True only if:**
- economic buyer, champion, influencers, and blockers are named with roles and stance

**False if:**
- only 1–2 contacts known
- blockers unknown

### pricing_proposal_created
**True only if:**
- pricing has been formally shared or structured enough for review

**False if:**
- only informal budget talk happened

---

## Power Validation Fields

### mutual_close_plan_exists
**True only if:**
- documented plan exists with milestones, owners, and dates

**False if:**
- close intent exists but no documented plan

### verbal_selection_received
**True only if:**
- buyer explicitly states Halosight is selected or preferred

**False if:**
- rep reports good feedback without direct selection language

---

## Late Stage Fields

### internal_approvals_complete
**True only if:**
- all seller-side approvals required to transact are complete

### implementation_plan_finalized
**True only if:**
- plan exists with phases, timelines, and responsibilities

### pricing_agreement_reached
**True only if:**
- customer agrees to the price, not merely received it

### terms_and_conditions_aligned
**True only if:**
- no material legal objections remain

### order_form_aligned
**True only if:**
- final order form is agreed

---

## Closing Fields

### customer_approvals_complete
**True only if:**
- all buyer-side approvals required to sign are complete

### po_process_defined
**True only if:**
- purchase order path, owner, and required steps are known

### signature_process_defined
**True only if:**
- signer, routing method, and timing are known

### executed_agreement_received
**True only if:**
- signed agreement exists

### customer_invoiced
**True only if:**
- invoice has been issued

---

## Meta Rules

### Field completeness rule
If a field is marked true but required evidence is missing, the field must be treated as false.

### Confidence scoring
- 0 = missing
- 1 = weak / inferred
- 2 = strong / confirmed with evidence

### Stage readiness threshold
Strict mode:
- all required fields for the stage must score 2

Softer mode:
- at least 80% of required fields score 2
- no critical field may be 0

### Anti-gaming rules
- summaries shorter than 10 words are weak
- generic language such as `improve efficiency` or `drive value` is weak
- late-stage claims require documents
- customer-specific language increases confidence
