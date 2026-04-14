import type {
  ChatwootAppendMessageInput,
  ChatwootConversation,
  ChatwootCreateConversationInput,
  ChatwootProvider
} from "./interfaces.js";

export interface ChatwootApiConfig {
  baseUrl?: string;
  accountId?: string;
  inboxId?: string;
  apiToken?: string;
}

export class MockChatwootProvider implements ChatwootProvider {
  private readonly conversations = new Map<string, ChatwootConversation>();

  async createConversation(input: ChatwootCreateConversationInput) {
    const conversation: ChatwootConversation = {
      conversationId: `mock-chatwoot-${input.sessionId}`,
      status: "open",
      url: `chatwoot://mock/conversations/${encodeURIComponent(input.sessionId)}`
    };

    this.conversations.set(conversation.conversationId, conversation);
    return conversation;
  }

  async appendMessage(input: ChatwootAppendMessageInput) {
    this.ensureConversation(input.conversationId);
    return {
      messageId: `mock-chatwoot-message-${Date.now()}`
    };
  }

  async getConversation(conversationId: string) {
    return this.ensureConversation(conversationId);
  }

  private ensureConversation(conversationId: string) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return {
        conversationId,
        status: "unknown" as const
      };
    }

    return conversation;
  }
}

export class ChatwootApiProvider implements ChatwootProvider {
  constructor(private readonly config: ChatwootApiConfig = chatwootConfigFromEnv()) {}

  async createConversation(_input: ChatwootCreateConversationInput): Promise<ChatwootConversation> {
    this.assertConfigured();
    throw new Error("Chatwoot conversation creation is not implemented yet. The adapter boundary is ready for API wiring.");
  }

  async appendMessage(_input: ChatwootAppendMessageInput): Promise<{ messageId?: string }> {
    this.assertConfigured();
    throw new Error("Chatwoot message append is not implemented yet. The adapter boundary is ready for API wiring.");
  }

  async getConversation(_conversationId: string): Promise<ChatwootConversation> {
    this.assertConfigured();
    throw new Error("Chatwoot conversation lookup is not implemented yet. The adapter boundary is ready for API wiring.");
  }

  private assertConfigured() {
    if (!this.config.baseUrl || !this.config.accountId || !this.config.inboxId || !this.config.apiToken) {
      throw new Error("Missing Chatwoot configuration. Set CHATWOOT_BASE_URL, CHATWOOT_ACCOUNT_ID, CHATWOOT_INBOX_ID, and CHATWOOT_API_TOKEN.");
    }
  }
}

export function chatwootConfigFromEnv(): ChatwootApiConfig {
  return {
    baseUrl: process.env.CHATWOOT_BASE_URL,
    accountId: process.env.CHATWOOT_ACCOUNT_ID,
    inboxId: process.env.CHATWOOT_INBOX_ID,
    apiToken: process.env.CHATWOOT_API_TOKEN
  };
}

export function hasChatwootCredentials(config: ChatwootApiConfig = chatwootConfigFromEnv()) {
  return Boolean(config.baseUrl && config.accountId && config.inboxId && config.apiToken);
}
