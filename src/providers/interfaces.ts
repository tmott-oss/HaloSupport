import type {
  AccountContext,
  ApprovalRequest,
  CallSummaryPacket,
  ContactContext,
  MeetingContext,
  MeetingPrepPacket
} from "../domain/types.js";

export interface GoogleWorkspaceProvider {
  getUpcomingMeeting(meetingId: string): Promise<MeetingContext>;
  findMeeting(criteria: { title?: string; startsAt?: string }): Promise<MeetingContext>;
  createDraftDoc(title: string, markdown: string): Promise<{ url: string }>;
  createGmailDraft?(subject: string, body: string, recipients: string[]): Promise<{ url: string }>;
}

export interface SalesforceProvider {
  getAccountByMeetingAttendees(attendees: string[]): Promise<AccountContext>;
  getPrimaryContact(accountId: string): Promise<ContactContext | undefined>;
  getRecentActivity(accountId: string): Promise<string[]>;
  queueProposedUpdate?(approval: ApprovalRequest): Promise<{ url: string }>;
}

export interface ApolloProvider {
  getBuyingSignals(accountName: string): Promise<string[]>;
  getMessagingAngles(accountName: string): Promise<string[]>;
}

export interface SlackProvider {
  postMeetingBrief(packet: MeetingPrepPacket, artifactUrl: string): Promise<{ url: string }>;
  postCallSummaryApproval(packet: CallSummaryPacket, artifactUrl?: string, gmailDraftUrl?: string): Promise<{ url: string }>;
  postApprovalRequest(approval: ApprovalRequest): Promise<{ url: string }>;
}

export interface ChatwootContactInput {
  identifier?: string;
  name?: string;
  email?: string;
  phoneNumber?: string;
  customAttributes?: Record<string, unknown>;
}

export interface ChatwootTranscriptMessage {
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
}

export interface ChatwootCreateConversationInput {
  sessionId: string;
  source: "public_website" | "authenticated_app" | "flutter_webview";
  contact?: ChatwootContactInput;
  subject?: string;
  transcript: ChatwootTranscriptMessage[];
  escalationReason: string;
  customAttributes?: Record<string, unknown>;
}

export interface ChatwootConversation {
  conversationId: string;
  status: "open" | "pending" | "resolved" | "unknown";
  url?: string;
}

export interface ChatwootAppendMessageInput {
  conversationId: string;
  content: string;
  messageType: "incoming" | "outgoing" | "private_note";
}

export interface ChatwootProvider {
  createConversation(input: ChatwootCreateConversationInput): Promise<ChatwootConversation>;
  appendMessage(input: ChatwootAppendMessageInput): Promise<{ messageId?: string }>;
  getConversation(conversationId: string): Promise<ChatwootConversation>;
}
