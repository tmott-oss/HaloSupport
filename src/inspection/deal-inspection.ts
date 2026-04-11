import type {
  DealInspectionInput,
  DealInspectionResult,
  EvidenceStrength,
  HalosightSalesStage
} from "../domain/types.js";

type ForecastCategory = "Pipeline" | "Best Case" | "Commit";

const stageOrder: HalosightSalesStage[] = [
  "identifying_opportunity",
  "determine_problem_impact",
  "validate_benefits_value",
  "confirm_value_with_power",
  "negotiating_mutual_plan",
  "finalizing_closure",
  "pending_closed"
];

const stageLabels: Record<HalosightSalesStage, string> = {
  identifying_opportunity: "Identifying an Opportunity",
  determine_problem_impact: "Determine Problem / Impact",
  validate_benefits_value: "Validate Benefits & Value",
  confirm_value_with_power: "Confirm Value with Power",
  negotiating_mutual_plan: "Negotiating & Mutual Plan",
  finalizing_closure: "Finalizing Closure",
  pending_closed: "Pending Closed"
};

const fieldWeights: Record<string, number> = {
  economic_buyer_identified: 6,
  executive_sponsor_identified: 4,
  business_challenge_defined: 5,
  compelling_event_defined: 5,
  competition_identified: 3,
  timeline_defined: 2,
  budget_defined: 5,
  decision_criteria_defined: 5,
  decision_process_defined: 6,
  political_influence_map_complete: 4,
  business_value_defined: 6,
  roi_defined: 8,
  implementation_scope_defined: 3,
  halosight_differentiation_defined: 3,
  mutual_close_plan_exists: 8,
  verbal_selection_received: 5,
  pricing_proposal_created: 2,
  pricing_agreement_reached: 4,
  terms_and_conditions_aligned: 2,
  order_form_aligned: 2,
  customer_approvals_complete: 1,
  signature_process_defined: 1,
  next_meeting_scheduled: 3,
  next_step_defined: 3,
  recent_meaningful_customer_interaction: 2,
  stage_evidence_specific: 2,
  internal_approvals_complete: 4,
  implementation_plan_finalized: 4,
  po_process_defined: 1,
  executed_agreement_received: 6,
  customer_invoiced: 2
};

const criticalFieldsByStage: Record<HalosightSalesStage, string[]> = {
  identifying_opportunity: [
    "economic_buyer_identified",
    "business_challenge_defined",
    "compelling_event_defined",
    "executive_sponsor_identified",
    "timeline_defined"
  ],
  determine_problem_impact: [
    "decision_criteria_defined",
    "decision_process_defined",
    "budget_defined"
  ],
  validate_benefits_value: [
    "business_value_defined",
    "roi_defined",
    "political_influence_map_complete",
    "implementation_scope_defined"
  ],
  confirm_value_with_power: [
    "economic_buyer_identified",
    "business_value_defined",
    "roi_defined",
    "mutual_close_plan_exists"
  ],
  negotiating_mutual_plan: [
    "internal_approvals_complete",
    "implementation_plan_finalized",
    "pricing_agreement_reached",
    "mutual_close_plan_exists"
  ],
  finalizing_closure: [
    "customer_approvals_complete",
    "po_process_defined",
    "signature_process_defined"
  ],
  pending_closed: ["executed_agreement_received"]
};

const nextActionRules: Array<{ field: string; action: string }> = [
  { field: "economic_buyer_identified", action: "Identify the budget owner and map a path to power." },
  { field: "decision_process_defined", action: "Map stakeholders, approvals, and the decision sequence." },
  { field: "roi_defined", action: "Quantify time saved, data-quality impact, and business value." },
  { field: "mutual_close_plan_exists", action: "Document a mutual close plan with milestones, owners, and dates." },
  { field: "signature_process_defined", action: "Confirm signer, routing path, PO requirement, and signature deadline." }
];

