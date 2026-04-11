import { z } from "zod";

export const DraftModeSchema = z.object({
  allowInternalBriefs: z.boolean().default(true),
  allowGmailDrafts: z.boolean().default(true),
  allowSlackApprovalPosts: z.boolean().default(true),
  allowSalesforceWrites: z.boolean().default(false),
  allowApolloEnrollment: z.boolean().default(false),
  allowGmailSend: z.boolean().default(false)
});

export const AppConfigSchema = z.object({
  environment: z.enum(["local", "staging", "production"]).default("local"),
  draftMode: DraftModeSchema,
  slackApprovalChannel: z.string().default("#sales-ai-approvals"),
  slackApprovalChannelId: z.string().optional(),
  googleDocsFolderName: z.string().default("AI Drafts"),
  googleDocsFolderId: z.string().optional(),
  googleCalendarId: z.string().default("primary"),
  reviewSheetName: z.string().default("AI Agent Review Log")
});

export type DraftModeConfig = z.infer<typeof DraftModeSchema>;
export type AppConfig = z.infer<typeof AppConfigSchema>;

export const defaultConfig: AppConfig = AppConfigSchema.parse({
  environment: "local",
  draftMode: {
    allowInternalBriefs: true,
    allowGmailDrafts: true,
    allowSlackApprovalPosts: true,
    allowSalesforceWrites: false,
    allowApolloEnrollment: false,
    allowGmailSend: false
  },
  slackApprovalChannel: "#sales-ai-approvals",
  slackApprovalChannelId: process.env.SLACK_APPROVAL_CHANNEL_ID,
  googleDocsFolderName: "AI Drafts",
  googleDocsFolderId: process.env.GOOGLE_DOCS_FOLDER_ID,
  googleCalendarId: process.env.GOOGLE_CALENDAR_ID ?? "primary",
  reviewSheetName: "AI Agent Review Log"
});
