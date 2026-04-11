import { assembleAgentPrompt, loadHalosightPromptPackage } from "../runtime/halosight.js";
import { tryValidateAgentOutput } from "../runtime/schema-validation.js";

async function main() {
  const agentName = (process.argv[2] ??
    "icp_sentinel") as Parameters<typeof assembleAgentPrompt>[1];

  const promptPackage = await loadHalosightPromptPackage();
  const assembly = assembleAgentPrompt(promptPackage, agentName);

  console.log("=== PROMPT ASSEMBLY ===");
  console.log(assembly.assembledPrompt.slice(0, 3000));
  console.log("\n=== SCHEMA VALIDATION SAMPLE ===");

  const exampleKeyByAgent: Partial<Record<typeof agentName, string>> = {
    icp_sentinel: "icp_sentinel_output",
    deal_progression_analyst: "deal_progression_output"
  };

  const exampleKey = exampleKeyByAgent[agentName];
  if (!exampleKey) {
    console.log(
      JSON.stringify(
        {
          agentName,
          valid: null,
          issues: [],
          note: "No bundled example payload is available for this agent yet."
        },
        null,
        2
      )
    );
    return;
  }

  const validation = tryValidateAgentOutput(agentName, (promptPackage.examplePayloads as Record<string, unknown>)[exampleKey]);
  console.log(JSON.stringify({ agentName, valid: validation.success, issues: validation.success ? [] : validation.error.issues }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
