import { readFile } from "node:fs/promises";
import path from "node:path";

import type {
  HalosightAgentName,
  HalosightCompetitiveName,
  HalosightContextPack,
  HalosightPersonaName,
  HalosightPromptPackage,
  HalosightSalesProcessPack,
  HalosightStageName,
  PromptAssembly
} from "../domain/halosight.js";
import type { ContactContext, MeetingContext } from "../domain/types.js";

const agentPromptFiles: Record<HalosightAgentName, string> = {
  icp_sentinel: "agent_icp_sentinel.md",
  outreach_strategist: "agent_outreach_strategist.md",
  discovery_qualifier: "agent_discovery_qualifier.md",
  objection_navigator: "agent_objection_navigator.md",
  deal_progression_analyst: "agent_deal_progression_analyst.md",
  crm_structurer: "agent_crm_structurer.md"
};

const personaFiles: Record<HalosightPersonaName, string> = {
  cro: "cro.md",
  vp_sales: "vp_sales.md",
  revops: "revops.md",
  salesforce_admin: "salesforce_admin.md",
  it: "it.md",
  reps: "reps.md",
  managers: "managers.md"
};

const competitiveFiles: Record<HalosightCompetitiveName, string> = {
  gong: "gong.md",
  chorus: "chorus.md",
  clari: "clari.md",
  salesforce_native: "salesforce_native.md",
  status_quo: "status_quo.md"
};

const stageFiles: Record<HalosightStageName, string> = {
  awareness: "awareness.md",
  problem_defined: "problem_defined.md",
  business_case: "business_case.md",
  solution_fit: "solution_fit.md",
  decision: "decision.md"
};

const globalContextFiles = [
  "company_truth.md",
  "product_truth.md",
  "truth_boundaries.md",
  "proof_library.md",
  "sales_process_definitions.md",
  "qualification_rules.md"
] as const;

const accountTemplateFiles = [
  "account_context.md",
  "stakeholder_map.md",
  "discovery_gaps.md",
  "next_step_strategy.md"
] as const;

function projectRoot() {
  return process.cwd();
}

function halosightPath(...parts: string[]) {
  return path.join(projectRoot(), ...parts);
}

async function readTextFile(filePath: string) {
  return readFile(filePath, "utf8");
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await readTextFile(filePath);
  return JSON.parse(content) as T;
}

export async function loadHalosightPromptPackage(): Promise<HalosightPromptPackage> {
  const masterContextPath = halosightPath("data", "halosight", "halosight_master_context.md");
  const guardrailsPath = halosightPath("data", "halosight", "compliance_guardrails.md");
  const globalInstructionsPath = halosightPath("prompts", "halosight", "global_master_instructions.md");
  const schemasPath = halosightPath("data", "halosight", "schemas.json");
  const fieldMapPath = halosightPath("data", "halosight", "salesforce_field_map.json");
  const examplesPath = halosightPath("data", "halosight", "example_payloads.json");

  const [masterContext, complianceGuardrails, globalInstructions, schemas, salesforceFieldMap, examplePayloads, contextPack, salesProcessPack] =
    await Promise.all([
      readTextFile(masterContextPath),
      readTextFile(guardrailsPath),
      readTextFile(globalInstructionsPath),
      readJsonFile<Record<HalosightAgentName, { input: unknown; output: unknown }>>(schemasPath),
      readJsonFile(fieldMapPath),
      readJsonFile(examplesPath),
      loadHalosightContextPack(),
      loadHalosightSalesProcessPack()
    ]);

  const promptEntries = await Promise.all(
    Object.entries(agentPromptFiles).map(async ([agentName, fileName]) => {
      const prompt = await readTextFile(halosightPath("prompts", "halosight", fileName));
      return [agentName, prompt] as const;
    })
  );

  return {
    masterContext,
    complianceGuardrails,
    globalInstructions,
    prompts: Object.fromEntries(promptEntries) as Record<HalosightAgentName, string>,
    schemas,
    salesforceFieldMap,
    examplePayloads,
    contextPack,
    salesProcessPack
  };
}

