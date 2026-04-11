import type { AppConfig } from "../config.js";
import type { ApprovalRequest, CallSummaryInput, CallSummaryPacket } from "../domain/types.js";
import { inspectDeal } from "../inspection/deal-inspection.js";
import type { GoogleWorkspaceProvider, SlackProvider } from "../providers/interfaces.js";
import { canSendEmail } from "../policies/draft-mode.js";
import {
  extractCompanyContextSummary,
  extractPersonaContextSummary,
  extractStageGuidanceSummary,
  inferPersonaName,
  inferStageName,
  loadHalosightPromptPackage
} from "../runtime/halosight.js";

export interface CallSummaryDependencies {
  config: AppConfig;
  google: GoogleWorkspaceProvider;
  slack: SlackProvider;
}

export interface CallSummaryResult {
  packet: CallSummaryPacket;
  artifactUrl?: string;
  gmailDraftUrl?: string;
  slackUrl?: string;
  approval?: ApprovalRequest;
}

function pickBullets(rawNotes: string, fallback: string[]): string[] {
  const lines = rawNotes
    .split("\n")
    .map((line) => line.trim().replace(/^[-*]\s*/, ""))
    .filter(Boolean);

  return lines.length > 0 ? lines.slice(0, 5) : fallback;
}

function buildSummary(rawNotes: string) {
  const cleaned = rawNotes.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return "The conversation covered current process gaps, operating impact, and a recommended next step.";
  }

  return cleaned.length > 220 ? `${cleaned.slice(0, 217)}...` : cleaned;
}

function buildCallSummaryMarkdown(packet: CallSummaryPacket) {
  return [
    `# [DRAFT] Call Summary: ${packet.account.accountName}`,
    "",
    `## Meeting`,
    `- Title: ${packet.meeting.title}`,
    `- Starts: ${packet.meeting.startsAt}`,
    `- Contact: ${packet.primaryContact?.fullName ?? "Unknown"}`,
    "",
    `## Executive Summary`,
    packet.summary,
    "",
    `## Persona Context`,
    ...packet.personaContext.map((item) => `- ${item}`),
    "",
    `## Stage Guidance`,
    ...packet.stageGuidance.map((item) => `- ${item}`),
    "",
    `## Confirmed Pains`,
    ...packet.confirmedPains.map((item) => `- ${item}`),
    "",
    `## Business Impact`,
    ...packet.businessImpacts.map((item) => `- ${item}`),
    "",
    `## Next Steps`,
    ...packet.nextSteps.map((item) => `- ${item}`),
    "",
    `## Risks`,
    ...packet.risks.map((item) => `- ${item}`),
    "",
    `## Deal Inspection`,
    `- Current stage: ${packet.dealInspection?.currentStage ?? "unknown"}`,
    `- Recommended stage: ${packet.dealInspection?.recommendedStage ?? "unknown"}`,
    `- Stage valid: ${packet.dealInspection?.stageValid ?? false}`,
    `- Deal score: ${packet.dealInspection?.dealScore ?? 0}`,
    `- Forecast recommended: ${packet.dealInspection?.forecastRecommended ?? "Pipeline"}`,
    ...((packet.dealInspection?.criticalFieldsMissing ?? []).map((item) => `- Missing: ${item}`))
  ].join("\n");
}

function buildFollowUpEmail(packet: CallSummaryPacket) {
  const recipientName = packet.primaryContact?.fullName?.split(" ")[0] ?? "there";
  const body = [
    `Hi ${recipientName},`,
    "",
    "Thanks again for the conversation today.",
    "",
    "A quick recap of what I heard:",
    ...packet.confirmedPains.map((item) => `- ${item}`),
    "",
    "The business impact we discussed:",
    ...packet.businessImpacts.map((item) => `- ${item}`),
    "",
    "Recommended next step:",
    ...packet.nextSteps.map((item) => `- ${item}`),
    "",
    "If helpful, I can also put together a more specific walkthrough tied to your current process.",
    "",
    "Best,",
    "Troy"
  ].join("\n");

  return {
    subject: `Follow-up: ${packet.account.accountName} conversation`,
    body
  };
}

