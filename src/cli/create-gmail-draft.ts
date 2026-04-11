import { defaultConfig } from "../config.js";
import { createProviderSet } from "../providers/factory.js";

async function main() {
  const providers = createProviderSet(defaultConfig);
  const recipients = (process.env.GMAIL_DRAFT_TO ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  const subject = process.env.GMAIL_DRAFT_SUBJECT ?? "Halosight draft follow-up";
  const body =
    process.env.GMAIL_DRAFT_BODY ??
    [
      "Thanks again for the conversation today.",
      "",
      "I wanted to follow up with a short summary and next step recommendation.",
      "",
      "- We discussed the challenge of capturing customer interactions in a usable CRM workflow.",
      "- We aligned on the impact this has on visibility and execution consistency.",
      "- A reasonable next step would be to map this to your current Salesforce process.",
      "",
      "Best,",
      "Troy"
    ].join("\n");

  if (!providers.google.createGmailDraft) {
    throw new Error("This provider does not support Gmail draft creation.");
  }

  if (recipients.length === 0) {
    throw new Error("Set GMAIL_DRAFT_TO to one or more recipient email addresses.");
  }

  const result = await providers.google.createGmailDraft(subject, body, recipients);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
