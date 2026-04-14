export type SupportSurface = "public_website" | "authenticated_app" | "flutter_webview";

export type KnowledgeSet = "public_site" | "authenticated_app";

export interface ChatSession {
  sessionId: string;
  surface: SupportSurface;
  knowledgeSet: KnowledgeSet;
  route?: string;
  userId?: string;
  accountId?: string;
  humanSupportStatus: "ai_only" | "escalated";
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  escalated?: boolean;
}

export interface ChatReply {
  role: "assistant";
  content: string;
  escalated: boolean;
  escalationReason?: string;
  confidence: number;
  sources: Array<{
    path: string;
    score: number;
    snippets: string[];
  }>;
  slackDelivery?: {
    mode: "webhook";
    delivered: boolean;
    error?: string;
  };
  chatwoot: {
    status: "created" | "not_needed" | "failed";
    conversation?: {
      conversationId: string;
      status: "open" | "pending" | "resolved" | "unknown";
      url?: string;
    };
    error?: string;
  };
}

export interface ChatMessageResponse {
  session: ChatSession;
  reply: ChatReply;
}

export interface SupportChatContext {
  surface: SupportSurface;
  route?: string;
  userId?: string;
  accountId?: string;
  knowledgeSet?: KnowledgeSet;
}
