# Website Team Handoff

## Purpose

This handoff is for adding the Halosight AI Support Agent to a controlled Halosight.com support page.

The recommended first website test is a hosted link or iframe, not a full script widget. This keeps the first public test simple, reversible, and easy to validate.

## Current Support Chat URL

```text
https://halosight-support-mvp.onrender.com/chat-client
```

## Recommended First Route

Create a controlled support page:

```text
https://www.halosight.com/support
```

This page can host the iframe or link while the team validates the support flow.

## Option A: Link

Use this if the team wants the lowest-risk first launch.

```html
<a href="https://halosight-support-mvp.onrender.com/chat-client" target="_blank" rel="noopener">
  Contact support
</a>
```

Expected behavior:

- visitor clicks the link
- support chat opens in a separate tab
- the support flow runs on the hosted Render service

## Option B: Iframe

Use this if the team wants the visitor to stay on Halosight.com during the first test.

```html
<iframe
  src="https://halosight-support-mvp.onrender.com/chat-client"
  title="Halosight support"
  style="width: 100%; min-height: 720px; border: 0;"
  loading="lazy"
></iframe>
```

Suggested page copy near the iframe:

```text
Need help? Ask a question below. If the answer requires human confirmation, our team will follow up through support.
```

## Required Backend Environment

The support backend must include the website origin in:

```text
SUPPORT_ALLOWED_ORIGINS
```

Current recommended value:

```text
https://halosight.com,https://www.halosight.com,https://halosight-support-mvp.onrender.com
```

If the website uses another staging or preview domain, add it before testing.

## Do Not Expose Secrets

Never add these values to Halosight.com front-end code:

- `SLACK_WEBHOOK_URL`
- `CHATWOOT_API_TOKEN`
- `CHATWOOT_WEBHOOK_TOKEN`
- `DATABASE_URL`
- `SUPPORT_OPS_USERNAME`
- `SUPPORT_OPS_PASSWORD`

The website should only point to the hosted support chat URL. The support backend owns all Slack, Chatwoot, and database credentials.

## Test Checklist

After the page is added, run this checklist.

1. Open the Halosight.com support page.
2. Confirm the link or iframe loads.
3. Send:

```text
What does Halosight do?
```

Expected:

- the chat returns a grounded answer
- no escalation is triggered
- the message box clears after send

4. Send:

```text
Can we tell a customer Halosight is SOC 2 certified and guarantees ROI?
```

Expected:

- the chat escalates
- Slack receives an escalation alert
- Chatwoot receives a conversation
- a ticket appears in `/tickets-view`

5. Reply from Chatwoot with a normal public message.

Expected:

- the reply appears back in the website chat as `Support`

6. Open:

```text
https://halosight-support-mvp.onrender.com/tickets-view
```

Expected:

- ticket is visible
- transcript is visible
- `Open in Chatwoot` link works

## Rollback

If anything behaves unexpectedly:

1. Remove the link or iframe from Halosight.com.
2. Leave the Render support service running for investigation.
3. Check Slack and Chatwoot for the last escalation event.
4. Check `/tickets-view` for the session transcript.
5. Check `/debug/config` to confirm backend configuration.

Rollback does not require deleting data from Postgres or Chatwoot.

## Current Limitations

- The current test uses the Render staging URL, not a branded support subdomain.
- The current website integration is a link or iframe, not a polished floating widget.
- Public-site knowledge should be reviewed before broad external launch.
- Monitoring and alerting should be strengthened before production traffic.
- Postgres backups, retention, and migration policy should be finalized.

## Next Step After Website Test

If the support page test is approved, the next engineering step is to package the chat client as a stable widget or move the hosted support experience to a branded subdomain such as:

```text
https://support.halosight.com
```