export async function runCallSummary(
  input: CallSummaryInput,
  dependencies: CallSummaryDependencies
): Promise<CallSummaryResult> {
  const { config, google, slack } = dependencies;
  const promptPackage = await loadHalosightPromptPackage();
  const personaName = inferPersonaName(input.primaryContact, input.meeting);
  const stageName = inferStageName({
    notes: `${input.meeting.notes ?? ""} ${input.rawNotes}`,
    opportunityStage: input.account.currentOpportunity?.stage,
    meetingTitle: input.meeting.title
  });
  const personaContext = extractPersonaContextSummary(promptPackage, personaName);
  const stageGuidance = extractStageGuidanceSummary(promptPackage, stageName);
  const inspection = inspectDeal({
    opportunityName: input.account.currentOpportunity?.opportunityId ?? `${input.account.accountName} Opportunity`,
    accountName: input.account.accountName,
    owner: input.primaryContact?.fullName,
    currentStage: mapStageNameToSalesStage(stageName),
    closeDate: input.account.currentOpportunity?.closeDate,
    notes: `${input.meeting.notes ?? ""} ${input.rawNotes}`,
    lastMeaningfulCustomerInteractionDate: input.meeting.startsAt.slice(0, 10),
    nextStepDescription: "Review the current workflow for capturing and structuring customer interactions.",
    nextStepDate: input.account.currentOpportunity?.closeDate ?? input.meeting.startsAt.slice(0, 10)
  });

  const confirmedPains = pickBullets(input.rawNotes, [
    "Customer interactions are not consistently captured in a structured CRM workflow.",
    "Manual note entry creates incomplete account visibility."
  ]);
  const businessImpacts = [
    "Leaders have weaker visibility into what is actually happening in accounts.",
    "Forecast confidence drops when CRM history does not reflect real conversations."
  ];
  const nextSteps = stageName === "business_case"
    ? [
        "Quantify the operational value of cleaner interaction capture and faster follow-through.",
        "Align the next walkthrough to the specific workflow or implementation path that should move forward."
      ]
    : [
        inspection.nextBestAction,
        "Determine whether a Phase 1 workflow review or technical walkthrough makes sense for the team."
      ];
  const risks =
    inspection.topRisks.length > 0
      ? inspection.topRisks
      : [
          "Impact is directionally clear, but quantified urgency still needs validation.",
          "Additional stakeholders may need to be included before the deal can progress."
        ];

  const packet: CallSummaryPacket = {
    agent: "call-summary",
    account: input.account,
    primaryContact: input.primaryContact,
    meeting: input.meeting,
    companyContextSummary: extractCompanyContextSummary(promptPackage),
    personaContext,
    stageGuidance,
    summary: buildSummary(input.rawNotes),
    confirmedPains,
    businessImpacts,
    nextSteps,
    risks,
    dealInspection: inspection,
    followUpEmailSubject: `Follow-up: ${input.account.accountName} conversation`,
    followUpEmailBody: ""
  };

  const email = buildFollowUpEmail(packet);
  packet.followUpEmailSubject = email.subject;
  packet.followUpEmailBody = email.body;

  const artifact = await google.createDraftDoc(`[DRAFT] ${input.account.accountName} Call Summary`, buildCallSummaryMarkdown(packet));
  const gmailDraft = await google.createGmailDraft?.(
    email.subject,
    email.body,
    input.primaryContact?.email ? [input.primaryContact.email] : []
  );
  const slackPost = await slack.postCallSummaryApproval(packet, artifact.url, gmailDraft?.url);

  const sendDecision = canSendEmail(config.draftMode);
  const approval = !sendDecision.allowed
    ? {
        agent: "call-summary" as const,
        action: "send-follow-up-email",
        summary: `${input.account.accountName}: follow-up draft is ready for review before sending.`,
        proposedChanges: [
          "Review the call summary draft",
          "Approve or edit the Gmail draft follow-up",
          "Keep Salesforce writeback blocked until that integration is live"
        ],
        artifactUrl: artifact.url,
        recordUrl: gmailDraft?.url
      }
    : undefined;

  return {
    packet,
    artifactUrl: artifact.url,
    gmailDraftUrl: gmailDraft?.url,
    slackUrl: slackPost.url,
    approval
  };
}

function mapStageNameToSalesStage(stageName: ReturnType<typeof inferStageName>) {
  if (stageName === "awareness") return "identifying_opportunity" as const;
  if (stageName === "problem_defined") return "determine_problem_impact" as const;
  if (stageName === "business_case") return "validate_benefits_value" as const;
  if (stageName === "solution_fit") return "confirm_value_with_power" as const;
  return "negotiating_mutual_plan" as const;
}
