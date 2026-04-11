import { defaultConfig } from "../config.js";
import type { CallSummaryInput } from "../domain/types.js";
import { runCallSummary } from "../agents/call-summary.js";
import { createProviderSet } from "../providers/factory.js";

async function main() {
  const providers = createProviderSet(defaultConfig);
  const meeting = providers.google.findMeeting
    ? await providers.google.findMeeting({
        title: process.env.MEETING_TITLE ?? "INTERNAL | Demand Gen Planning",
        startsAt: process.env.MEETING_STARTS_AT ?? new Date().toISOString()
      })
    : await providers.google.getUpcomingMeeting(process.argv[2] ?? "meeting-demo-001");
  await providers.revenueContext.setActiveMeetingContext({
    attendees: meeting.attendees,
    title: meeting.title
  });
  const account = await providers.salesforce.getAccountByMeetingAttendees(meeting.attendees);
  const primaryContact = await providers.salesforce.getPrimaryContact(account.accountId);

  const input: CallSummaryInput = {
    account,
    primaryContact,
    meeting,
    rawNotes:
      process.env.CALL_NOTES ??
      [
        "The team discussed gaps in how meeting notes make it into CRM.",
        "Leadership wants better visibility into account progress and execution consistency.",
        "A likely next step is a workflow review tied to Salesforce and current operating process."
      ].join("\n")
  };

  const result = await runCallSummary(input, {
    config: defaultConfig,
    google: providers.google,
    slack: providers.slack
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