export function assembleAgentPrompt(
  promptPackage: HalosightPromptPackage,
  agentName: HalosightAgentName
): PromptAssembly {
  const schemaContract = promptPackage.schemas[agentName];
  const supplementalContext = buildSupplementalContext(promptPackage, agentName);

  return {
    masterContext: promptPackage.masterContext,
    guardrails: promptPackage.complianceGuardrails,
    globalInstructions: promptPackage.globalInstructions,
    agentPrompt: promptPackage.prompts[agentName],
    schemaContract,
    supplementalContext,
    assembledPrompt: [
      promptPackage.masterContext.trim(),
      supplementalContext.trim(),
      promptPackage.complianceGuardrails.trim(),
      promptPackage.globalInstructions.trim(),
      promptPackage.prompts[agentName].trim(),
      "Required schema contract:",
      JSON.stringify(schemaContract, null, 2)
    ]
      .filter(Boolean)
      .join("\n\n")
  };
}

export function extractCompanyContextSummary(promptPackage: HalosightPromptPackage): string[] {
  const companyTruth = promptPackage.contextPack.global.company_truth ?? "";
  const productTruth = promptPackage.contextPack.global.product_truth ?? "";

  return [
    "Halosight is the missing data layer between customer interactions and CRM.",
    "Lead with the business problem: missing interaction capture creates weak forecasting, coaching, and account visibility.",
    "Position Halosight around capture, structure, visibility, execution, and revenue intelligence.",
    "Do not frame Halosight as a CRM replacement, surveillance tool, or guaranteed revenue engine.",
    companyTruth.includes("field sales") ? "Field and outside-sales use cases are a strong fit pattern for Halosight." : "",
    productTruth.includes("Phase 1") ? "Use Phase 1 / Phase 2 / Phase 3 implementation framing instead of pilot language." : ""
  ].filter(Boolean);
}

export function inferPersonaName(primaryContact?: ContactContext, meeting?: MeetingContext): HalosightPersonaName {
  const title = `${primaryContact?.title ?? ""} ${meeting?.title ?? ""}`.toLowerCase();

  if (title.includes("cro")) return "cro";
  if (title.includes("vp sales") || title.includes("sales leader") || title.includes("sales")) return "vp_sales";
  if (title.includes("revops") || title.includes("revenue operations")) return "revops";
  if (title.includes("salesforce")) return "salesforce_admin";
  if (title.includes("it") || title.includes("security")) return "it";
  if (title.includes("manager")) return "managers";
  return "reps";
}

export function inferStageName(params: {
  notes?: string;
  opportunityStage?: string;
  meetingTitle?: string;
}): HalosightStageName {
  const combined = `${params.notes ?? ""} ${params.opportunityStage ?? ""} ${params.meetingTitle ?? ""}`.toLowerCase();

  if (
    includesAny(combined, [
      "negotiating",
      "mutual plan",
      "finalizing closure",
      "pending closed",
      "contract",
      "procurement",
      "legal",
      "signature",
      "order form"
    ])
  ) {
    return "decision";
  }

  if (
    includesAny(combined, [
      "confirm value with power",
      "economic buyer",
      "power",
      "preferred direction",
      "why buy story",
      "selection"
    ])
  ) {
    return "solution_fit";
  }

  if (
    includesAny(combined, [
      "validate benefits",
      "business value",
      "roi",
      "value case",
      "political influence",
      "implementation scope",
      "pricing proposal"
    ])
  ) {
    return "business_case";
  }

  if (
    includesAny(combined, [
      "determine problem",
      "impact",
      "decision criteria",
      "decision process",
      "budget",
      "problem",
      "gap",
      "discovery"
    ])
  ) {
    return "problem_defined";
  }

  return "awareness";
}

export function extractPersonaContextSummary(
  promptPackage: HalosightPromptPackage,
  personaName: HalosightPersonaName
): string[] {
  const personaDoc = promptPackage.contextPack.personas[personaName] ?? "";
  return extractBulletLines(personaDoc, 4);
}

