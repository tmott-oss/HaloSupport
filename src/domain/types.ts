export type AgentName =
  | "meeting-prep"
  | "call-summary"
  | "pipeline-inspection"
  | "account-research"
  | "personalized-outreach";

export interface AccountContext {
  accountId: string;
  accountName: string;
  website?: string;
  industry?: string;
  employees?: number;
  currentOpportunity?: {
    opportunityId: string;
    stage: string;
    amount?: number;
    closeDate?: string;
  };
}

export interface ContactContext {
  contactId: string;
  fullName: string;
  title?: string;
  email?: string;
  linkedinUrl?: string;
}

export interface MeetingContext {
  meetingId: string;
  title: string;
  startsAt: string;
  attendees: string[];
  notes?: string;
}

export interface ApprovalRequest {
  agent: AgentName;
  action: string;
  summary: string;
  recordUrl?: string;
  artifactUrl?: string;
  proposedChanges: string[];
}

export interface MeetingPrepPacket {
  agent: "meeting-prep";
  account: AccountContext;
  primaryContact?: ContactContext;
  meeting: MeetingContext;
  companyContextSummary: string[];
  personaContext: string[];
  stageGuidance: string[];
  recentActivity: string[];
  apolloSignals: string[];
  suggestedQuestions: string[];
  talkingPoints: string[];
}

export interface CallSummaryInput {
  account: AccountContext;
  primaryContact?: ContactContext;
  meeting: MeetingContext;
  rawNotes: string;
}

export interface CallSummaryPacket {
  agent: "call-summary";
  account: AccountContext;
  primaryContact?: ContactContext;
  meeting: MeetingContext;
  companyContextSummary: string[];
  personaContext: string[];
  stageGuidance: string[];
  summary: string;
  confirmedPains: string[];
  businessImpacts: string[];
  nextSteps: string[];
  risks: string[];
  dealInspection?: DealInspectionResult;
  followUpEmailSubject: string;
  followUpEmailBody: string;
}

export type EvidenceStrength = 0 | 1 | 2;

export type HalosightSalesStage =
  | "identifying_opportunity"
  | "determine_problem_impact"
  | "validate_benefits_value"
  | "confirm_value_with_power"
  | "negotiating_mutual_plan"
  | "finalizing_closure"
  | "pending_closed";

export interface DealInspectionInput {
  opportunityName: string;
  accountName: string;
  owner?: string;
  currentStage: HalosightSalesStage;
  forecastCategory?: "Pipeline" | "Best Case" | "Commit";
  closeDate?: string;
  closeDateConfidence?: string;
  notes: string;
  lastMeaningfulCustomerInteractionDate?: string;
  nextStepDescription?: string;
  nextStepDate?: string;
}

export interface DealInspectionResult {
  currentStage: HalosightSalesStage;
  recommendedStage: HalosightSalesStage;
  stageValid: boolean;
  stageAdvanceBlockedBy: string[];
  stalled: boolean;
  redFlags: string[];
  topRisks: string[];
  nextBestAction: string;
  forecastAllowed: "Pipeline" | "Best Case" | "Commit";
  forecastRecommended: "Pipeline" | "Best Case" | "Commit";
  dealScore: number;
  scoreBand: "Strong / Commit-Ready" | "Healthy / Best Case-Ready" | "Workable but Risky" | "Weak Opportunity" | "Poor / Likely Noise";
  criticalFieldsMissing: string[];
  penaltiesApplied: Array<{
    reason: string;
    points: number;
  }>;
  evidence: Record<string, EvidenceStrength>;
}
