import { randomUUID } from "node:crypto";

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

interface ChatwootContactResponse {
  payload?: unknown;
  id?: unknown;
  contact_inboxes?: unknown;
}

interface ChatwootConversationResponse {
  id?: unknown;
  status?: unknown;
}

interface ChatwootMessageResponse {
  id?: unknown;
}

interface ParsedChatwootContact {
  id: number;
  sourceId: string;
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

  async createConversation(input: ChatwootCreateConversationInput): Promise<ChatwootConversation> {
    this.assertConfigured();

    const contact = await this.createContact(input);
    const conversation = await this.request<ChatwootConversationResponse>(
      `/api/v1/accounts/${this.accountId}/conversations`,
      {
        method: "POST",
        body: {
          source_id: contact.sourceId,
          inbox_id: this.inboxId,
          contact_id: contact.id,
          status: "open",
          custom_attributes: {
            halosight_session_id: input.sessionId,
            halosight_source: input.source,
            escalation_reason: input.escalationReason,
            subject: input.subject,
            ...input.customAttributes
          }
        }
      }
    );
    const conversationId = this.readNumber(conversation.id, "Chatwoot conversation id");

    await this.appendMessage({
      conversationId: String(conversationId),
      messageType: "private_note",
      content: this.buildEscalationNote(input)
    });

    return {
      conversationId: String(conversationId),
      status: this.normalizeStatus(conversation.status),
      url: `${this.baseUrl}/app/accounts/${this.accountId}/conversations/${conversationId}`
    };
  }

  async appendMessage(input: ChatwootAppendMessageInput): Promise<{ messageId?: string }> {
    this.assertConfigured();
    const message = await this.request<ChatwootMessageResponse>(
      `/api/v1/accounts/${this.accountId}/conversations/${encodeURIComponent(input.conversationId)}/messages`,
      {
        method: "POST",
        body: {
          content: input.content,
          message_type: input.messageType === "incoming" ? "incoming" : "outgoing",
          private: input.messageType === "private_note",
          content_type: "text"
        }
      }
    );

    return {
      messageId: typeof message.id === "number" || typeof message.id === "string" ? String(message.id) : undefined
    };
  }

  async getConversation(conversationId: string): Promise<ChatwootConversation> {
    this.assertConfigured();
    const conversation = await this.request<ChatwootConversationResponse>(
      `/api/v1/accounts/${this.accountId}/conversations/${encodeURIComponent(conversationId)}`
    );

    return {
      conversationId,
      status: this.normalizeStatus(conversation.status),
      url: `${this.baseUrl}/app/accounts/${this.accountId}/conversations/${encodeURIComponent(conversationId)}`
    };
  }

  private assertConfigured() {
    if (!this.config.baseUrl || !this.config.accountId || !this.config.inboxId || !this.config.apiToken) {
      throw new Error("Missing Chatwoot configuration. Set CHATWOOT_BASE_URL, CHATWOOT_ACCOUNT_ID, CHATWOOT_INBOX_ID, and CHATWOOT_API_TOKEN.");
    }
  }

  private async createContact(input: ChatwootCreateConversationInput): Promise<ParsedChatwootContact> {
    const contact = await this.request<ChatwootContactResponse>(
      `/api/v1/accounts/${this.accountId}/contacts`,
      {
        method: "POST",
        body: {
          inbox_id: this.inboxId,
          identifier: input.contact?.identifier,
          name: input.contact?.name ?? `Halosight Support Visitor ${input.sessionId.slice(0, 8)}`,
          email: input.contact?.email,
          phone_number: input.contact?.phoneNumber,
          custom_attributes: {
            halosight_session_id: input.sessionId,
            halosight_source: input.source,
            ...input.contact?.customAttributes
          }
        }
      }
    );

    return this.parseContact(contact, input.sessionId);
  }

  private parseContact(response: ChatwootContactResponse, sessionId: string): ParsedChatwootContact {
    const contact = this.unwrapContactResponse(response);
    if (!contact || typeof contact !== "object") {
      throw new Error("Chatwoot contact response did not include a contact.");
    }

    const contactRecord = contact as { id?: unknown; contact_inboxes?: unknown };
    const id = this.readNumber(contactRecord.id, "Chatwoot contact id");
    const sourceId = this.readSourceId(contactRecord.contact_inboxes) ?? `halosight-session-${sessionId}-${randomUUID()}`;

    return {
      id,
      sourceId
    };
  }

  private unwrapContactResponse(response: ChatwootContactResponse): unknown {
    if (Array.isArray(response.payload)) {
      return response.payload[0];
    }

    if (response.payload && typeof response.payload === "object") {
      const payload = response.payload as {
        contact?: unknown;
        id?: unknown;
        contact_inboxes?: unknown;
      };

      if (payload.contact) {
        return payload.contact;
      }

      if (payload.id || payload.contact_inboxes) {
        return payload;
      }
    }

    return response;
  }

  private readSourceId(contactInboxes: unknown) {
    if (!Array.isArray(contactInboxes)) {
      return undefined;
    }

    const firstInbox = contactInboxes.find((item) => item && typeof item === "object") as { source_id?: unknown } | undefined;
    return typeof firstInbox?.source_id === "string" ? firstInbox.source_id : undefined;
  }

  private buildEscalationNote(input: ChatwootCreateConversationInput) {
    const transcript = input.transcript
      .map((message) => {
        const timestamp = message.createdAt ? ` (${message.createdAt})` : "";
        return `[${message.role}${timestamp}]\n${message.content}`;
      })
      .join("\n\n");

    return [
      `Halosight escalation${input.subject ? `: ${input.subject}` : ""}`,
      "",
      `Reason: ${input.escalationReason}`,
      "",
      "Transcript:",
      transcript || "No transcript was provided.",
      "",
      "Context:",
      JSON.stringify(
        {
          sessionId: input.sessionId,
          source: input.source,
          customAttributes: input.customAttributes
        },
        null,
        2
      )
    ].join("\n");
  }

  private async request<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        api_access_token: this.apiToken
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Chatwoot API failed: ${response.status} ${text.slice(0, 300)}`);
    }

    const body = text ? JSON.parse(text) as T : ({} as T);
    return body;
  }

  private readNumber(value: unknown, label: string) {
    if (typeof value === "number") {
      return value;
    }

    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }

    throw new Error(`${label} was missing from API response.`);
  }

  private normalizeStatus(value: unknown): ChatwootConversation["status"] {
    if (value === "open" || value === "pending" || value === "resolved") {
      return value;
    }

    return "open";
  }

  private get baseUrl() {
    return this.config.baseUrl!.replace(/\/$/, "");
  }

  private get accountId() {
    return encodeURIComponent(this.config.accountId!);
  }

  private get inboxId() {
    return Number(this.config.inboxId);
  }

  private get apiToken() {
    return this.config.apiToken!;
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