export function extractStageGuidanceSummary(
  promptPackage: HalosightPromptPackage,
  stageName: HalosightStageName
): string[] {
  const stageDoc = promptPackage.contextPack.stages[stageName] ?? "";
  const salesProcessDoc = extractSalesProcessStageSection(promptPackage.salesProcessPack.stageDefinitions, stageName);

  return [
    ...extractSectionSummary(stageDoc, 2),
    ...extractSectionSummary(salesProcessDoc, 4)
  ].slice(0, 5);
}

export async function loadHalosightContextPack(): Promise<HalosightContextPack> {
  const contextRoot = halosightPath("data", "halosight", "context-pack");

  const [readme, global, personas, competitive, stages, accountTemplate] = await Promise.all([
    readTextFile(path.join(contextRoot, "README.md")),
    loadNamedMarkdownFiles(path.join(contextRoot, "global"), globalContextFiles),
    loadMappedMarkdownFiles(path.join(contextRoot, "personas"), personaFiles),
    loadMappedMarkdownFiles(path.join(contextRoot, "competitive"), competitiveFiles),
    loadMappedMarkdownFiles(path.join(contextRoot, "stages"), stageFiles),
    loadNamedMarkdownFiles(path.join(contextRoot, "accounts", "TEMPLATE"), accountTemplateFiles)
  ]);

  return {
    readme,
    global,
    personas,
    competitive,
    stages,
    accountTemplate
  };
}

export async function loadHalosightSalesProcessPack(): Promise<HalosightSalesProcessPack> {
  const root = halosightPath("data", "halosight", "sales-process");

  const [
    readme,
    stageDefinitions,
    aiEnforcementRules,
    validationDictionary,
    dealScoreModel,
    opportunityDataModel,
    dealInspectionExamples,
    codexSystemPrompt
  ] = await Promise.all([
    readTextFile(path.join(root, "README.md")),
    readTextFile(path.join(root, "global", "sales_process_stages.md")),
    readTextFile(path.join(root, "logic", "ai_enforcement_rules.md")),
    readTextFile(path.join(root, "logic", "validation_dictionary.md")),
    readTextFile(path.join(root, "logic", "deal_score_model.md")),
    readTextFile(path.join(root, "schemas", "opportunity_data_model.yaml")),
    readTextFile(path.join(root, "examples", "deal_inspection_output_examples.md")),
    readTextFile(path.join(root, "examples", "codex_system_prompt.md"))
  ]);

  return {
    readme,
    stageDefinitions,
    aiEnforcementRules,
    validationDictionary,
    dealScoreModel,
    opportunityDataModel,
    dealInspectionExamples,
    codexSystemPrompt
  };
}

async function loadNamedMarkdownFiles<T extends readonly string[]>(dir: string, files: T) {
  const entries = await Promise.all(
    files.map(async (fileName) => [fileName.replace(/\.md$/, ""), await readTextFile(path.join(dir, fileName))] as const)
  );
  return Object.fromEntries(entries) as Record<string, string>;
}

async function loadMappedMarkdownFiles<T extends string>(dir: string, mapping: Record<T, string>) {
  const entries = await Promise.all(
    Object.entries(mapping).map(async ([key, fileName]) => [key, await readTextFile(path.join(dir, fileName as string))] as const)
  );
  return Object.fromEntries(entries) as Record<T, string>;
}