export function inspectDeal(input: DealInspectionInput): DealInspectionResult {
  const evidence = inferEvidence(input);
  const internalContext = isInternalContext(input);
  const currentStage = input.currentStage;
  const criticalFieldsMissing = criticalFieldsByStage[currentStage].filter((field) => evidence[field] !== 2);
  const stageValid = criticalFieldsMissing.length === 0;
  const stalled = isStalled(currentStage, input);
  const redFlags = detectRedFlags(currentStage, input, evidence, stalled, internalContext);
  const penaltiesApplied = buildPenalties(currentStage, input, evidence, stalled, internalContext);
  const baseScore = calculateBaseScore(evidence, input);
  const dealScore = Math.max(0, Math.round(baseScore - penaltiesApplied.reduce((sum, item) => sum + item.points, 0)));
  const scoreBand = scoreBandFor(dealScore);
  const forecastAllowed = allowedForecastFor(currentStage, dealScore, evidence);
  const forecastRecommended = recommendedForecastFor(currentStage, dealScore, evidence, stalled);
  const recommendedStage = stageValid ? currentStage : fallbackStage(currentStage, evidence);
  const stageAdvanceBlockedBy = criticalFieldsMissing.map(humanizeField);
  const topRisks = [...redFlags, ...stageAdvanceBlockedBy].slice(0, 4);
  const nextBestAction = recommendNextAction(criticalFieldsMissing, stalled);

  return {
    currentStage,
    recommendedStage,
    stageValid,
    stageAdvanceBlockedBy,
    stalled,
    redFlags,
    topRisks,
    nextBestAction,
    forecastAllowed,
    forecastRecommended,
    dealScore,
    scoreBand,
    criticalFieldsMissing,
    penaltiesApplied,
    evidence
  };
}

