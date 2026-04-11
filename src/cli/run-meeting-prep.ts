import { defaultConfig } from "../config.js";
import { runMeetingPrep } from "../agents/meeting-prep.js";
import { createProviderSet } from "../providers/factory.js";

async function main() {
  const meetingId = process.argv[2];
  const title = process.env.MEETING_TITLE;
  const startsAt = process.env.MEETING_STARTS_AT;
  const providers = createProviderSet(defaultConfig);
  const meetingRef =
    title || startsAt ? { title: title || undefined, startsAt: startsAt || undefined } : meetingId ?? "meeting-demo-001";
  const meetingPreview =
    typeof meetingRef === "string"
      ? await providers.google.getUpcomingMeeting(meetingRef)
      : await providers.google.findMeeting(meetingRef);

  await providers.revenueContext.setActiveMeetingContext({
    attendees: meetingPreview.attendees,
    title: meetingPreview.title
  });

  const result = await runMeetingPrep(meetingRef, {
    config: defaultConfig,
    google: providers.google,
    salesforce: providers.salesforce,
    apollo: providers.apollo,
    slack: providers.slack
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
