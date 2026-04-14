import type { ChatMessageResponse, ChatSession, SupportChatContext } from "./types";

export interface SupportApiClientOptions {
  baseUrl?: string;
}

export class SupportApiClient {
  constructor(private readonly options: SupportApiClientOptions = {}) {}

  async startSession(context: SupportChatContext): Promise<ChatSession> {
    const response = await this.post<{ session: ChatSession }>("/chat/session", context);
    return response.session;
  }

  async sendMessage(params: {
    sessionId: string;
    message: string;
    context: SupportChatContext;
  }): Promise<ChatMessageResponse> {
    return this.post<ChatMessageResponse>("/chat/message", params);
  }

  private async post<T>(path: string, payload: unknown): Promise<T> {
    const response = await fetch(`${this.options.baseUrl ?? ""}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Support API request failed: ${response.status}`);
    }

    return (await response.json()) as T;
  }
}
