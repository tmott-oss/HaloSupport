# Deal Inspection Output Examples

## Example 1 — Mid-Stage Deal With Weak Value Case
```json
{
  "current_stage": "Validate Benefits & Value",
  "advance_allowed": false,
  "regress_required": false,
  "required_fields_missing": [
    "roi_defined",
    "political_influence_map_complete"
  ],
  "red_flags": [
    "Value case weak",
    "Internal decision landscape unclear"
  ],
  "recommended_next_actions": [
    "Quantify business value and ROI",
    "Build political influence map",
    "Validate who influences final decision"
  ],
  "forecast_category_allowed": "Pipeline",
  "confidence_score": 72
}
```

## Example 2 — Overstaged Late Deal
```json
{
  "current_stage": "Negotiating & Mutual Plan",
  "stage_valid": false,
  "deal_score": 68,
  "score_band": "Workable but Risky",
  "forecast_allowed": "Best Case",
  "forecast_recommended": "Pipeline",
  "critical_fields_missing": [
    "mutual_close_plan_exists",
    "pricing_agreement_reached"
  ],
  "penalties_applied": [
    {
      "reason": "No mutual close plan beyond Stage 4",
      "points": -15
    }
  ],
  "top_risks": [
    "Late-stage labeling without close mechanics"
  ],
  "next_best_action": "Build a mutual close plan and secure pricing agreement"
}
```