function buildSupplementalContext(promptPackage: HalosightPromptPackage, agentName: HalosightAgentName) {
  const sections: string[] = [
    promptPackage.contextPack.global.company_truth.trim(),
    promptPackage.contextPack.global.product_truth.trim(),
    promptPackage.contextPack.global.sales_process_definitions.trim(),
    promptPackage.contextPack.global.qualification_rules.trim(),
    promptPackage.contextPack.global.truth_boundaries.trim(),
    promptPackage.salesProcessPack.stageDefinitions.trim(),
    promptPackage.salesProcessPack.aiEnforcementRules.trim(),
    promptPackage.salesProcessPack.validationDictionary.trim()
  ];

  if (agentName === "icp_sentinel") {
    sections.push(promptPackage.contextPack.personas.revops.trim(), promptPackage.contextPack.personas.vp_sales.trim());
  }

  if (agentName === "outreach_strategist") {
    sections.push(
      promptPackage.contextPack.personas.cro.trim(),
      promptPackage.contextPack.personas.revops.trim(),
      promptPackage.contextPack.personas.it.trim(),
      promptPackage.contextPack.competitive.gong.trim(),
      promptPackage.contextPack.competitive.clari.trim(),
      promptPackage.contextPack.competitive.status_quo.trim()
    );
  }

  if (agentName === "discovery_qualifier") {
    sections.push(
      promptPackage.contextPack.stages.awareness.trim(),
      promptPackage.contextPack.stages.problem_defined.trim(),
      promptPackage.contextPack.stages.business_case.trim(),
      promptPackage.contextPack.personas.cro.trim(),
      promptPackage.contextPack.personas.revops.trim(),
      promptPackage.contextPack.personas.managers.trim()
    );
  }

  if (agentName === "objection_navigator") {
    sections.push(
      promptPackage.contextPack.competitive.gong.trim(),
      promptPackage.contextPack.competitive.chorus.trim(),
      promptPackage.contextPack.competitive.clari.trim(),
      promptPackage.contextPack.competitive.salesforce_native.trim(),
      promptPackage.contextPack.competitive.status_quo.trim()
    );
  }

  if (agentName === "deal_progression_analyst") {
    sections.push(
      promptPackage.contextPack.stages.awareness.trim(),
      promptPackage.contextPack.stages.problem_defined.trim(),
      promptPackage.contextPack.stages.business_case.trim(),
      promptPackage.contextPack.stages.solution_fit.trim(),
      promptPackage.contextPack.stages.decision.trim()
    );
  }

  if (agentName === "crm_structurer") {
    sections.push(
      promptPackage.contextPack.accountTemplate.account_context.trim(),
      promptPackage.contextPack.accountTemplate.stakeholder_map.trim(),
      promptPackage.contextPack.accountTemplate.discovery_gaps.trim(),
      promptPackage.contextPack.accountTemplate.next_step_strategy.trim()
    );
  }

  return sections.filter(Boolean).join("\n\n");
}

function extractBulletLines(markdown: string, maxItems: number) {
  return markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/^- /, ""))
    .slice(0, maxItems);
}

function extractSectionSummary(markdown: string, maxItems: number) {
  const bulletLines = extractBulletLines(markdown, maxItems);
  if (bulletLines.length > 0) {
    return bulletLines;
  }

  return markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => Boolean(line) && !line.startsWith("#") && !line.startsWith("---"))
    .slice(0, maxItems);
}

function extractSalesProcessStageSection(markdown: string, stageName: HalosightStageName) {
  const stageHeadingByName: Record<HalosightStageName, string[]> = {
    awareness: ["## Stage 1 — Identifying an Opportunity"],
    problem_defined: ["## Stage 2 — Determine Problem / Impact"],
    business_case: ["## Stage 3 — Validate Benefits & Value"],
    solution_fit: ["## Stage 4 — Confirm Value with Power"],
    decision: [
      "## Stage 5 — Negotiating & Mutual Plan",
      "## Stage 6 — Finalizing Closure",
      "## Stage 7 — Pending Closed"
    ]
  };

  const headings = stageHeadingByName[stageName];
  const sections = headings
    .map((heading) => sliceMarkdownSection(markdown, heading))
    .filter(Boolean);

  return sections.join("\n\n");
}

function sliceMarkdownSection(markdown: string, heading: string) {
  const start = markdown.indexOf(heading);
  if (start === -1) {
    return "";
  }

  const afterStart = markdown.slice(start + heading.length);
  const nextHeadingOffset = afterStart.indexOf("\n## ");
  return nextHeadingOffset === -1 ? markdown.slice(start) : markdown.slice(start, start + heading.length + nextHeadingOffset);
}

function includesAny(value: string, patterns: string[]) {
  return patterns.some((pattern) => value.includes(pattern));
}
