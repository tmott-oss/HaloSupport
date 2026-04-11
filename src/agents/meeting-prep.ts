import type { AppConfig } from "../config.js";
import type { ApprovalRequest, MeetingPrepPacket } from "../domain/types.js";
import type {
  ApolloProvider,
  GoogleWorkspaceProvider,
  SalesforceProvider,
  SlackProvider
} from "../providers/interfaces.js";
import { canPublishInternalBrief } from "../policies/draft-mode.js";
import {
  extractCompanyContextSummary,
  extractPersonaContextSummary,
  extractStageGuidanceSummary,
  inferPersonaName,
  inferStageName,
  loadHalosightPromptPackage
} from "../runtime/halosight.js";

export interface MeetingPrepDependencies {
  config: AppConfig;
  google: GoogleWorkspaceProvider;
  salesforce: SalesforceProvider;
  apollo: ApolloProvider;
  slack: SlackProvider;
}

export interface MeetingPrepResult {
  packet: MeetingPrepPacket;
  artifactUrl?: string;
  slackUrl?: string;
  approval?: ApprovalRequest;
}

function buildMarkdown(packet: MeetingPrepPacket): string {
  return [
    `# [DRAFT] Meeting Brief: ${packet.account.accountName}`,
    "",
    `## Halosight Positioning`,
    ...packet.companyContextSummary.map((item) => `- ${item}`),
    "",
    `## Persona Context`,
    ...packet.personaContext.map((item) => `- ${item}`),
    "",
    `## Stage Guidance`,
    ...packet.stageGuidance.map((item) => `- ${item}`),
    "",
    `## Meeting`,
    `- Title: ${packet.meeting.title}`,
    `- Starts: ${packet.meeting.startsAt}`,
    `- Account: ${packet.account.accountName}`,
    `- Primary contact: ${packet.primaryContact?.fullName ?? "Unknown"}`,
    "",
    `## Opportunity`,
    `- Stage: ${packet.account.currentOpportunity?.stage ?? "None"}`,
    `- Amount: ${packet.account.currentOpportunity?.amount ?? "Unknown"}`,
    `- Close date: ${packet.account.currentOpportunity?.closeDate ?? "Unknown"}`,
    "",
    `## Recent Activity`,
    ...packet.recentActivity.map((item) => `- ${item}`),
    "",
    `## Apollo Signals`,
    ...packet.apolloSignals.map((item) => `- ${item}`),
    "",
    `## Talking Points`,
    ...packet.talkingPoints.map((item) => `- ${item}`),
    "",
    `## Suggested Questions`,
    ...packet.suggestedQuestions.map((item) => `- ${item}`)
  ].join("\n");
}

export async function runMeetingPrep(
  meetingRef: string | { title?: string; startsAt?: string },
  dependencies: MeetingPrepDependencies
): Promise<MeetingPrepResult> {
  const { config, google, salesforce, apollo, slack } = dependencies;
  const promptPackage = await loadHalosightPromptPackage();

  const meeting =
    typeof meetingRef === "string"
      ? await google.getUpcomingMeeting(meetingRef)
      : await google.findMeeting(meetingRef);
  const account = await salesforce.getAccountByMeetingAttendees(meeting.attendees);
  const primaryContact = await salesforce.getPrimaryContact(account.accountId);
  const recentActivity = await salesforce.getRecentActivity(account.accountId);
  const apolloSignals = await apollo.getBuyingSignals(account.accountName);
  const messagingAngles = await apollo.getMessagingAngles(account.accountName);
  const personaName = inferPersonaName(primaryContact, meeting);
  const stageName = inferStageName({
    notes: meeting.notes,
    opportunityStage: account.currentOpportunity?.stage,
    meetingTitle: meeting.title
  });
  const personaContext = extractPersonaContextSummary(promptPackage, personaName);
  const stageGuidance = extractStageGuidanceSummary(promptPackage, stageName);

  const packet: MeetingPrepPacket = {
    agent: "meeting-prep",
    account,
    primaryContact,
    meeting,
    companyContextSummary: extractCompanyContextSummary(promptPackage),
    personaContext,
    stageGuidance,
    recentActivity,
    apolloSignals,
    talkingPoints: messagingAngles,
    suggestedQuestions: [
      "What is the biggest visibility gap between customer interactions and your current system of record?",
      "Where does important context still get lost after meetings or field activity?",
      "Which commitments, risks, or next steps are hardest to inspect reliably today?",
      "What would make this priority worth changing now rather than later?",
      "Who else needs to trust this workflow for it to stick?"
    ]
  };

  const publishDecision = canPublishInternalBrief(config.draftMode, packet.agent);
  if (!publishDecision.allowed) {
    return {
      packet,
      approval: {
        agent: packet.agent,
        action: "publish-meeting-brief",
        summary: publishDecision.reason,
        proposedChanges: ["Create internal draft brief"],
        recordUrl: account.website
      }
    };
  }

  const markdown = buildMarkdown(packet);
  const artifact = await google.createDraftDoc(`[DRAFT] ${account.accountName} Meeting Brief`, markdown);
  const slackPost = await slack.postMeetingBrief(packet, artifact.url);

  return {
    packet,
    artifactUrl: artifact.url,
    slackUrl: slackPost.url
  };
}