function inferEvidence(input: DealInspectionInput): Record<string, EvidenceStrength> {
  const notes = input.notes.toLowerCase();
  const now = new Date();
  const lastInteractionAgeDays = input.lastMeaningfulCustomerInteractionDate
    ? Math.floor((now.getTime() - new Date(input.lastMeaningfulCustomerInteractionDate).getTime()) / 86400000)
    : Number.POSITIVE_INFINITY;

  return {
    economic_buyer_identified: boolScore(
      notes.includes("economic buyer") || notes.includes("final decision maker") || notes.includes("owns budget"),
      includesAny(notes, ["buyer", "budget owner", "leadership", "vp", "cro", "owner"])
    ),
    executive_sponsor_identified: boolScore(
      notes.includes("executive sponsor"),
      includesAny(notes, ["sponsor", "leadership", "executive", "cross-functional"])
    ),
    business_challenge_defined: boolScore(
      includesAny(notes, ["business challenge", "workflow", "failure point", "visibility gap", "execution consistency"]),
      includesAny(notes, ["problem", "challenge", "gap", "manual note", "crm"])
    ),
    compelling_event_defined: boolScore(
      includesAny(notes, ["compelling event", "deadline", "mandate", "initiative", "merger", "priority", "this quarter"]),
      includesAny(notes, ["timeline", "next week", "phase 1", "planning", "review"])
    ),
    competition_identified: boolScore(
      includesAny(notes, ["gong", "chorus", "clari", "status quo", "internal build", "competition"]),
      includesAny(notes, ["salesforce", "manual process", "spreadsheet", "current process", "status quo"])
    ),
    timeline_defined: boolScore(
      includesAny(notes, ["q1", "q2", "q3", "q4", "30 days", "60 days", "90 days", "deadline", "close date"]),
      Boolean(input.closeDate || input.nextStepDate)
    ),
    budget_defined: boolScore(
      includesAny(notes, ["budget approved", "budget path", "funding path", "budget owner"]),
      includesAny(notes, ["budget", "resourcing", "phase 1 foundation", "gtm priorities"])
    ),
    decision_criteria_defined: boolScore(
      includesAny(notes, ["decision criteria", "evaluate", "selection criteria"]),
      includesAny(notes, ["criteria", "workflow review", "alignment", "what good looks like"])
    ),
    decision_process_defined: boolScore(
      includesAny(notes, ["decision process", "approval path", "procurement", "legal review", "sequence of events"]),
      includesAny(notes, ["stakeholders", "approvals", "process", "cross-functional coordination", "review cadence"])
    ),
    political_influence_map_complete: boolScore(
      includesAny(notes, ["political map", "influencer", "blocker", "champion and buyer"]),
      includesAny(notes, ["champion", "influencer", "blocker"])
    ),
    business_value_defined: boolScore(
      includesAny(notes, ["business value", "time saved", "forecast confidence", "data completeness", "risk reduction"]),
      includesAny(notes, ["impact", "value"])
    ),
    roi_defined: boolScore(
      includesAny(notes, ["roi", "%", "hours saved", "cost avoided", "quantified"]),
      includesAny(notes, ["value case", "return"])
    ),
    implementation_scope_defined: boolScore(
      includesAny(notes, ["implementation scope", "phase 1", "user group", "workflow", "systems"]),
      includesAny(notes, ["implementation", "scope", "workflow review"])
    ),
    halosight_differentiation_defined: boolScore(
      includesAny(notes, ["why halosight", "field visibility gap", "conversation-to-crm", "differentiate", "capture, extract, activate"]),
      notes.includes("halosight")
    ),
    mutual_close_plan_exists: boolScore(
      includesAny(notes, ["mutual close plan", "milestones", "owners and dates"]),
      includesAny(notes, ["close plan", "mutual plan"])
    ),
    verbal_selection_received: boolScore(
      includesAny(notes, ["preferred direction", "selected", "we are going with halosight"]),
      notes.includes("preferred")
    ),
    pricing_proposal_created: boolScore(includesAny(notes, ["proposal delivered", "pricing proposal", "pricing shared"]), notes.includes("proposal")),
    pricing_agreement_reached: boolScore(includesAny(notes, ["pricing agreed", "price aligned", "commercial agreement"]), notes.includes("pricing agreed")),
    terms_and_conditions_aligned: boolScore(includesAny(notes, ["terms aligned", "legal aligned", "no material legal objections"]), notes.includes("terms")),
    order_form_aligned: boolScore(includesAny(notes, ["order form aligned", "order form agreed"]), notes.includes("order form")),
    internal_approvals_complete: boolScore(includesAny(notes, ["internal approvals complete", "seller approvals complete"]), notes.includes("internal approval")),
    customer_approvals_complete: boolScore(includesAny(notes, ["customer approvals complete", "all approvals secured"]), notes.includes("customer approval")),
    po_process_defined: boolScore(includesAny(notes, ["po process defined", "purchase order process"]), notes.includes("purchase order")),
    signature_process_defined: boolScore(includesAny(notes, ["signature process confirmed", "signer confirmed", "routing method"]), notes.includes("signature")),
    executed_agreement_received: boolScore(includesAny(notes, ["executed agreement", "signed agreement"]), notes.includes("signed")),
    customer_invoiced: boolScore(notes.includes("customer invoiced"), notes.includes("invoice")),
    next_meeting_scheduled: boolScore(Boolean(input.nextStepDate), notes.includes("next meeting scheduled")),
    next_step_defined: boolScore(Boolean(input.nextStepDescription && input.nextStepDate), Boolean(input.nextStepDescription)),
    recent_meaningful_customer_interaction: lastInteractionAgeDays <= 5 ? 2 : lastInteractionAgeDays <= 14 ? 1 : 0,
    stage_evidence_specific: specificityScore(notes)
  };
}

function calculateBaseScore(evidence: Record<string, EvidenceStrength>, input: DealInspectionInput) {
  const weightedEvidence = Object.entries(fieldWeights).reduce((sum, [field, weight]) => {
    const strength = evidence[field] ?? 0;
    const factor = strength === 2 ? 1 : strength === 1 ? 0.5 : 0;
    return sum + weight * factor;
  }, 0);

  return Math.min(100, weightedEvidence);
}

