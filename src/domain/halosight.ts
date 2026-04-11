export type HalosightAgentName =
  | "icp_sentinel"
  | "outreach_strategist"
  | "discovery_qualifier"
  | "objection_navigator"
  | "deal_progression_analyst"
  | "crm_structurer";

export type HalosightPersonaName =
  | "cro"
  | "vp_sales"
  | "revops"
  | "salesforce_admin"
  | "it"
  | "reps"
  | "managers";

export type HalosightCompetitiveName = "gong" | "chorus" | "clari" | "salesforce_native" | "status_quo";

export type HalosightStageName =
  | "awareness"
  | "problem_defined"
  | "business_case"
  | "solution_fit"
  | "decision";

export interface HalosightContextPack {
  readme: string;
  global: Record<string, string>;
  personas: Record<HalosightPersonaName, string>;
  competitive: Record<HalosightCompetitiveName, string>;
  stages: Record<HalosightStageName, string>;
  accountTemplate: Record<string, string>;
}

export interface HalosightSalesProcessPack {
  readme: string;
  stageDefinitions: string;
  aiEnforcementRules: string;
  validationDictionary: string;
  dealScoreModel: string;
  opportunityDataModel: string;
  dealInspectionExamples: string;
  codexSystemPrompt: string;
}

export interface PromptAssembly {
  masterContext: string;
  guardrails: string;
  globalInstructions: string;
  agentPrompt: string;
  schemaContract: unknown;
  supplementalContext?: string;
  assembledPrompt: string;
}

export interface HalosightPromptPackage {
  masterContext: string;
  complianceGuardrails: string;
  globalInstructions: string;
  prompts: Record<HalosightAgentName, string>;
  schemas: Record<HalosightAgentName, { input: unknown; output: unknown }>;
  salesforceFieldMap: unknown;
  examplePayloads: unknown;
  contextPack: HalosightContextPack;
  salesProcessPack: HalosightSalesProcessPack;
}
