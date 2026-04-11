import type {
  ApolloProvider,
  GoogleWorkspaceProvider,
  SalesforceProvider,
  SlackProvider
} from "./interfaces.js";
import type { ApprovalRequest, CallSummaryPacket, MeetingPrepPacket } from "../domain/types.js";

export class MockGoogleWorkspaceProvider implements GoogleWorkspaceProvider {
  async getUpcomingMeeting(meetingId: string) {
    return {
      meetingId,
      title: "Discovery Call: Acme + Your Team",
      startsAt: "2026-04-03T15:00:00Z",
      attendees: ["alex@acme.com", "rep@yourteam.com"],
      notes: "Focus on onboarding friction and reporting needs."
    };
  }

  async findMeeting(criteria: { title?: string; startsAt?: string }) {
    return {
      meetingId: "mock-found-meeting",
      title: criteria.title ?? "Discovery Call: Acme + Your Team",
      startsAt: criteria.startsAt ?? "2026-04-03T15:00:00Z",
      attendees: ["alex@acme.com", "rep@yourteam.com"],
      notes: "Focus on onboarding friction and reporting needs."
    };
  }

  async createDraftDoc(title: string, _markdown: string) {
    return { url: `https://docs.google.com/document/d/mock-${encodeURIComponent(title)}` };
  }

  async createGmailDraft(subject: string, _body: string, recipients: string[]) {
    return {
      url: `https://mail.google.com/mail/u/0/#drafts?subject=${encodeURIComponent(subject)}&to=${encodeURIComponent(
        recipients.join(",")
      )}`
    };
  }
}

export class MockSalesforceProvider implements SalesforceProvider {
  async getAccountByMeetingAttendees(_attendees: string[]) {
    return {
      accountId: "001-test",
      accountName: "Acme Corp",
      website: "https://acme.example",
      industry: "Manufacturing",
      employees: 420,
      currentOpportunity: {
        opportunityId: "006-test",
        stage: "Discovery",
        amount: 25000,
        closeDate: "2026-05-15"
      }
    };
  }

  async getPrimaryContact(_accountId: string) {
    return {
      contactId: "003-test",
      fullName: "Alex Rivera",
      title: "Revenue Operations Manager",
      email: "alex@acme.com",
      linkedinUrl: "https://linkedin.com/in/alex-rivera"
    };
  }

  async getRecentActivity(_accountId: string) {
    return [
      "Opened outreach email on March 29.",
      "Booked discovery call after Apollo sequence step 2.",
      "Current opportunity is in Discovery with a tentative May 15 close date."
    ];
  }

  async queueProposedUpdate(approval: ApprovalRequest) {
    return { url: `https://salesforce.example/review/${encodeURIComponent(approval.action)}` };
  }
}

export class MockApolloProvider implements ApolloProvider {
  async getBuyingSignals() {
    return [
      "Hiring for RevOps and implementation roles.",
      "Recently viewed reporting and workflow automation pages.",
      "Contact engages with outbound content about onboarding efficiency."
    ];
  }

  async getMessagingAngles() {
    return [
      "Tie reporting automation to faster executive visibility.",
      "Position smoother onboarding as a way to reduce rep admin load.",
      "Lead with implementation support and measurable adoption."
    ];
  }
}

export class MockSlackProvider implements SlackProvider {
  async postMeetingBrief(_packet: MeetingPrepPacket, artifactUrl: string) {
    return { url: `https://slack.example/brief?doc=${encodeURIComponent(artifactUrl)}` };
  }

  async postCallSummaryApproval(_packet: CallSummaryPacket, artifactUrl?: string, gmailDraftUrl?: string) {
    return {
      url: `https://slack.example/call-summary?doc=${encodeURIComponent(artifactUrl ?? "")}&draft=${encodeURIComponent(
        gmailDraftUrl ?? ""
      )}`
    };
  }

  async postApprovalRequest(approval: ApprovalRequest) {
    return { url: `https://slack.example/approval/${encodeURIComponent(approval.action)}` };
  }
}