function buildPenalties(
  currentStage: HalosightSalesStage,
  input: DealInspectionInput,
  evidence: Record<string, EvidenceStrength>,
  stalled: boolean,
  internalContext: boolean
) {
  const penalties: Array<{ reason: string; points: number }> = [];

  if (!internalContext && currentStage !== "identifying_opportunity" && evidence.economic_buyer_identified === 0) {
    penalties.push({ reason: "No economic buyer beyond Stage 1", points: 12 });
  }
  if (!internalContext && evidence.compelling_event_defined === 0) {
    penalties.push({ reason: "No compelling event", points: 10 });
  }
  if (isAtOrBeyond(currentStage, "validate_benefits_value") && evidence.decision_process_defined === 0) {
    penalties.push({ reason: "No decision process beyond Stage 2", points: 10 });
  }
  if (isAtOrBeyond(currentStage, "confirm_value_with_power") && evidence.roi_defined === 0) {
    penalties.push({ reason: "No ROI beyond Stage 3", points: 12 });
  }
  if (isAtOrBeyond(currentStage, "negotiating_mutual_plan") && evidence.mutual_close_plan_exists === 0) {
    penalties.push({ reason: "No mutual close plan beyond Stage 4", points: 15 });
  }
  if (evidence.next_step_defined === 0) {
    penalties.push({ reason: "No next step scheduled", points: 8 });
  }
  if (stalled) {
    penalties.push({ reason: "Opportunity stalled beyond stage threshold", points: 8 });
  }
  if (
    includesAny(input.notes.toLowerCase(), ["legal", "procurement"]) &&
    evidence.po_process_defined === 0 &&
    evidence.signature_process_defined === 0
  ) {
    penalties.push({ reason: "Legal/procurement mentioned without PO or signature path", points: 6 });
  }
  if (
    isAtOrBeyond(currentStage, "negotiating_mutual_plan") &&
    includesAny(input.notes.toLowerCase(), ["excited", "positive feedback", "good call"]) &&
    evidence.pricing_agreement_reached === 0
  ) {
    penalties.push({ reason: "Positive sentiment without commercial proof in late stage", points: 6 });
  }
  if (evidence.stage_evidence_specific === 0) {
    penalties.push({ reason: "Generic notes / weak evidence quality", points: 5 });
  }

  return penalties;
}

function detectRedFlags(
  currentStage: HalosightSalesStage,
  input: DealInspectionInput,
  evidence: Record<string, EvidenceStrength>,
  stalled: boolean,
  internalContext: boolean
) {
  const flags: string[] = [];
  if (!internalContext && evidence.compelling_event_defined === 0) flags.push("No urgency");
  if (!internalContext && currentStage !== "identifying_opportunity" && evidence.economic_buyer_identified === 0) flags.push("No power access");
  if (isAtOrBeyond(currentStage, "validate_benefits_value") && evidence.decision_process_defined === 0) flags.push("Unknown buying process");
  if (isAtOrBeyond(currentStage, "confirm_value_with_power") && evidence.roi_defined === 0) flags.push("No value case");
  if (isAtOrBeyond(currentStage, "negotiating_mutual_plan") && evidence.mutual_close_plan_exists === 0) flags.push("No close plan");
  if (
    includesAny(input.notes.toLowerCase(), ["legal", "procurement"]) &&
    evidence.po_process_defined === 0 &&
    evidence.signature_process_defined === 0
  ) {
    flags.push("Fake late-stage motion");
  }
  if (stalled) flags.push("Stalled opportunity");
  return flags;
}

function allowedForecastFor(
  currentStage: HalosightSalesStage,
  dealScore: number,
  evidence: Record<string, EvidenceStrength>
): ForecastCategory {
  if (
    (currentStage === "negotiating_mutual_plan" || currentStage === "finalizing_closure") &&
    dealScore >= 90 &&
    evidence.mutual_close_plan_exists === 2 &&
    evidence.pricing_agreement_reached === 2 &&
    evidence.implementation_plan_finalized === 2
  ) {
    return "Commit";
  }

  if (
    currentStage === "confirm_value_with_power" &&
    dealScore >= 75 &&
    evidence.economic_buyer_identified === 2 &&
    evidence.roi_defined === 2
  ) {
    return "Best Case";
  }

  return "Pipeline";
}

