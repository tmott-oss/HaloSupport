import type { AccountContext, ApprovalRequest, AgentName } from "../domain/types.js";

export function buildApprovalRequest(params: {
  agent: AgentName;
  action: string;
  account: AccountContext;
  summary: string;
  proposedChanges: string[];
  recordUrl?: string;
  artifactUrl?: string;
}): ApprovalRequest {
  return {
    agent: params.agent,
    action: params.action,
    summary: `${params.account.accountName}: ${params.summary}`,
    proposedChanges: params.proposedChanges,
    recordUrl: params.recordUrl,
    artifactUrl: params.artifactUrl
  };
}
