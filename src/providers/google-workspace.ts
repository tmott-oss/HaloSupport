import type { AppConfig } from "../config.js";
import type { GoogleWorkspaceProvider } from "./interfaces.js";

interface GoogleTokenResponse {
  access_token: string;
}

interface GoogleCalendarEventResponse {
  id: string;
  summary?: string;
  description?: string;
  attendees?: Array<{ email?: string }>;
  start?: {
    dateTime?: string;
    date?: string;
  };
}

interface GoogleCalendarListResponse {
  items?: GoogleCalendarEventResponse[];
}

interface GoogleDocumentResponse {
  documentId: string;
  title: string;
}

interface GmailDraftResponse {
  id: string;
  message?: {
    id?: string;
  };
}

export class GoogleWorkspaceApiProvider implements GoogleWorkspaceProvider {
  constructor(private readonly config: AppConfig) {}

  async getUpcomingMeeting(meetingId: string) {
    const event = await this.googleRequest<GoogleCalendarEventResponse>(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        this.config.googleCalendarId
      )}/events/${encodeURIComponent(meetingId)}`
    );

    return {
      meetingId: event.id,
      title: event.summary ?? "Untitled meeting",
      startsAt: event.start?.dateTime ?? event.start?.date ?? new Date().toISOString(),
      attendees: (event.attendees ?? []).flatMap((attendee) => (attendee.email ? [attendee.email] : [])),
      notes: event.description
    };
  }

  async findMeeting(criteria: { title?: string; startsAt?: string }) {
    const targetDate = criteria.startsAt ? new Date(criteria.startsAt) : new Date();
    const timeMin = new Date(targetDate.getTime() - 60 * 60 * 1000).toISOString();
    const timeMax = new Date(targetDate.getTime() + 60 * 60 * 1000).toISOString();
    const query = new URLSearchParams({
      singleEvents: "true",
      orderBy: "startTime",
      timeMin,
      timeMax
    });

    if (criteria.title) {
      query.set("q", criteria.title);
    }

    const response = await this.googleRequest<GoogleCalendarListResponse>(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        this.config.googleCalendarId
      )}/events?${query.toString()}`
    );

    const event = response.items?.[0];
    if (!event) {
      throw new Error(
        `No Google Calendar event found for title "${criteria.title ?? "unknown"}" near ${
          criteria.startsAt ?? "the requested time"
        }.`
      );
    }

    return {
      meetingId: event.id,
      title: event.summary ?? criteria.title ?? "Untitled meeting",
      startsAt: event.start?.dateTime ?? event.start?.date ?? targetDate.toISOString(),
      attendees: (event.attendees ?? []).flatMap((attendee) => (attendee.email ? [attendee.email] : [])),
      notes: event.description
    };
  }

  async createDraftDoc(title: string, markdown: string) {
    const created = await this.googleRequest<GoogleDocumentResponse>("https://docs.googleapis.com/v1/documents", {
      method: "POST",
      body: JSON.stringify({ title })
    });

    await this.googleRequest(
      `https://docs.googleapis.com/v1/documents/${created.documentId}:batchUpdate`,
      {
        method: "POST",
        body: JSON.stringify({
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: markdown
              }
            }
          ]
        })
      }
    );

    if (this.config.googleDocsFolderId) {
      await this.googleRequest(
        `https://www.googleapis.com/drive/v3/files/${created.documentId}?addParents=${encodeURIComponent(
          this.config.googleDocsFolderId
        )}`,
        {
          method: "PATCH"
        }
      );
    }

    return { url: `https://docs.google.com/document/d/${created.documentId}/edit` };
  }

  async createGmailDraft(subject: string, body: string, recipients: string[]) {
    const rawMessage = toBase64Url(
      [
        `To: ${recipients.join(", ")}`,
        `Subject: ${subject}`,
        "Content-Type: text/plain; charset=utf-8",
        "",
        body
      ].join("\r\n")
    );

    const draft = await this.googleRequest<GmailDraftResponse>(
      "https://gmail.googleapis.com/gmail/v1/users/me/drafts",
      {
        method: "POST",
        body: JSON.stringify({
          message: {
            raw: rawMessage
          }
        })
      }
    );

    return {
      url: `https://mail.google.com/mail/u/0/#drafts?compose=${encodeURIComponent(draft.id)}`
    };
  }

  private async googleRequest<T = unknown>(url: string, init: RequestInit = {}) {
    const accessToken = await this.getAccessToken();
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {})
      }
    });

    if (!response.ok) {
      throw new Error(`Google Workspace API request failed: ${response.status} ${await response.text()}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  private async getAccessToken() {
    const clientId = process.env.GOOGLE_WORKSPACE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_WORKSPACE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_WORKSPACE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error("Missing Google Workspace OAuth environment variables.");
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token"
      })
    });

    if (!response.ok) {
      throw new Error(`Google OAuth token refresh failed: ${response.status} ${await response.text()}`);
    }

    const token = (await response.json()) as GoogleTokenResponse;
    return token.access_token;
  }
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}