function recommendedForecastFor(
  currentStage: HalosightSalesStage,
  dealScore: number,
  evidence: Record<string, EvidenceStrength>,
  stalled: boolean
): ForecastCategory {
  if (stalled || dealScore < 75) {
    return "Pipeline";
  }
  return allowedForecastFor(currentStage, dealScore, evidence);
}

function fallbackStage(currentStage: HalosightSalesStage, evidence: Record<string, EvidenceStrength>): HalosightSalesStage {
  if (evidence.executed_agreement_received === 2) return "pending_closed";
  if (evidence.signature_process_defined === 2 || evidence.customer_approvals_complete === 2) return "finalizing_closure";
  if (evidence.mutual_close_plan_exists === 2 || evidence.pricing_agreement_reached === 2) return "negotiating_mutual_plan";
  if (evidence.economic_buyer_identified === 2 && evidence.business_value_defined === 2 && evidence.roi_defined === 2) {
    return "confirm_value_with_power";
  }
  if (evidence.business_value_defined === 2 || evidence.roi_defined === 2) return "validate_benefits_value";
  if (evidence.decision_process_defined === 2 || evidence.decision_criteria_defined === 2) return "determine_problem_impact";
  return currentStage === "identifying_opportunity" ? currentStage : "identifying_opportunity";
}

function recommendNextAction(criticalFieldsMissing: string[], stalled: boolean) {
  if (stalled) {
    return "Re-establish a dated next step with the customer and confirm current buying momentum.";
  }

  for (const rule of nextActionRules) {
    if (criticalFieldsMissing.includes(rule.field)) {
      return rule.action;
    }
  }

  return "Strengthen the next qualification gap with direct customer-confirmed evidence.";
}

function scoreBandFor(score: number): DealInspectionResult["scoreBand"] {
  if (score >= 90) return "Strong / Commit-Ready";
  if (score >= 75) return "Healthy / Best Case-Ready";
  if (score >= 60) return "Workable but Risky";
  if (score >= 40) return "Weak Opportunity";
  return "Poor / Likely Noise";
}

function isStalled(stage: HalosightSalesStage, input: DealInspectionInput) {
  if (!input.nextStepDescription || !input.nextStepDate) {
    return true;
  }
  if (!input.lastMeaningfulCustomerInteractionDate) {
    return true;
  }

  const ageDays = Math.floor(
    (Date.now() - new Date(input.lastMeaningfulCustomerInteractionDate).getTime()) / 86400000
  );

  if (stage === "identifying_opportunity") return ageDays > 14;
  if (stage === "determine_problem_impact" || stage === "validate_benefits_value") return ageDays > 10;
  return ageDays > 5;
}

function boolScore(strong: boolean, weak: boolean): EvidenceStrength {
  if (strong) return 2;
  if (weak) return 1;
  return 0;
}

function specificityScore(notes: string): EvidenceStrength {
  if (notes.length < 40) return 0;
  if (includesAny(notes, ["improve efficiency", "drive value", "good meeting"])) return 1;
  if (
    includesAny(notes, [
      "workflow",
      "decision process",
      "budget owner",
      "economic buyer",
      "timeline",
      "roi",
      "phase 1",
      "crm",
      "execution consistency",
      "review cadence"
    ])
  ) {
    return 2;
  }
  return 1;
}

function includesAny(value: string, patterns: string[]) {
  return patterns.some((pattern) => value.includes(pattern));
}

function isAtOrBeyond(currentStage: HalosightSalesStage, targetStage: HalosightSalesStage) {
  return stageOrder.indexOf(currentStage) >= stageOrder.indexOf(targetStage);
}

function humanizeField(field: string) {
  return field
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatSalesStageLabel(stage: HalosightSalesStage) {
  return stageLabels[stage];
}

function isInternalContext(input: DealInspectionInput) {
  const combined = `${input.accountName} ${input.opportunityName} ${input.notes}`.toLowerCase();
  return includesAny(combined, ["internal", "halosight", "demand gen planning", "gtm priorities"]);
}
