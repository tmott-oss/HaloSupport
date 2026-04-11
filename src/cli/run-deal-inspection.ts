import { inspectDeal } from "../inspection/deal-inspection.js";
import type { DealInspectionInput, HalosightSalesStage } from "../domain/types.js";

async function main() {
  const input: DealInspectionInput = {
    opportunityName: process.env.OPPORTUNITY_NAME ?? "Halosight Internal Planning",
    accountName: process.env.ACCOUNT_NAME ?? "Halosight",
    owner: process.env.OPPORTUNITY_OWNER ?? "Troy Mott",
    currentStage: (process.env.CURRENT_STAGE as HalosightSalesStage) ?? "determine_problem_impact",
    forecastCategory: (process.env.FORECAST_CATEGORY as DealInspectionInput["forecastCategory"]) ?? "Pipeline",
    closeDate: process.env.CLOSE_DATE ?? "2026-06-30",
    notes:
      process.env.DEAL_NOTES ??
      [
        "Business challenge is defined around gaps in how meeting notes make it into CRM.",
        "Leadership wants better visibility into account progress and execution consistency.",
        "Decision process is not fully mapped yet, but there is a clear workflow review next week.",
        "Timeline is this quarter and the team is aligning around a Phase 1 workflow review."
      ].join(" "),
    lastMeaningfulCustomerInteractionDate:
      process.env.LAST_MEANINGFUL_CUSTOMER_INTERACTION_DATE ?? new Date().toISOString().slice(0, 10),
    nextStepDescription:
      process.env.NEXT_STEP_DESCRIPTION ?? "Run a workflow review to map interaction capture into the current process.",
    nextStepDate: process.env.NEXT_STEP_DATE ?? new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  };

  const result = inspectDeal(input);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
