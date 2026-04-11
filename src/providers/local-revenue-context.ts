import { readFile } from "node:fs/promises";
import path from "node:path";

import type { ApolloProvider, SalesforceProvider } from "./interfaces.js";
import type { AccountContext, ApprovalRequest, ContactContext } from "../domain/types.js";

interface MatchCriteria {
  email_domains?: string[];
  contact_emails?: string[];
  meeting_title_keywords?: string[];
}

interface ManualAccountContextRecord {
  match: MatchCriteria;
  account: AccountContext;
  primaryContact?: ContactContext;
  recentActivity: string[];
  apolloSignals: string[];
  messagingAngles: string[];
}

interface ManualAccountContextFile {
  accounts: ManualAccountContextRecord[];
}

export class LocalRevenueContextProvider implements SalesforceProvider, ApolloProvider {
  private cache?: ManualAccountContextFile;
  private activeRecord?: ManualAccountContextRecord;

  async setActiveMeetingContext(params: { attendees: string[]; title?: string }) {
    const data = await this.loadData();
    const record = data.accounts.find((item) => matchesRecord(item.match, params));
    this.activeRecord = record ?? data.accounts[0];
  }

  async getAccountByMeetingAttendees(attendees: string[]) {
    const record = await this.ensureRecord({ attendees });
    return record.account;
  }

  async getPrimaryContact(accountId: string) {
    const record = await this.ensureRecord({});
    if (record.account.accountId !== accountId) {
      return undefined;
    }

    return record.primaryContact;
  }

  async getRecentActivity(accountId: string) {
    const record = await this.ensureRecord({});
    return record.account.accountId === accountId ? record.recentActivity : [];
  }

  async queueProposedUpdate(approval: ApprovalRequest) {
    return { url: `local-review://${encodeURIComponent(approval.action)}` };
  }

  async getBuyingSignals(accountName: string) {
    const record = await this.ensureRecord({});
    return matchesAccountName(record.account.accountName, accountName) ? record.apolloSignals : [];
  }

  async getMessagingAngles(accountName: string) {
    const record = await this.ensureRecord({});
    return matchesAccountName(record.account.accountName, accountName) ? record.messagingAngles : [];
  }

  private async ensureRecord(params: { attendees?: string[]; title?: string }) {
    if (this.activeRecord) {
      return this.activeRecord;
    }

    const data = await this.loadData();
    const record =
      data.accounts.find((item) => matchesRecord(item.match, { attendees: params.attendees ?? [], title: params.title })) ??
      data.accounts[0];
    this.activeRecord = record;
    return record;
  }

  private async loadData() {
    if (this.cache) {
      return this.cache;
    }

    const filePath = path.join(process.cwd(), "data", "halosight", "manual-account-contexts.json");
    const content = await readFile(filePath, "utf8");
    this.cache = JSON.parse(content) as ManualAccountContextFile;
    return this.cache;
  }
}

function matchesRecord(match: MatchCriteria, params: { attendees: string[]; title?: string }) {
  const normalizedAttendees = params.attendees.map((value) => value.toLowerCase());
  const domains = normalizedAttendees
    .map((value) => value.split("@")[1])
    .filter((value): value is string => Boolean(value));
  const title = (params.title ?? "").toLowerCase();

  const emailDomainMatch =
    !match.email_domains || match.email_domains.some((domain) => domains.includes(domain.toLowerCase()));
  const contactEmailMatch =
    !match.contact_emails ||
    match.contact_emails.some((email) => normalizedAttendees.includes(email.toLowerCase()));
  const titleMatch =
    !match.meeting_title_keywords ||
    match.meeting_title_keywords.some((keyword) => title.includes(keyword.toLowerCase()));

  return emailDomainMatch && contactEmailMatch && titleMatch;
}

function matchesAccountName(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}
