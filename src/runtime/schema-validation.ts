import { z } from "zod";

import type { HalosightAgentName } from "../domain/halosight.js";

const scoreGradeSchema = z.object({
  score: z.number(),
  grade: z.enum(["A", "B", "C", "D"]),
  reasoning: z.array(z.string())
});

const icpSentinelOutputSchema = z.object({
  account_fit: scoreGradeSchema,
  persona_fit: scoreGradeSchema,
  pain_fit: scoreGradeSchema,
  urgency_signals: z.array(z.string()),
  disqualification_risks: z.array(z.string()),
  recommended_motion: z.enum(["pursue", "nurture", "deprioritize", "disqualify"]),
  recommended_angle: z.string()
});

const outreachStrategistOutputSchema = z.object({
  primary_angle: z.string(),
  secondary_angle: z.string(),
  email_subject_options: z.array(z.string()),
  email_opening_lines: z.array(z.string()),
  linkedin_opening_lines: z.array(z.string()),
  voicemail_opening: z.string(),
  discovery_hook: z.string(),
  why_this_angle: z.array(z.string())
});

const discoveryQualifierOutputSchema = z.object({
  confirmed_pains: z.array(z.string()),
  business_impacts: z.array(z.string()),
  stakeholders_identified: z.array(z.string()),
  urgency_indicators: z.array(z.string()),
  open_questions: z.array(z.string()),
  qualification_assessment: z.object({
    problem_clarity_score: z.number(),
    impact_score: z.number(),
    urgency_score: z.number(),
    stakeholder_score: z.number(),
    overall_status: z.enum(["qualified", "partially_qualified", "unqualified"])
  }),
  recommended_next_step: z.string(),
  recommended_follow_up_questions: z.array(z.string())
});

const objectionNavigatorOutputSchema = z.object({
  objection_type: z.string(),
  acknowledgement: z.string(),
  reframe: z.string(),
  supporting_logic: z.array(z.string()),
  redirect_question: z.string(),
  risk_if_unresolved: z.string()
});

const dealProgressionAnalystOutputSchema = z.object({
  scores: z.object({
    problem_clarity: z.number(),
    business_impact: z.number(),
    stakeholder_alignment: z.number(),
    urgency: z.number(),
    next_step_strength: z.number(),
    deal_momentum: z.number()
  }),
  stage_assessment: z.object({
    starting_stage: z.enum(["awareness", "problem_defined", "business_case", "solution_fit", "decision"]),
    ending_stage: z.enum(["awareness", "problem_defined", "business_case", "solution_fit", "decision"]),
    advanced: z.boolean()
  }),
  evidence: z.object({
    confirmed: z.array(z.string()),
    missing: z.array(z.string()),
    risks: z.array(z.string())
  }),
  seller_coaching: z.object({
    what_went_well: z.array(z.string()),
    what_was_weak: z.array(z.string()),
    required_next_actions: z.array(z.string())
  })
});

const crmStructurerOutputSchema = z.object({
  account_summary: z.string(),
  opportunity_summary: z.string(),
  confirmed_pains: z.array(z.string()),
  business_impact: z.array(z.string()),
  key_commitments: z.array(
    z.object({
      owner: z.enum(["prospect", "seller", "internal"]),
      commitment: z.string(),
      due_date: z.string()
    })
  ),
  stakeholders: z.array(
    z.object({
      name: z.string(),
      role: z.string(),
      influence: z.enum(["high", "medium", "low"]),
      stance: z.enum(["supportive", "neutral", "skeptical", "unknown"])
    })
  ),
  next_step: z.string(),
  next_step_date: z.string(),
  recommended_stage: z.string(),
  follow_up_email_points: z.array(z.string()),
  crm_notes_clean: z.string()
});

const outputSchemas: Record<HalosightAgentName, z.ZodTypeAny> = {
  icp_sentinel: icpSentinelOutputSchema,
  outreach_strategist: outreachStrategistOutputSchema,
  discovery_qualifier: discoveryQualifierOutputSchema,
  objection_navigator: objectionNavigatorOutputSchema,
  deal_progression_analyst: dealProgressionAnalystOutputSchema,
  crm_structurer: crmStructurerOutputSchema
};

export function validateAgentOutput<T>(agentName: HalosightAgentName, payload: unknown): T {
  return outputSchemas[agentName].parse(payload) as T;
}

export function tryValidateAgentOutput(agentName: HalosightAgentName, payload: unknown) {
  return outputSchemas[agentName].safeParse(payload);
}
