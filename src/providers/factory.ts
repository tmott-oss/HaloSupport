import { defaultConfig, type AppConfig } from "../config.js";
import type { ApolloProvider, SalesforceProvider } from "./interfaces.js";
import { MockGoogleWorkspaceProvider, MockSlackProvider } from "./mock.js";
import { GoogleWorkspaceApiProvider } from "./google-workspace.js";
import { LocalRevenueContextProvider } from "./local-revenue-context.js";
import { SlackApiProvider } from "./slack.js";

function hasGoogleWorkspaceCredentials() {
  return Boolean(
    process.env.GOOGLE_WORKSPACE_CLIENT_ID &&
      process.env.GOOGLE_WORKSPACE_CLIENT_SECRET &&
      process.env.GOOGLE_WORKSPACE_REFRESH_TOKEN
  );
}

function hasSlackCredentials(config: AppConfig) {
  return Boolean(process.env.SLACK_BOT_TOKEN && config.slackApprovalChannelId);
}

export function createProviderSet(config: AppConfig = defaultConfig) {
  const google = hasGoogleWorkspaceCredentials()
    ? new GoogleWorkspaceApiProvider(config)
    : new MockGoogleWorkspaceProvider();
  const slack = hasSlackCredentials(config) ? new SlackApiProvider(config) : new MockSlackProvider();
  const localRevenueContext = new LocalRevenueContextProvider();
  const salesforce: SalesforceProvider = localRevenueContext;
  const apollo: ApolloProvider = localRevenueContext;

  return {
    google,
    slack,
    salesforce,
    apollo,
    revenueContext: localRevenueContext
  };
}
