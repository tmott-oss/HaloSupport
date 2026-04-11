import type { AppConfig } from "../config.js";
import type { ApprovalRequest, CallSummaryPacket, MeetingPrepPacket } from "../domain/types.js";
import type { SlackProvider } from "./interfaces.js";

interface SlackPostMessageResponse {
  ok: boolean;
  channel?: string;
  ts?: string;
  error?: string;
}

export class SlackApiProvider implements SlackProvider {
  constructor(private readonly config: AppConfig) {}

  async postMeetingBrief(packet: MeetingPrepPacket, artifactUrl: string) {
    const channel = this.requiredChannelId();
    const text = [
      `*Meeting prep draft ready*`,
      `*Account:* ${packet.account.accountName}`,
      `*Contact:* ${packet.primaryContact?.fullName ?? "Unknown"}`,
      `*Meeting:* ${packet.meeting.title}`,
      `*Starts:* ${packet.meeting.startsAt}`,
      `*Doc:* ${artifactUrl}`,
      "",
      `*Halosight angle*`,
      ...packet.companyContextSummary.map((line) => `- ${line}`),
      "",
      `*Suggested questions*`,
      ...packet.suggestedQuestions.map((question) => `- ${question}`)
    ].join("\n");

    const message = await this.postMessage(channel, text);
    return { url: slackMessageUrl(channel, message.ts) };
  }

  async postCallSummaryApproval(packet: CallSummaryPacket, artifactUrl?: string, gmailDraftUrl?: string) {
    const channel = this.requiredChannelId();
    const text = [
      `*Call summary draft ready*`,
      `*Account:* ${packet.account.accountName}`,
      `*Contact:* ${packet.primaryContact?.fullName ?? "Unknown"}`,
      `*Meeting:* ${packet.meeting.title}`,
      `*Summary:* ${packet.summary}`,
      artifactUrl ? `*Summary doc:* ${artifactUrl}` : "",
      gmailDraftUrl ? `*Gmail draft:* ${gmailDraftUrl}` : "",
      "",
      `*Confirmed pains*`,
      ...packet.confirmedPains.map((item) => `- ${item}`),
      "",
      `*Business impacts*`,
      ...packet.businessImpacts.map((item) => `- ${item}`),
      "",
      `*Next steps to approve*`,
      ...packet.nextSteps.map((item) => `- ${item}`),
      "",
      `*Risks / open items*`,
      ...packet.risks.map((item) => `- ${item}`)
    ].join("\n");

    const message = await this.postMessage(channel, text);
    return { url: slackMessageUrl(channel, message.ts) };
  }

  async postApprovalRequest(approval: ApprovalRequest) {
    const channel = this.requiredChannelId();
    const text = [
      `*Approval requested: ${approval.action}*`,
      approval.summary,
      "",
      `*Proposed changes*`,
      ...approval.proposedChanges.map((item) => `- ${item}`),
      approval.recordUrl ? `*Record:* ${approval.recordUrl}` : "",
      approval.artifactUrl ? `*Artifact:* ${approval.artifactUrl}` : ""
    ]
      .filter(Boolean)
      .join("\n");

    const message = await this.postMessage(channel, text);
    return { url: slackMessageUrl(channel, message.ts) };
  }

  private async postMessage(channel: string, text: string) {
    const token = process.env.SLACK_BOT_TOKEN;
    if (!token) {
      throw new Error("Missing SLACK_BOT_TOKEN.");
    }

    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify({
        channel,
        text,
        mrkdwn: true
      })
    });

    if (!response.ok) {
      throw new Error(`Slack API request failed: ${response.status} ${await response.text()}`);
    }

    const payload = (await response.json()) as SlackPostMessageResponse;
    if (!payload.ok || !payload.channel || !payload.ts) {
      throw new Error(`Slack postMessage failed: ${payload.error ?? "unknown_error"}`);
    }

    return { channel: payload.channel, ts: payload.ts };
  }

  private requiredChannelId() {
    if (!this.config.slackApprovalChannelId) {
      throw new Error("Missing SLACK_APPROVAL_CHANNEL_ID for Slack posting.");
    }

    return this.config.slackApprovalChannelId;
  }
}

function slackMessageUrl(channel: string, ts?: string) {
  if (!ts) {
    return `https://slack.com/app_redirect?channel=${encodeURIComponent(channel)}`;
  }

  return `https://slack.com/app_redirect?channel=${encodeURIComponent(channel)}&message_ts=${encodeURIComponent(ts)}`;
}
