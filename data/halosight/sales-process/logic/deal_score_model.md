# Halosight Sales Process — Deal Score Model

## Purpose
Create a 0–100 deal quality score that measures whether an opportunity is truly qualified, stage-valid, and forecast-worthy.

The score should not measure rep enthusiasm. It should measure evidence quality.

---

## Scoring Framework Overview
The total score is built from five categories:

1. Core Qualification — 25 points
2. Buying Process Clarity — 20 points
3. Business Value Strength — 20 points
4. Decision & Close Readiness — 25 points
5. Deal Hygiene & Momentum — 10 points

**Total:** 100 points

---

## 1. Core Qualification — 25 points

### Fields and Weights
- Economic buyer identified — 6
- Executive sponsor identified — 4
- Business challenge defined — 5
- Compelling event defined — 5
- Competition identified — 3
- Timeline defined — 2

### Scoring Rule
For each field:
- missing = 0% of field weight
- weak / inferred = 50% of field weight
- strong / confirmed = 100% of field weight

Example:
- Economic buyer identified strongly -> 6 points
- Economic buyer identified weakly -> 3 points
- Missing -> 0 points

---

## 2. Buying Process Clarity — 20 points

### Fields and Weights
- Budget defined or credible budget path — 5
- Decision criteria defined — 5
- Decision process defined — 6
- Political influence map complete — 4

### Interpretation
This category measures whether the rep actually understands how the deal gets decided.

---

## 3. Business Value Strength — 20 points

### Fields and Weights
- Business value defined — 6
- ROI defined — 8
- Implementation scope defined — 3
- Halosight differentiation defined — 3

### Interpretation
This category measures whether there is a credible reason to change and a credible reason to choose Halosight.

---

## 4. Decision & Close Readiness — 25 points

### Fields and Weights
- Mutual close plan exists — 8
- Verbal selection received — 5
- Pricing proposal created — 2
- Pricing agreement reached — 4
- Terms and conditions aligned — 2
- Order form aligned — 2
- Customer approvals complete — 1
- Signature process defined — 1

### Interpretation
This category measures whether the opportunity is actually advancing toward a decision and close.

---

## 5. Deal Hygiene & Momentum — 10 points

### Fields and Weights
- Next meeting scheduled — 3
- Next step defined with date — 3
- Recent meaningful customer interaction within threshold — 2
- Stage evidence notes are specific and non-generic — 2

### Interpretation
This category measures execution discipline.

---

## Mandatory Critical Fields by Stage
Even a high score cannot override missing critical fields.

### Stage 1 Critical Fields
- economic_buyer_identified
- business_challenge_defined
- compelling_event_defined
- executive_sponsor_identified
- timeline_defined

### Stage 2 Critical Fields
- decision_criteria_defined
- decision_process_defined
- budget_defined or credible budget path

### Stage 3 Critical Fields
- business_value_defined
- roi_defined
- political_influence_map_complete
- implementation_scope_defined

### Stage 4 Critical Fields
- economic_buyer_identified
- business_value_defined
- roi_defined
- mutual_close_plan_exists

### Stage 5 Critical Fields
- internal_approvals_complete
- implementation_plan_finalized
- pricing_agreement_reached
- mutual_close_plan_exists

### Stage 6 Critical Fields
- customer_approvals_complete
- po_process_defined
- signature_process_defined

### Stage 7 Critical Fields
- executed_agreement_received

If any stage-critical field is missing, the stage is invalid regardless of total score.

---

## Red Flag Penalties
Subtract penalties after the base score is calculated.

### Penalties
- No economic buyer beyond Stage 1: -12
- No compelling event: -10
- No decision process beyond Stage 2: -10
- No ROI beyond Stage 3: -12
- No mutual close plan beyond Stage 4: -15
- No next step scheduled: -8
- Opportunity stalled beyond stage threshold: -8
- Legal/procurement mentioned without PO or signature path: -6
- Positive sentiment only, no commercial proof in late stage: -6
- Generic notes / weak evidence quality: -5

**Minimum score floor:** 0

---

## Score Bands

### 90–100 — Strong / Commit-Ready
- high confidence deal
- evidence is strong
- likely appropriate for Commit, but only if stage-critical fields are satisfied

### 75–89 — Healthy / Best Case-Ready
- good qualification discipline
- remaining gaps are manageable
- appropriate for Best Case or late Pipeline depending on stage

### 60–74 — Workable but Risky
- some evidence exists
- meaningful qualification gaps remain
- should not be over-forecasted

### 40–59 — Weak Opportunity
- qualification is incomplete
- likely over-staged or rep-led rather than customer-validated

### 0–39 — Poor / Likely Noise
- missing core evidence
- likely false opportunity or badly managed deal

---

## Forecast Guardrails by Score
Score alone does not set the forecast. It gates what forecast is allowed.

### Pipeline
Allowed at any score if the deal is real, but the following guidance applies:
- under 40: keep out of active pipeline review if possible
- 40+: acceptable as early pipeline

### Best Case
Allowed only if:
- score >= 75
- stage is Confirm Value with Power
- economic buyer identified strongly
- ROI defined strongly

### Commit
Allowed only if:
- score >= 90
- stage is Negotiating & Mutual Plan or Finalizing Closure
- mutual close plan exists strongly
- pricing agreement reached strongly
- implementation plan finalized strongly

If these are not met, downgrade forecast regardless of rep opinion.

---

## Stage-Score Sanity Checks
Use these checks to detect stage inflation.

- If current stage is Stage 4 or later and score < 70 -> likely overstaged
- If current stage is Stage 5 or later and score < 80 -> likely overstaged
- If current stage is Stage 6 and score < 90 -> likely overstaged or blocked

---

## Example Calculation
Opportunity example:
- Economic buyer strong = 6
- Executive sponsor weak = 2
- Business challenge strong = 5
- Compelling event strong = 5
- Competition weak = 1.5
- Timeline strong = 2

Core Qualification subtotal = 21.5 / 25

Continue through all categories, then subtract penalties.

Example final:
- Base score = 83
- Penalty for no mutual close plan beyond Stage 4 = -15
- Final score = 68

Interpretation:
- deal may sound late stage, but evidence quality does not support forecast optimism
- should not be Commit
- likely regress or hold until close plan exists

---

## Recommended Agent Output Schema
```json
{
  "deal_score": 68,
  "score_band": "Workable but Risky",
  "stage_valid": false,
  "forecast_allowed": "Best Case",
  "forecast_recommended": "Pipeline",
  "critical_fields_missing": [
    "mutual_close_plan_exists"
  ],
  "penalties_applied": [
    {
      "reason": "No mutual close plan beyond Stage 4",
      "points": -15
    }
  ],
  "top_risks": [
    "Value has not been converted into a documented close path"
  ],
  "next_best_action": "Build a mutual close plan with milestones, owners, and dates"
}
```

---

## Enforcement Philosophy
- The score is a control mechanism, not a vanity metric.
- Missing evidence must outweigh rep confidence.
- A high score does not override missing critical fields.
- A low score in a late stage is a warning sign of stage inflation.
