import type { DraftModeConfig } from "../config.js";
import type { AgentName } from "../domain/types.js";

export interface PolicyDecision {
  allowed: boolean;
  reason: string;
}

const internalOnlyAgents: AgentName[] = ["meeting-prep", "pipeline-inspection", "account-research"];

export function canPublishInternalBrief(config: DraftModeConfig, agent: AgentName): PolicyDecision {
  if (!config.allowInternalBriefs) {
    return { allowed: false, reason: "Internal brief publishing is disabled." };
  }

  if (internalOnlyAgents.includes(agent)) {
    return { allowed: true, reason: "Internal-only outputs are allowed in draft mode." };
  }

  return { allowed: true, reason: "This action stays internal and does not modify systems of record." };
}

export function canWriteSalesforce(config: DraftModeConfig): PolicyDecision {
  return config.allowSalesforceWrites
    ? { allowed: true, reason: "Salesforce writes have been explicitly enabled." }
    : { allowed: false, reason: "Salesforce writes are blocked in draft mode pending approval." };
}

export function canSendEmail(config: DraftModeConfig): PolicyDecision {
  return config.allowGmailSend
    ? { allowed: true, reason: "Email sending has been explicitly enabled." }
    : { allowed: false, reason: "Email sending is blocked in draft mode pending approval." };
}

export function canEnrollApollo(config: DraftModeConfig): PolicyDecision {
  return config.allowApolloEnrollment
    ? { allowed: true, reason: "Apollo enrollment has been explicitly enabled." }
    : { allowed: false, reason: "Apollo enrollment is blocked in draft mode pending approval." };
}
