import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

interface KnowledgeDocument {
  path: string;
  content: string;
  normalizedContent: string;
}

interface SearchHit {
  path: string;
  score: number;
  snippets: string[];
}

interface SupportResponse {
  response: string;
  confidence: number;
  escalated: boolean;
  escalationReason?: string;
  sources: SearchHit[];
}

const PORT = Number(process.env.PORT ?? 3000);
const LOW_CONFIDENCE_THRESHOLD = 0.35;
const MAX_REQUEST_BYTES = 64 * 1024;
const supportedKnowledgeExtensions = new Set([".md", ".json", ".yaml", ".yml"]);
const stopWords = new Set([
  "about",
  "after",
  "again",
  "also",
  "and",
  "are",
  "but",
  "can",
  "for",
  "from",
  "has",
  "halosight",
  "have",
  "how",
  "into",
  "our",
  "should",
  "someone",
  "says",
  "that",
  "the",
  "their",
  "this",
  "what",
  "when",
  "where",
  "tell",
  "with",
  "your"
]);

const restrictedClaimPatterns = [
  /\bSOC\s*2\b/i,
  /\bHIPAA\b/i,
  /\bsecurity certification/i,
  /\bcertified\b/i,
  /\bSSO\b/i,
  /\bdata retention\b/i,
  /\bencrypted\b/i,
  /\bcustomer data\b.*\btraining\b/i,
  /\bROI\b/i,
  /\brevenue (lift|increase|improvement)\b/i,
  /\bguarantee[ds]?\b/i,
  /\bcustomer logo/i,
  /\bcase stud(y|ies)\b/i,
  /\bFleetPride\b/i,
  /\bChallenger Gray\b/i
];

let knowledgeCache: Promise<KnowledgeDocument[]> | undefined;

async function loadKnowledgeBase() {
  knowledgeCache ??= (async () => {
    const roots = [
      path.join(process.cwd(), "data", "halosight"),
      path.join(process.cwd(), "prompts", "halosight")
    ];
    const files = (await Promise.all(roots.map((root) => findKnowledgeFiles(root)))).flat();
    const documents = await Promise.all(
      files.map(async (filePath) => {
        const content = await readFile(filePath, "utf8");
        return {
          path: path.relative(process.cwd(), filePath),
          content,
          normalizedContent: normalize(content)
        };
      })
    );

    return documents;
  })();

  return knowledgeCache;
}

async function findKnowledgeFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return findKnowledgeFiles(fullPath);
      }

      return supportedKnowledgeExtensions.has(path.extname(entry.name)) ? [fullPath] : [];
    })
  );

  return nestedFiles.flat();
}

function searchKnowledgeBase(documents: KnowledgeDocument[], message: string): SearchHit[] {
  const tokens = tokenize(message);
  if (tokens.length === 0) {
    return [];
  }

  return documents
    .map((document) => {
      // MVP retrieval: score files by direct keyword overlap and keep the best few snippets.
      const tokenScore = tokens.reduce(
        (score, token) => score + countOccurrences(document.normalizedContent, token),
        0
      );
      const phraseBonus = document.normalizedContent.includes(normalize(message)) ? tokens.length : 0;

      return {
        path: document.path,
        score: tokenScore + phraseBonus,
        snippets: extractSnippets(document.content, tokens)
      };
    })
    .filter((hit) => hit.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 4);
}

function buildSupportResponse(message: string, hits: SearchHit[]): SupportResponse {
  const confidence = calculateConfidence(message, hits);
  const restrictedClaim = restrictedClaimPatterns.find((pattern) => pattern.test(message));
  // The system prompt requires escalation when claims need verification or source confidence is weak.
  const escalated = Boolean(restrictedClaim) || confidence < LOW_CONFIDENCE_THRESHOLD;
  const escalationReason = restrictedClaim
    ? "The request touches claims that require authoritative confirmation before external use."
    : confidence < LOW_CONFIDENCE_THRESHOLD
      ? "The knowledge base match was too weak to answer confidently."
      : undefined;

  if (escalated) {
    return {
      response: [
        "I do not have enough verified Halosight source material to answer that confidently.",
        "I would escalate this for authoritative confirmation before using it externally.",
        buildGroundedContext(hits)
      ]
        .filter(Boolean)
        .join(" "),
      confidence,
      escalated,
      escalationReason,
      sources: hits
    };
  }

  return {
    response: [
      buildGroundedAnswer(hits),
      "This is grounded in the local Halosight knowledge base and avoids unsupported claims."
    ].join(" "),
    confidence,
    escalated,
    sources: hits
  };
}

function buildGroundedAnswer(hits: SearchHit[]) {
  const snippets = hits.flatMap((hit) => hit.snippets).slice(0, 4);
  if (snippets.length === 0) {
    return "The most relevant Halosight guidance says to stay concise, lead with the business problem, and avoid inventing claims.";
  }

  return `Based on the Halosight knowledge base: ${snippets.join(" ")}`;
}

function buildGroundedContext(hits: SearchHit[]) {
  const snippets = hits.flatMap((hit) => hit.snippets).slice(0, 2);
  if (snippets.length === 0) {
    return "";
  }

  return `Relevant internal context found: ${snippets.join(" ")}`;
}

function calculateConfidence(message: string, hits: SearchHit[]) {
  const tokens = tokenize(message);
  if (tokens.length === 0 || hits.length === 0) {
    return 0;
  }

  const topScore = hits[0]?.score ?? 0;
  // Simple confidence proxy: enough keyword evidence in at least one KB file.
  const requiredScore = Math.max(6, tokens.length * 2);
  return Math.min(1, Number((topScore / requiredScore).toFixed(2)));
}

function extractSnippets(content: string, tokens: string[]) {
  return content
    .split(/\n{2,}/)
    .map((section) => section.replace(/\s+/g, " ").trim())
    .filter((section) => section.length > 0 && !section.startsWith("#"))
    .filter((section) => {
      const normalizedSection = normalize(section);
      return tokens.some((token) => normalizedSection.includes(token));
    })
    .slice(0, 2)
    .map((section) => (section.length > 240 ? `${section.slice(0, 237)}...` : section));
}

function tokenize(value: string) {
  return Array.from(new Set(normalize(value).split(" ").filter((token) => token.length > 2 && !stopWords.has(token))));
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function countOccurrences(value: string, token: string) {
  return value.split(token).length - 1;
}

async function readJsonBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_REQUEST_BYTES) {
      throw new Error("Request body is too large.");
    }
    chunks.push(buffer);
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");
  return rawBody ? (JSON.parse(rawBody) as unknown) : {};
}

function writeJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.writeHead(statusCode, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload, null, 2));
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/health") {
      writeJson(response, 200, { status: "ok" });
      return;
    }

    if (request.method !== "POST" || request.url !== "/support") {
      writeJson(response, 404, { error: "Use POST /support with a JSON body: { \"message\": \"...\" }." });
      return;
    }

    const body = await readJsonBody(request);
    const message = typeof (body as { message?: unknown }).message === "string" ? (body as { message: string }).message : "";

    if (!message.trim()) {
      writeJson(response, 400, { error: "message is required." });
      return;
    }

    const documents = await loadKnowledgeBase();
    const hits = searchKnowledgeBase(documents, message);
    writeJson(response, 200, buildSupportResponse(message, hits));
  } catch (error) {
    writeJson(response, 500, { error: error instanceof Error ? error.message : "Unknown error." });
  }
});

server.listen(PORT, () => {
  console.log(`Halosight support agent API listening on http://localhost:${PORT}`);
  console.log("POST /support with { \"message\": \"...\" }");
});
