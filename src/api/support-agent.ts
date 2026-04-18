import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { Pool } from "pg";

import { ChatwootApiProvider, chatwootConfigFromEnv, hasChatwootCredentials, MockChatwootProvider } from "../providers/chatwoot.js";
import type { ChatwootConversation, ChatwootProvider } from "../providers/interfaces.js";

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
  mockSlackNotification?: MockSlackNotification;
  slackDelivery?: SlackDelivery;
  sources: SearchHit[];
}

interface MockSlackNotification {
  channel: string;
  message: string;
}

interface SlackDelivery {
  mode: "webhook";
  delivered: boolean;
  status?: number;
  responseBody?: string;
  error?: string;
}

interface ChatwootEscalationResult {
  status: "created" | "not_needed" | "failed";
  conversation?: ChatwootConversation;
  error?: string;
}

type SupportSurface = "public_website" | "authenticated_app" | "flutter_webview";
type KnowledgeSet = "public_site" | "authenticated_app";
type HumanSupportStatus = "ai_only" | "escalated";
type SupportTicketStatus = "open" | "waiting_on_human" | "waiting_on_customer" | "resolved";

loadLocalEnv();

interface ChatSession {
  sessionId: string;
  surface: SupportSurface;
  knowledgeSet: KnowledgeSet;
  route?: string;
  userId?: string;
  accountId?: string;
  humanSupportStatus: HumanSupportStatus;
  ticket?: SupportTicket;
  createdAt: string;
  updatedAt: string;
  messages: ChatTranscriptMessage[];
}

interface SupportTicket {
  ticketId: string;
  sessionId: string;
  status: SupportTicketStatus;
  escalationReason: string;
  sourcePaths: string[];
  chatwootConversationId?: string;
  chatwootConversationUrl?: string;
  createdAt: string;
  updatedAt: string;
}

interface ChatTranscriptMessage {
  role: "user" | "assistant" | "human";
  content: string;
  createdAt: string;
  escalated?: boolean;
}

const PORT = Number(process.env.PORT ?? 3000);
const LOW_CONFIDENCE_THRESHOLD = 0.35;
const MAX_REQUEST_BYTES = 64 * 1024;
const chatClientDistDir = path.join(process.cwd(), "apps", "chat-client-react", "dist");
const runtimeDataDir = path.join(process.cwd(), ".halosight-runtime");
const chatSessionStorePath = path.join(runtimeDataDir, "chat-sessions.json");
const databaseUrl = process.env.DATABASE_URL?.trim();
const supportAllowedOrigins = parseAllowedOrigins(process.env.SUPPORT_ALLOWED_ORIGINS);
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

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    process.env[key] ??= value;
  }
}

const supportTestPage = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Halosight Support Test</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f7f8f4;
        --ink: #1d201f;
        --muted: #626a66;
        --line: #d8ded6;
        --surface: #ffffff;
        --accent: #0f766e;
        --accent-strong: #0b5e59;
        --alert: #b42318;
        --soft: #edf7f4;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background: var(--bg);
        color: var(--ink);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        letter-spacing: 0;
      }

      main {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 32px;
      }

      .workspace {
        width: min(1120px, 100%);
        display: grid;
        grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
        gap: 32px;
        align-items: stretch;
      }

      .copy {
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 22px;
        min-width: 0;
      }

      .eyebrow {
        margin: 0;
        color: var(--accent-strong);
        font-size: 14px;
        font-weight: 800;
        text-transform: uppercase;
      }

      h1 {
        margin: 0;
        max-width: 760px;
        font-size: clamp(38px, 7vw, 78px);
        line-height: 0.94;
        letter-spacing: 0;
      }

      .lede {
        margin: 0;
        max-width: 640px;
        color: var(--muted);
        font-size: 19px;
        line-height: 1.55;
      }

      .checks {
        display: grid;
        gap: 12px;
        margin: 10px 0 0;
        padding: 0;
        list-style: none;
      }

      .checks li {
        display: flex;
        gap: 10px;
        align-items: center;
        color: #343a37;
        font-size: 15px;
      }

      .checks span {
        width: 22px;
        height: 22px;
        border-radius: 8px;
        display: inline-grid;
        place-items: center;
        background: var(--soft);
        color: var(--accent-strong);
        font-weight: 900;
        flex: 0 0 auto;
      }

      .visual {
        min-height: 520px;
        border-left: 1px solid var(--line);
        padding-left: 32px;
        display: flex;
        align-items: center;
      }

      .browser {
        width: 100%;
        min-height: 420px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--surface);
        overflow: hidden;
        box-shadow: 0 20px 60px rgba(26, 35, 31, 0.12);
      }

      .browser-bar {
        height: 44px;
        border-bottom: 1px solid var(--line);
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 16px;
        color: var(--muted);
        font-size: 13px;
      }

      .dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: #d6b64d;
      }

      .dot:nth-child(2) {
        background: #c65b45;
      }

      .dot:nth-child(3) {
        background: #2f9d70;
        margin-right: 10px;
      }

      .mock-site {
        position: relative;
        min-height: 376px;
        padding: 28px;
        background:
          linear-gradient(rgba(255, 255, 255, 0.78), rgba(255, 255, 255, 0.78)),
          url("https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80") center / cover;
      }

      .mock-lines {
        max-width: 330px;
        display: grid;
        gap: 12px;
      }

      .mock-lines div {
        height: 16px;
        border-radius: 8px;
        background: rgba(29, 32, 31, 0.16);
      }

      .mock-lines div:first-child {
        width: 76%;
        height: 34px;
        background: rgba(29, 32, 31, 0.28);
      }

      .mock-lines div:nth-child(3) {
        width: 62%;
      }

      .support-tab {
        position: fixed;
        right: 22px;
        bottom: 22px;
        z-index: 20;
        border: 0;
        border-radius: 8px;
        background: var(--accent);
        color: #fff;
        padding: 14px 18px;
        font: inherit;
        font-weight: 800;
        cursor: pointer;
        box-shadow: 0 14px 30px rgba(15, 118, 110, 0.28);
        transition: transform 160ms ease, background 160ms ease;
      }

      .support-tab:hover,
      .support-tab:focus-visible {
        transform: translateY(-2px);
        background: var(--accent-strong);
      }

      .support-panel {
        position: fixed;
        right: 22px;
        bottom: 84px;
        z-index: 30;
        width: min(440px, calc(100vw - 32px));
        max-height: min(720px, calc(100vh - 112px));
        display: grid;
        grid-template-rows: auto auto minmax(160px, 1fr);
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 8px;
        box-shadow: 0 22px 70px rgba(26, 35, 31, 0.22);
        overflow: hidden;
        opacity: 0;
        transform: translateY(12px);
        pointer-events: none;
        transition: opacity 180ms ease, transform 180ms ease;
      }

      .support-panel.open {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
      }

      .panel-head {
        padding: 18px 18px 16px;
        border-bottom: 1px solid var(--line);
        display: flex;
        justify-content: space-between;
        gap: 16px;
      }

      .panel-head h2 {
        margin: 0;
        font-size: 18px;
      }

      .panel-head p {
        margin: 6px 0 0;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.4;
      }

      .close {
        width: 34px;
        height: 34px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #fff;
        color: var(--ink);
        cursor: pointer;
        font-size: 20px;
      }

      form {
        padding: 18px;
        border-bottom: 1px solid var(--line);
        display: grid;
        gap: 12px;
      }

      textarea {
        width: 100%;
        min-height: 110px;
        resize: vertical;
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 12px;
        color: var(--ink);
        font: inherit;
        font-size: 15px;
        line-height: 1.45;
      }

      textarea:focus {
        outline: 3px solid rgba(15, 118, 110, 0.18);
        border-color: var(--accent);
      }

      .actions {
        display: flex;
        gap: 10px;
        align-items: center;
        justify-content: space-between;
      }

      .sample {
        border: 0;
        background: transparent;
        color: var(--accent-strong);
        padding: 0;
        font: inherit;
        font-size: 13px;
        font-weight: 800;
        cursor: pointer;
      }

      .send {
        border: 0;
        border-radius: 8px;
        background: var(--accent);
        color: #fff;
        padding: 11px 16px;
        font: inherit;
        font-weight: 800;
        cursor: pointer;
      }

      .send:disabled {
        cursor: wait;
        opacity: 0.62;
      }

      .result {
        min-height: 180px;
        overflow: auto;
        padding: 18px;
        display: grid;
        gap: 14px;
        align-content: start;
      }

      .placeholder {
        color: var(--muted);
        line-height: 1.5;
        margin: 0;
      }

      .status {
        display: inline-flex;
        width: fit-content;
        border-radius: 8px;
        padding: 6px 9px;
        background: var(--soft);
        color: var(--accent-strong);
        font-size: 12px;
        font-weight: 900;
        text-transform: uppercase;
      }

      .status.escalated {
        background: #fff1ef;
        color: var(--alert);
      }

      .answer {
        margin: 0;
        line-height: 1.55;
        white-space: pre-wrap;
      }

      details {
        border-top: 1px solid var(--line);
        padding-top: 12px;
      }

      summary {
        cursor: pointer;
        color: var(--accent-strong);
        font-weight: 800;
      }

      pre {
        white-space: pre-wrap;
        word-break: break-word;
        margin: 12px 0 0;
        padding: 12px;
        background: #f4f5f0;
        border-radius: 8px;
        color: #2c322f;
        font-size: 12px;
        line-height: 1.45;
      }

      @media (max-width: 860px) {
        main {
          padding: 22px;
          place-items: start;
        }

        .workspace {
          grid-template-columns: 1fr;
        }

        .visual {
          min-height: 320px;
          border-left: 0;
          border-top: 1px solid var(--line);
          padding: 24px 0 0;
        }

        h1 {
          font-size: 44px;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="workspace" aria-label="Halosight support test workspace">
        <div class="copy">
          <p class="eyebrow">Halosight support test</p>
          <h1>Try the support tab before it reaches the website.</h1>
          <p class="lede">Ask a question, see the grounded answer, and confirm that sensitive or uncertain requests create a human-support handoff.</p>
          <ul class="checks" aria-label="Test checklist">
            <li><span>1</span> Send a common support question.</li>
            <li><span>2</span> Trigger escalation with a restricted claim.</li>
            <li><span>3</span> Confirm the mock Chatwoot conversation is created.</li>
          </ul>
        </div>
        <div class="visual" aria-hidden="true">
          <div class="browser">
            <div class="browser-bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span>halosight.com</div>
            <div class="mock-site">
              <div class="mock-lines">
                <div></div>
                <div></div>
                <div></div>
                <div></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <button class="support-tab" type="button" id="supportTab" aria-expanded="false">Support</button>
    <aside class="support-panel" id="supportPanel" aria-label="Support test panel">
      <div class="panel-head">
        <div>
          <h2>Halosight Support</h2>
          <p>Answers from the local KB. Escalations create a mock Chatwoot conversation and can still notify Slack when configured.</p>
        </div>
        <button class="close" type="button" id="closePanel" aria-label="Close support panel">×</button>
      </div>
      <form id="supportForm">
        <textarea id="message" required>Can we tell a customer Halosight is SOC 2 certified and guarantees ROI?</textarea>
        <div class="actions">
          <button class="sample" type="button" id="sampleQuestion">Use Salesforce question</button>
          <button class="send" type="submit" id="sendButton">Send</button>
        </div>
      </form>
      <div class="result" id="result">
        <p class="placeholder">Send a question to see the response here.</p>
      </div>
    </aside>

    <script>
      const panel = document.querySelector("#supportPanel");
      const tab = document.querySelector("#supportTab");
      const closePanel = document.querySelector("#closePanel");
      const form = document.querySelector("#supportForm");
      const message = document.querySelector("#message");
      const result = document.querySelector("#result");
      const sendButton = document.querySelector("#sendButton");
      const sampleQuestion = document.querySelector("#sampleQuestion");
      let sessionId = window.localStorage.getItem("halosightSupportSessionId");

      function setOpen(open) {
        panel.classList.toggle("open", open);
        tab.setAttribute("aria-expanded", String(open));
        if (open) {
          message.focus();
        }
      }

      tab.addEventListener("click", () => setOpen(!panel.classList.contains("open")));
      closePanel.addEventListener("click", () => setOpen(false));
      sampleQuestion.addEventListener("click", () => {
        message.value = "How should Halosight respond when someone says they already use Salesforce?";
        message.focus();
      });

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const text = message.value.trim();
        if (!text) return;

        sendButton.disabled = true;
        sendButton.textContent = "Sending";
        result.innerHTML = '<p class="placeholder">Checking the knowledge base...</p>';

        try {
          const activeSessionId = await ensureSession();
          const response = await fetch("/chat/message", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: activeSessionId,
              message: text,
              context: {
                surface: "public_website",
                route: window.location.pathname
              }
            })
          });
          const payload = await response.json();
          renderResult(payload);
        } catch (error) {
          result.innerHTML = '<span class="status escalated">Error</span><p class="answer">The support request could not be sent.</p>';
        } finally {
          sendButton.disabled = false;
          sendButton.textContent = "Send";
        }
      });

      async function ensureSession() {
        if (sessionId) {
          return sessionId;
        }

        const response = await fetch("/chat/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            surface: "public_website",
            route: window.location.pathname
          })
        });
        const payload = await response.json();
        sessionId = payload.session.sessionId;
        window.localStorage.setItem("halosightSupportSessionId", sessionId);
        return sessionId;
      }

      function renderResult(payload) {
        const reply = payload.reply;
        const statusText = reply.escalated ? "Escalated" : "Answered";
        const details = JSON.stringify({
          session: payload.session,
          confidence: reply.confidence,
          escalationReason: reply.escalationReason,
          slackDelivery: reply.slackDelivery,
          chatwoot: reply.chatwoot,
          sources: reply.sources
        }, null, 2);

        result.innerHTML = [
          '<span class="status ' + (reply.escalated ? "escalated" : "") + '">' + statusText + '</span>',
          '<p class="answer"></p>',
          '<details><summary>Response details</summary><pre></pre></details>'
        ].join("");
        result.querySelector(".answer").textContent = reply.content;
        result.querySelector("pre").textContent = details;
      }
    </script>
  </body>
</html>`;

const ticketOpsPage = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Halosight Support Tickets</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4f6f3;
        --ink: #1f2421;
        --muted: #65706a;
        --line: #d6ddd7;
        --surface: #ffffff;
        --accent: #0f766e;
        --accent-soft: #e4f4f1;
        --danger: #a63a2a;
        --danger-soft: #f9e8e3;
        --warn: #8a6500;
        --warn-soft: #fff3c4;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background: var(--bg);
        color: var(--ink);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        letter-spacing: 0;
      }

      button,
      select {
        font: inherit;
      }

      main {
        width: min(1280px, calc(100% - 32px));
        margin: 0 auto;
        padding: 28px 0;
      }

      header {
        display: flex;
        justify-content: space-between;
        gap: 18px;
        align-items: flex-end;
        padding-bottom: 22px;
        border-bottom: 1px solid var(--line);
      }

      h1 {
        margin: 0;
        font-size: 34px;
        line-height: 1.05;
      }

      .subhead {
        margin: 8px 0 0;
        color: var(--muted);
        max-width: 680px;
        line-height: 1.5;
      }

      .refresh {
        border: 0;
        border-radius: 8px;
        background: var(--accent);
        color: #fff;
        padding: 11px 15px;
        font-weight: 800;
        cursor: pointer;
      }

      .layout {
        display: grid;
        grid-template-columns: minmax(300px, 0.9fr) minmax(0, 1.4fr);
        gap: 24px;
        padding-top: 24px;
        align-items: start;
      }

      .panel-title {
        margin: 0 0 12px;
        font-size: 14px;
        color: var(--muted);
        text-transform: uppercase;
        font-weight: 900;
      }

      .ticket-list {
        display: grid;
        gap: 10px;
      }

      .ticket-row {
        width: 100%;
        text-align: left;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--surface);
        padding: 14px;
        cursor: pointer;
        display: grid;
        gap: 8px;
      }

      .ticket-row[aria-current="true"] {
        border-color: var(--accent);
        box-shadow: 0 0 0 2px var(--accent-soft);
      }

      .ticket-topline,
      .detail-topline {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .ticket-id {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 12px;
        color: var(--muted);
        overflow-wrap: anywhere;
      }

      .status {
        display: inline-flex;
        align-items: center;
        border-radius: 8px;
        padding: 4px 8px;
        font-size: 12px;
        font-weight: 900;
        color: var(--accent);
        background: var(--accent-soft);
        white-space: nowrap;
      }

      .status.resolved {
        color: #4f5a55;
        background: #edf0ee;
      }

      .status.waiting_on_customer {
        color: var(--warn);
        background: var(--warn-soft);
      }

      .status.waiting_on_human {
        color: var(--danger);
        background: var(--danger-soft);
      }

      .reason {
        margin: 0;
        line-height: 1.45;
      }

      .meta {
        color: var(--muted);
        font-size: 13px;
      }

      .detail {
        min-height: 520px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--surface);
        padding: 20px;
      }

      .empty {
        min-height: 360px;
        display: grid;
        place-items: center;
        color: var(--muted);
        text-align: center;
        border: 1px dashed var(--line);
        border-radius: 8px;
        padding: 24px;
      }

      .detail h2 {
        margin: 0;
        font-size: 24px;
      }

      .controls {
        margin-top: 18px;
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
      }

      select {
        min-width: 220px;
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 10px 12px;
        background: #fff;
        color: var(--ink);
      }

      .save {
        border: 1px solid var(--accent);
        border-radius: 8px;
        background: var(--accent);
        color: #fff;
        padding: 10px 14px;
        font-weight: 800;
        cursor: pointer;
      }

      .external-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 42px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #fff;
        color: var(--accent);
        padding: 0 14px;
        font-weight: 800;
        text-decoration: none;
      }

      .section {
        margin-top: 24px;
        padding-top: 18px;
        border-top: 1px solid var(--line);
      }

      .section h3 {
        margin: 0 0 10px;
        font-size: 16px;
      }

      .source-list {
        margin: 0;
        padding-left: 18px;
        color: var(--muted);
        line-height: 1.6;
      }

      .transcript {
        display: grid;
        gap: 12px;
      }

      .message {
        border-left: 3px solid var(--line);
        padding-left: 12px;
      }

      .message strong {
        display: block;
        margin-bottom: 4px;
        text-transform: capitalize;
      }

      .message p {
        margin: 0;
        color: #303633;
        line-height: 1.5;
      }

      .notice {
        margin-top: 12px;
        color: var(--muted);
        min-height: 20px;
      }

      @media (max-width: 820px) {
        main {
          width: min(100% - 22px, 1280px);
          padding: 18px 0;
        }

        header,
        .ticket-topline,
        .detail-topline {
          align-items: flex-start;
          flex-direction: column;
        }

        .layout {
          grid-template-columns: 1fr;
        }

        h1 {
          font-size: 28px;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <div>
          <h1>Support Tickets</h1>
          <p class="subhead">Review local escalation tickets, inspect the transcript, update status, and open linked Chatwoot conversations.</p>
        </div>
        <button class="refresh" type="button">Refresh</button>
      </header>

      <section class="layout">
        <div>
          <p class="panel-title">Ticket Queue</p>
          <div class="ticket-list" id="ticket-list"></div>
        </div>

        <div>
          <p class="panel-title">Ticket Detail</p>
          <div class="detail" id="ticket-detail">
            <div class="empty">Select a ticket to review its escalation context.</div>
          </div>
        </div>
      </section>
    </main>

    <script>
      const list = document.querySelector("#ticket-list");
      const detail = document.querySelector("#ticket-detail");
      const refresh = document.querySelector(".refresh");
      let tickets = [];
      let selectedTicketId = "";

      refresh.addEventListener("click", () => loadTickets());

      function formatDate(value) {
        return value ? new Date(value).toLocaleString() : "Unknown";
      }

      function statusLabel(status) {
        return String(status || "open").replaceAll("_", " ");
      }

      function escapeHtml(value) {
        return String(value ?? "")
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#039;");
      }

      async function loadTickets() {
        list.innerHTML = '<div class="empty">Loading tickets...</div>';
        const response = await fetch("/tickets");
        const data = await response.json();
        tickets = data.tickets || [];
        renderList();
        if (selectedTicketId) {
          await loadTicket(selectedTicketId);
        }
      }

      function renderList() {
        if (tickets.length === 0) {
          list.innerHTML = '<div class="empty">No local tickets yet.</div>';
          return;
        }

        list.innerHTML = tickets
          .map((ticket) => [
            '<button class="ticket-row" type="button" data-ticket-id="' + escapeHtml(ticket.ticketId) + '" aria-current="' + (ticket.ticketId === selectedTicketId) + '">',
            '  <span class="ticket-topline">',
            '    <span class="ticket-id">' + escapeHtml(ticket.ticketId) + '</span>',
            '    <span class="status ' + escapeHtml(ticket.status) + '">' + escapeHtml(statusLabel(ticket.status)) + '</span>',
            '  </span>',
            '  <p class="reason">' + escapeHtml(ticket.escalationReason) + '</p>',
            '  <span class="meta">Updated ' + escapeHtml(formatDate(ticket.updatedAt)) + '</span>',
            '</button>'
          ].join(""))
          .join("");

        list.querySelectorAll(".ticket-row").forEach((row) => {
          row.addEventListener("click", () => {
            selectedTicketId = row.dataset.ticketId;
            renderList();
            loadTicket(selectedTicketId);
          });
        });
      }

      async function loadTicket(ticketId) {
        detail.innerHTML = '<div class="empty">Loading ticket detail...</div>';
        const response = await fetch("/tickets/" + encodeURIComponent(ticketId));
        if (!response.ok) {
          detail.innerHTML = '<div class="empty">Ticket not found.</div>';
          return;
        }

        const data = await response.json();
        renderDetail(data.ticket);
      }

      function renderDetail(ticket) {
        const sources = ticket.sourcePaths?.length
          ? ticket.sourcePaths.map((source) => "<li>" + escapeHtml(source) + "</li>").join("")
          : "<li>No source paths recorded.</li>";
        const transcript = ticket.transcript?.length
          ? ticket.transcript.map((message) => [
              '<div class="message">',
              '  <strong>' + escapeHtml(message.role) + ' - ' + escapeHtml(formatDate(message.createdAt)) + '</strong>',
              '  <p>' + escapeHtml(message.content) + '</p>',
              '</div>'
            ].join("")).join("")
          : '<p class="meta">No transcript messages recorded.</p>';
        const chatwootLink = ticket.chatwootConversationUrl
          ? '<a class="external-link" href="' + escapeHtml(ticket.chatwootConversationUrl) + '" target="_blank" rel="noreferrer">Open in Chatwoot</a>'
          : '<span class="meta">No Chatwoot conversation linked yet.</span>';

        detail.innerHTML = [
          '<div class="detail-topline">',
          '  <div>',
          '    <h2>' + escapeHtml(ticket.ticketId) + '</h2>',
          '    <p class="meta">Session ' + escapeHtml(ticket.sessionId) + '</p>',
          '  </div>',
          '  <span class="status ' + escapeHtml(ticket.status) + '">' + escapeHtml(statusLabel(ticket.status)) + '</span>',
          '</div>',
          '<div class="controls">',
          '  <label for="status">Status</label>',
          '  <select id="status">',
          '    <option value="open">open</option>',
          '    <option value="waiting_on_human">waiting on human</option>',
          '    <option value="waiting_on_customer">waiting on customer</option>',
          '    <option value="resolved">resolved</option>',
          '  </select>',
          '  <button class="save" type="button">Save status</button>',
          '  ' + chatwootLink,
          '</div>',
          '<p class="notice" id="notice"></p>',
          '<div class="section">',
          '  <h3>Chatwoot</h3>',
          '  <p class="meta">Conversation ' + escapeHtml(ticket.chatwootConversationId || "not linked") + '</p>',
          '</div>',
          '<div class="section">',
          '  <h3>Escalation Reason</h3>',
          '  <p class="reason">' + escapeHtml(ticket.escalationReason) + '</p>',
          '</div>',
          '<div class="section">',
          '  <h3>Source Paths</h3>',
          '  <ul class="source-list">' + sources + '</ul>',
          '</div>',
          '<div class="section">',
          '  <h3>Transcript</h3>',
          '  <div class="transcript">' + transcript + '</div>',
          '</div>'
        ].join("");

        const status = detail.querySelector("#status");
        const notice = detail.querySelector("#notice");
        status.value = ticket.status;
        detail.querySelector(".save").addEventListener("click", async () => {
          notice.textContent = "Saving...";
          const response = await fetch("/tickets/" + encodeURIComponent(ticket.ticketId), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: status.value })
          });
          const data = await response.json();
          if (!response.ok) {
            notice.textContent = data.error || "Unable to update ticket.";
            return;
          }

          notice.textContent = "Saved.";
          selectedTicketId = data.ticket.ticketId;
          await loadTickets();
        });
      }

      loadTickets().catch((error) => {
        list.innerHTML = '<div class="empty">Unable to load tickets.</div>';
        detail.innerHTML = '<div class="empty">' + escapeHtml(error.message) + '</div>';
      });
    </script>
  </body>
</html>`;

let knowledgeCache: Promise<KnowledgeDocument[]> | undefined;
const chatSessions = new Map<string, ChatSession>();
let sessionStoreReady: Promise<void> | undefined;
let sessionWriteQueue = Promise.resolve();
const chatwootProvider: ChatwootProvider = hasChatwootCredentials() ? new ChatwootApiProvider() : new MockChatwootProvider();
const databasePool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false }
    })
  : undefined;

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
      mockSlackNotification: buildMockSlackNotification(message, escalationReason ?? "Escalation required.", hits),
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

function buildMockSlackNotification(message: string, reason: string, hits: SearchHit[]): MockSlackNotification {
  const sourceList = hits.length > 0 ? hits.map((hit) => `- ${hit.path}`).join("\n") : "- No strong source match";

  return {
    channel: "#support-escalations",
    message: [
      "New Halosight support escalation",
      "",
      "User message:",
      message,
      "",
      "Reason:",
      reason,
      "",
      "Sources:",
      sourceList
    ].join("\n")
  };
}

async function postSlackEscalation(notification: MockSlackNotification): Promise<SlackDelivery | undefined> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return undefined;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: notification.message
      })
    });

    const responseBody = await response.text();

    const slackAcceptedMessage = responseBody.trim() === "ok";

    if (!response.ok || !slackAcceptedMessage) {
      return {
        mode: "webhook",
        delivered: false,
        status: response.status,
        responseBody,
        error: `Slack webhook failed: ${response.status} ${responseBody.slice(0, 120)}`
      };
    }

    return {
      mode: "webhook",
      delivered: true,
      status: response.status,
      responseBody
    };
  } catch (error) {
    return {
      mode: "webhook",
      delivered: false,
      error: error instanceof Error ? error.message : "Unknown Slack webhook error."
    };
  }
}

async function answerSupportMessage(message: string) {
  const documents = await loadKnowledgeBase();
  const hits = searchKnowledgeBase(documents, message);
  const supportResponse = buildSupportResponse(message, hits);
  if (supportResponse.escalated && supportResponse.mockSlackNotification) {
    supportResponse.slackDelivery = await postSlackEscalation(supportResponse.mockSlackNotification);
  }

  return supportResponse;
}

function createChatSession(params: {
  surface?: unknown;
  route?: unknown;
  userId?: unknown;
  accountId?: unknown;
  knowledgeSet?: unknown;
}) {
  const surface = normalizeSurface(params.surface);
  const knowledgeSet = normalizeKnowledgeSet(params.knowledgeSet, surface);
  const now = new Date().toISOString();
  const session: ChatSession = {
    sessionId: randomUUID(),
    surface,
    knowledgeSet,
    route: typeof params.route === "string" ? params.route : undefined,
    userId: typeof params.userId === "string" ? params.userId : undefined,
    accountId: typeof params.accountId === "string" ? params.accountId : undefined,
    humanSupportStatus: "ai_only",
    createdAt: now,
    updatedAt: now,
    messages: []
  };

  chatSessions.set(session.sessionId, session);
  return session;
}

function createOrUpdateSupportTicket(session: ChatSession, supportResponse: SupportResponse) {
  if (!supportResponse.escalated) {
    return undefined;
  }

  const now = new Date().toISOString();
  const sourcePaths = supportResponse.sources.map((source) => source.path);
  if (!session.ticket) {
    session.ticket = {
      ticketId: `ticket-${randomUUID()}`,
      sessionId: session.sessionId,
      status: "open",
      escalationReason: supportResponse.escalationReason ?? "Escalation required.",
      sourcePaths,
      createdAt: now,
      updatedAt: now
    };
    return session.ticket;
  }

  session.ticket.status = session.ticket.status === "resolved" ? "open" : session.ticket.status;
  session.ticket.escalationReason = supportResponse.escalationReason ?? session.ticket.escalationReason;
  session.ticket.sourcePaths = Array.from(new Set([...session.ticket.sourcePaths, ...sourcePaths]));
  session.ticket.updatedAt = now;
  return session.ticket;
}

async function loadStoredChatSessions() {
  sessionStoreReady ??= (async () => {
    if (databasePool) {
      await loadChatSessionsFromPostgres();
      return;
    }

    try {
      const rawSessions = JSON.parse(await readFile(chatSessionStorePath, "utf8")) as unknown;
      if (!Array.isArray(rawSessions)) {
        return;
      }

      for (const rawSession of rawSessions) {
        const session = parseStoredChatSession(rawSession);
        if (session) {
          chatSessions.set(session.sessionId, session);
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.warn("Unable to load stored chat sessions:", error);
      }
    }
  })();

  return sessionStoreReady;
}

async function saveChatSessions() {
  await loadStoredChatSessions();
  sessionWriteQueue = sessionWriteQueue.then(async () => {
    if (databasePool) {
      await saveChatSessionsToPostgres();
      return;
    }

    await mkdir(runtimeDataDir, { recursive: true });
    const sessions = Array.from(chatSessions.values());
    await writeFile(chatSessionStorePath, JSON.stringify(sessions, null, 2), "utf8");
  });
  return sessionWriteQueue;
}

async function ensurePostgresSchema() {
  if (!databasePool) {
    return;
  }

  await databasePool.query(`
    create table if not exists support_chat_sessions (
      session_id text primary key,
      payload jsonb not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
}

async function loadChatSessionsFromPostgres() {
  if (!databasePool) {
    return;
  }

  await ensurePostgresSchema();
  const result = await databasePool.query<{ payload: unknown }>("select payload from support_chat_sessions order by updated_at asc");
  for (const row of result.rows) {
    const session = parseStoredChatSession(row.payload);
    if (session) {
      chatSessions.set(session.sessionId, session);
    }
  }
}

async function saveChatSessionsToPostgres() {
  if (!databasePool) {
    return;
  }

  await ensurePostgresSchema();
  const client = await databasePool.connect();
  try {
    await client.query("begin");
    for (const session of chatSessions.values()) {
      await client.query(
        `
          insert into support_chat_sessions (session_id, payload, created_at, updated_at)
          values ($1, $2::jsonb, $3::timestamptz, $4::timestamptz)
          on conflict (session_id) do update set
            payload = excluded.payload,
            updated_at = excluded.updated_at
        `,
        [session.sessionId, JSON.stringify(session), session.createdAt, session.updatedAt]
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

function parseStoredChatSession(value: unknown): ChatSession | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const rawSession = value as Partial<ChatSession>;
  if (typeof rawSession.sessionId !== "string") {
    return undefined;
  }

  const messages = Array.isArray(rawSession.messages)
    ? rawSession.messages
        .map((message) => parseStoredTranscriptMessage(message))
        .filter((message): message is ChatTranscriptMessage => Boolean(message))
    : [];

  return {
    sessionId: rawSession.sessionId,
    surface: normalizeSurface(rawSession.surface),
    knowledgeSet: normalizeKnowledgeSet(rawSession.knowledgeSet, normalizeSurface(rawSession.surface)),
    route: typeof rawSession.route === "string" ? rawSession.route : undefined,
    userId: typeof rawSession.userId === "string" ? rawSession.userId : undefined,
    accountId: typeof rawSession.accountId === "string" ? rawSession.accountId : undefined,
    humanSupportStatus: rawSession.humanSupportStatus === "escalated" ? "escalated" : "ai_only",
    ticket: parseStoredSupportTicket(rawSession.ticket, rawSession.sessionId),
    createdAt: typeof rawSession.createdAt === "string" ? rawSession.createdAt : new Date().toISOString(),
    updatedAt: typeof rawSession.updatedAt === "string" ? rawSession.updatedAt : new Date().toISOString(),
    messages
  };
}

function parseStoredSupportTicket(value: unknown, sessionId: string): SupportTicket | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const rawTicket = value as Partial<SupportTicket>;
  if (typeof rawTicket.ticketId !== "string") {
    return undefined;
  }

  return {
    ticketId: rawTicket.ticketId,
    sessionId,
    status: normalizeTicketStatus(rawTicket.status),
    escalationReason: typeof rawTicket.escalationReason === "string" ? rawTicket.escalationReason : "Escalation required.",
    sourcePaths: Array.isArray(rawTicket.sourcePaths)
      ? rawTicket.sourcePaths.filter((sourcePath): sourcePath is string => typeof sourcePath === "string")
      : [],
    chatwootConversationId: typeof rawTicket.chatwootConversationId === "string" ? rawTicket.chatwootConversationId : undefined,
    chatwootConversationUrl: typeof rawTicket.chatwootConversationUrl === "string" ? rawTicket.chatwootConversationUrl : undefined,
    createdAt: typeof rawTicket.createdAt === "string" ? rawTicket.createdAt : new Date().toISOString(),
    updatedAt: typeof rawTicket.updatedAt === "string" ? rawTicket.updatedAt : new Date().toISOString()
  };
}

function normalizeTicketStatus(value: unknown): SupportTicketStatus {
  if (value === "waiting_on_human" || value === "waiting_on_customer" || value === "resolved" || value === "open") {
    return value;
  }

  return "open";
}

function parseTicketStatus(value: unknown): SupportTicketStatus | undefined {
  if (value === "waiting_on_human" || value === "waiting_on_customer" || value === "resolved" || value === "open") {
    return value;
  }

  return undefined;
}

function parseStoredTranscriptMessage(value: unknown): ChatTranscriptMessage | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const rawMessage = value as Partial<ChatTranscriptMessage>;
  if (
    (rawMessage.role !== "user" && rawMessage.role !== "assistant" && rawMessage.role !== "human") ||
    typeof rawMessage.content !== "string" ||
    typeof rawMessage.createdAt !== "string"
  ) {
    return undefined;
  }

  return {
    role: rawMessage.role,
    content: rawMessage.content,
    createdAt: rawMessage.createdAt,
    escalated: rawMessage.escalated === true ? true : undefined
  };
}

function normalizeSurface(value: unknown): SupportSurface {
  if (value === "authenticated_app" || value === "flutter_webview" || value === "public_website") {
    return value;
  }

  return "public_website";
}

function normalizeKnowledgeSet(value: unknown, surface: SupportSurface): KnowledgeSet {
  if (value === "public_site" || value === "authenticated_app") {
    return value;
  }

  return surface === "authenticated_app" ? "authenticated_app" : "public_site";
}

function publicSession(session: ChatSession) {
  return {
    sessionId: session.sessionId,
    surface: session.surface,
    knowledgeSet: session.knowledgeSet,
    route: session.route,
    userId: session.userId,
    accountId: session.accountId,
    humanSupportStatus: session.humanSupportStatus,
    ticket: session.ticket ? publicSupportTicket(session.ticket) : undefined,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messageCount: session.messages.length
  };
}

function publicChatMessage(message: ChatTranscriptMessage) {
  return {
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
    escalated: message.escalated
  };
}

function publicSupportTicket(ticket: SupportTicket) {
  return {
    ticketId: ticket.ticketId,
    sessionId: ticket.sessionId,
    status: ticket.status,
    escalationReason: ticket.escalationReason,
    sourcePaths: ticket.sourcePaths,
    chatwootConversationId: ticket.chatwootConversationId,
    chatwootConversationUrl: ticket.chatwootConversationUrl,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt
  };
}

function listSupportTickets() {
  return Array.from(chatSessions.values())
    .filter((session): session is ChatSession & { ticket: SupportTicket } => Boolean(session.ticket))
    .map((session) => ({
      ...publicSupportTicket(session.ticket),
      session: publicSession(session)
    }))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function findSupportTicket(ticketId: string) {
  const session = Array.from(chatSessions.values()).find((candidate) => candidate.ticket?.ticketId === ticketId);
  if (!session?.ticket) {
    return undefined;
  }

  return {
    ...publicSupportTicket(session.ticket),
    session: publicSession(session),
    transcript: session.messages
  };
}

function updateSupportTicketStatus(ticketId: string, status: SupportTicketStatus) {
  const session = Array.from(chatSessions.values()).find((candidate) => candidate.ticket?.ticketId === ticketId);
  if (!session?.ticket) {
    return undefined;
  }

  session.ticket.status = status;
  session.ticket.updatedAt = new Date().toISOString();
  session.updatedAt = session.ticket.updatedAt;
  return {
    ...publicSupportTicket(session.ticket),
    session: publicSession(session),
    transcript: session.messages
  };
}

function findSessionByChatwootConversationId(conversationId: string) {
  return Array.from(chatSessions.values()).find(
    (candidate) => candidate.ticket?.chatwootConversationId === conversationId
  );
}

function appendHumanSupportMessage(session: ChatSession, content: string, createdAt = new Date().toISOString()) {
  const trimmedContent = content.trim();
  if (!trimmedContent) {
    return undefined;
  }

  const duplicate = session.messages.some(
    (message) => message.role === "human" && message.content === trimmedContent && message.createdAt === createdAt
  );
  if (duplicate) {
    return undefined;
  }

  const message: ChatTranscriptMessage = {
    role: "human",
    content: trimmedContent,
    createdAt
  };
  session.messages.push(message);
  session.humanSupportStatus = "escalated";
  session.updatedAt = createdAt;
  if (session.ticket) {
    session.ticket.status = session.ticket.status === "resolved" ? "open" : session.ticket.status;
    session.ticket.updatedAt = createdAt;
  }
  return message;
}

function attachChatwootConversation(session: ChatSession, conversation: ChatwootConversation) {
  if (!session.ticket) {
    return;
  }

  session.ticket.chatwootConversationId = conversation.conversationId;
  session.ticket.chatwootConversationUrl = conversation.url;
  session.ticket.updatedAt = new Date().toISOString();
  session.updatedAt = session.ticket.updatedAt;
}

async function createChatwootEscalation(
  session: ChatSession,
  supportResponse: SupportResponse
): Promise<ChatwootEscalationResult> {
  if (!supportResponse.escalated) {
    return { status: "not_needed" };
  }

  try {
    if (session.ticket?.chatwootConversationId) {
      const conversation = await chatwootProvider.getConversation(session.ticket.chatwootConversationId);
      attachChatwootConversation(session, conversation);
      return {
        status: "created",
        conversation
      };
    }

    const conversation = await chatwootProvider.createConversation({
      sessionId: session.sessionId,
      source: session.surface,
      subject: `Halosight support escalation: ${session.route ?? session.surface}`,
      escalationReason: supportResponse.escalationReason ?? "Escalation required.",
      transcript: session.messages.map((message) => ({
        role: message.role === "human" ? "system" : message.role,
        content: message.content,
        createdAt: message.createdAt
      })),
      contact: session.userId
        ? {
            identifier: session.userId
          }
        : undefined,
      customAttributes: {
        surface: session.surface,
        knowledgeSet: session.knowledgeSet,
        route: session.route,
        accountId: session.accountId
      }
    });

    return {
      status: "created",
      conversation
    };
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown Chatwoot escalation error."
    };
  }
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

function parseAllowedOrigins(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((origin) => origin.trim().replace(/\/$/, ""))
      .filter((origin) => origin.length > 0)
  );
}

async function readRawBody(request: IncomingMessage) {
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

  return Buffer.concat(chunks).toString("utf8");
}

function parseJsonBody(rawBody: string) {
  return rawBody ? (JSON.parse(rawBody) as unknown) : {};
}

async function readJsonBody(request: IncomingMessage) {
  return parseJsonBody(await readRawBody(request));
}

function writeJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.writeHead(statusCode, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload, null, 2));
}

function writeHtml(response: ServerResponse, html: string) {
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(html);
}

function buildDebugConfig() {
  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL?.trim() ?? "";
  const chatwootConfig = chatwootConfigFromEnv();
  const chatwootCredentialStatus = {
    baseUrl: Boolean(chatwootConfig.baseUrl),
    accountId: Boolean(chatwootConfig.accountId),
    inboxId: Boolean(chatwootConfig.inboxId),
    apiToken: Boolean(chatwootConfig.apiToken)
  };

  return {
    status: "ok",
    port: PORT,
    cwd: process.cwd(),
    chatClientBuilt: existsSync(path.join(chatClientDistDir, "index.html")),
    sessions: {
      activeCount: chatSessions.size,
      ticketCount: Array.from(chatSessions.values()).filter((session) => session.ticket).length,
      persistence: databasePool ? "postgres" : "local_json",
      databaseConfigured: Boolean(databasePool),
      storePath: databasePool ? null : path.relative(process.cwd(), chatSessionStorePath),
      storeExists: databasePool ? null : existsSync(chatSessionStorePath)
    },
    slack: {
      configured: Boolean(slackWebhookUrl),
      startsWithExpectedHost: slackWebhookUrl.startsWith("https://hooks.slack.com/services/"),
      last8: slackWebhookUrl ? slackWebhookUrl.slice(-8) : null,
      containsWhitespace: /\s/.test(slackWebhookUrl),
      containsDocsHost: slackWebhookUrl.includes("docs.slack.dev") || slackWebhookUrl.includes("api.slack.com"),
      looksLikeWebhook: /^https:\/\/hooks\.slack\.com\/services\/[^/\s]+\/[^/\s]+\/[^/\s]+$/.test(slackWebhookUrl)
    },
    embed: {
      allowedOriginsConfigured: supportAllowedOrigins.size > 0,
      allowedOrigins: Array.from(supportAllowedOrigins)
    },
    chatwoot: {
      mode: hasChatwootCredentials(chatwootConfig) ? "api" : "mock",
      configured: hasChatwootCredentials(chatwootConfig),
      credentials: chatwootCredentialStatus,
      webhookTokenConfigured: Boolean(process.env.CHATWOOT_WEBHOOK_TOKEN?.trim())
    }
  };
}

function getStringField(value: unknown, keys: string[]) {
  let current = value;
  for (const key of keys) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  if (typeof current === "string") {
    return current;
  }

  if (typeof current === "number") {
    return String(current);
  }

  return undefined;
}

function getBooleanField(value: unknown, keys: string[]) {
  let current = value;
  for (const key of keys) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === "boolean" ? current : undefined;
}

function parseWebhookCreatedAt(value: unknown) {
  const rawCreatedAt =
    getStringField(value, ["created_at"]) ??
    getStringField(value, ["message", "created_at"]) ??
    getStringField(value, ["createdAt"]) ??
    getStringField(value, ["message", "createdAt"]);
  if (!rawCreatedAt) {
    return new Date().toISOString();
  }

  const numericTimestamp = Number(rawCreatedAt);
  if (Number.isFinite(numericTimestamp)) {
    return new Date(numericTimestamp < 10_000_000_000 ? numericTimestamp * 1000 : numericTimestamp).toISOString();
  }

  const parsed = new Date(rawCreatedAt);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function parseChatwootHumanReply(value: unknown) {
  const messageType =
    getStringField(value, ["message_type"]) ??
    getStringField(value, ["message", "message_type"]) ??
    getStringField(value, ["messageType"]) ??
    getStringField(value, ["message", "messageType"]);
  const privateMessage =
    getBooleanField(value, ["private"]) ??
    getBooleanField(value, ["message", "private"]) ??
    getBooleanField(value, ["private_note"]) ??
    getBooleanField(value, ["message", "private_note"]) ??
    false;
  const content = getStringField(value, ["content"]) ?? getStringField(value, ["message", "content"]);
  const conversationId =
    getStringField(value, ["conversation", "id"]) ??
    getStringField(value, ["conversation_id"]) ??
    getStringField(value, ["conversation", "display_id"]) ??
    getStringField(value, ["message", "conversation_id"]);
  const outgoingMessage = messageType === "outgoing" || messageType === "1";

  if (!conversationId || !content?.trim() || !outgoingMessage || privateMessage) {
    return undefined;
  }

  return {
    conversationId,
    content,
    createdAt: parseWebhookCreatedAt(value)
  };
}

function secureCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyChatwootWebhookSignature(request: IncomingMessage, requestUrl: URL, rawBody: string) {
  const webhookSecret = process.env.CHATWOOT_WEBHOOK_TOKEN?.trim();
  if (!webhookSecret) {
    return true;
  }

  const signature = Array.isArray(request.headers["x-chatwoot-signature"])
    ? request.headers["x-chatwoot-signature"][0]
    : request.headers["x-chatwoot-signature"];
  const timestamp = Array.isArray(request.headers["x-chatwoot-timestamp"])
    ? request.headers["x-chatwoot-timestamp"][0]
    : request.headers["x-chatwoot-timestamp"];
  if (signature && timestamp) {
    const expectedSignature = `sha256=${createHmac("sha256", webhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex")}`;
    return secureCompare(expectedSignature, signature);
  }

  const legacyToken =
    request.headers["x-halosight-webhook-token"] ??
    request.headers["x-chatwoot-webhook-token"] ??
    requestUrl.searchParams.get("token");
  return legacyToken === webhookSecret;
}

async function serveChatClient(requestPath: string, response: ServerResponse, includeBody = true) {
  const relativePath =
    requestPath === "/chat-client" || requestPath === "/chat-client/"
      ? "index.html"
      : decodeURIComponent(requestPath.replace(/^\/chat-client\//, ""));
  const safePath = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(chatClientDistDir, safePath);

  if (!filePath.startsWith(chatClientDistDir)) {
    writeJson(response, 400, { error: "Invalid chat client asset path." });
    return;
  }

  try {
    const content = await readFile(filePath);
    response.writeHead(200, { "Content-Type": contentTypeFor(filePath) });
    response.end(includeBody ? content : undefined);
  } catch {
    writeJson(response, 404, {
      error: "Chat client build not found. Run npm run build:chat-client first."
    });
  }
}

function contentTypeFor(filePath: string) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".json")) return "application/json";
  return "application/octet-stream";
}

function isProtectedOpsRoute(requestPath: string) {
  return requestPath === "/tickets-view" || requestPath === "/debug/config" || requestPath === "/tickets" || requestPath.startsWith("/tickets/");
}

function requireOpsAuth(request: IncomingMessage, response: ServerResponse) {
  const username = process.env.SUPPORT_OPS_USERNAME;
  const password = process.env.SUPPORT_OPS_PASSWORD;
  if (!username || !password) {
    return true;
  }

  const header = request.headers.authorization ?? "";
  const [scheme, encodedCredentials] = header.split(" ");
  if (scheme !== "Basic" || !encodedCredentials) {
    writeAuthRequired(response);
    return false;
  }

  const credentials = Buffer.from(encodedCredentials, "base64").toString("utf8");
  const separatorIndex = credentials.indexOf(":");
  const requestUsername = credentials.slice(0, separatorIndex);
  const requestPassword = credentials.slice(separatorIndex + 1);
  if (requestUsername !== username || requestPassword !== password) {
    writeAuthRequired(response);
    return false;
  }

  return true;
}

function writeAuthRequired(response: ServerResponse) {
  response.writeHead(401, {
    "Content-Type": "application/json",
    "WWW-Authenticate": 'Basic realm="Halosight Support Ops"'
  });
  response.end(JSON.stringify({ error: "Authentication required." }, null, 2));
}

function getHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getRequestOrigin(request: IncomingMessage) {
  return getHeaderValue(request.headers.origin)?.replace(/\/$/, "");
}

function getServiceOrigin(request: IncomingMessage) {
  const host = request.headers.host;
  if (!host) {
    return undefined;
  }

  const forwardedProto = getHeaderValue(request.headers["x-forwarded-proto"]);
  const protocol = forwardedProto ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${protocol}://${host}`;
}

function isOriginAllowed(request: IncomingMessage) {
  const origin = getRequestOrigin(request);
  if (!origin) {
    return true;
  }

  if (supportAllowedOrigins.size === 0) {
    return true;
  }

  return supportAllowedOrigins.has(origin) || origin === getServiceOrigin(request);
}

function applyCorsHeaders(request: IncomingMessage, response: ServerResponse) {
  const origin = getRequestOrigin(request);
  if (!origin || !isOriginAllowed(request)) {
    return;
  }

  response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Halosight-Webhook-Token, X-Chatwoot-Webhook-Token, X-Chatwoot-Signature, X-Chatwoot-Timestamp");
  response.setHeader("Vary", "Origin");
}

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    const requestPath = requestUrl.pathname;
    applyCorsHeaders(request, response);

    if (!isOriginAllowed(request)) {
      writeJson(response, 403, { error: "Origin is not allowed." });
      return;
    }

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    if (isProtectedOpsRoute(requestPath) && !requireOpsAuth(request, response)) {
      return;
    }

    if (request.method === "GET" && (requestPath === "/" || requestPath === "/support-test")) {
      writeHtml(response, supportTestPage);
      return;
    }

    if (request.method === "GET" && requestPath === "/tickets-view") {
      writeHtml(response, ticketOpsPage);
      return;
    }

    if (
      (request.method === "GET" || request.method === "HEAD") &&
      (requestPath === "/chat-client" || requestPath.startsWith("/chat-client/"))
    ) {
      await serveChatClient(requestPath, response, request.method === "GET");
      return;
    }

    if (request.method === "GET" && requestPath === "/health") {
      writeJson(response, 200, { status: "ok" });
      return;
    }

    if (request.method === "GET" && requestPath === "/debug/config") {
      writeJson(response, 200, buildDebugConfig());
      return;
    }

    if (request.method === "GET" && requestPath === "/tickets") {
      await loadStoredChatSessions();
      writeJson(response, 200, { tickets: listSupportTickets() });
      return;
    }

    if (request.method === "GET" && requestPath === "/chat/messages") {
      await loadStoredChatSessions();
      const sessionId = requestUrl.searchParams.get("sessionId")?.trim() ?? "";
      const session = sessionId ? chatSessions.get(sessionId) : undefined;
      if (!session) {
        writeJson(response, 404, {
          error: "sessionId was not found. Create a new session with POST /chat/session before polling messages.",
          sessionId
        });
        return;
      }

      writeJson(response, 200, {
        session: publicSession(session),
        messages: session.messages.map((message) => publicChatMessage(message))
      });
      return;
    }

    if (request.method === "POST" && requestPath === "/chatwoot/webhook") {
      const rawBody = await readRawBody(request);
      if (!verifyChatwootWebhookSignature(request, requestUrl, rawBody)) {
        writeJson(response, 401, { error: "Invalid Chatwoot webhook signature." });
        return;
      }

      await loadStoredChatSessions();
      const body = parseJsonBody(rawBody);
      const humanReply = parseChatwootHumanReply(body);
      if (!humanReply) {
        writeJson(response, 202, { status: "ignored" });
        return;
      }

      const session = findSessionByChatwootConversationId(humanReply.conversationId);
      if (!session) {
        writeJson(response, 202, {
          status: "ignored",
          reason: "No local session is linked to this Chatwoot conversation.",
          conversationId: humanReply.conversationId
        });
        return;
      }

      const message = appendHumanSupportMessage(session, humanReply.content, humanReply.createdAt);
      if (message) {
        await saveChatSessions();
      }

      writeJson(response, 200, {
        status: message ? "recorded" : "duplicate",
        session: publicSession(session),
        message: message ? publicChatMessage(message) : undefined
      });
      return;
    }

    if (request.method === "GET" && requestPath.startsWith("/tickets/")) {
      await loadStoredChatSessions();
      const ticketId = decodeURIComponent(requestPath.replace(/^\/tickets\//, "")).trim();
      const ticket = findSupportTicket(ticketId);
      if (!ticket) {
        writeJson(response, 404, { error: "ticketId was not found.", ticketId });
        return;
      }

      writeJson(response, 200, { ticket });
      return;
    }

    if (request.method === "PATCH" && requestPath.startsWith("/tickets/")) {
      await loadStoredChatSessions();
      const ticketId = decodeURIComponent(requestPath.replace(/^\/tickets\//, "")).trim();
      const body = await readJsonBody(request);
      const status = parseTicketStatus((body as { status?: unknown }).status);
      if (!status) {
        writeJson(response, 400, {
          error: "status must be one of: open, waiting_on_human, waiting_on_customer, resolved."
        });
        return;
      }

      const ticket = updateSupportTicketStatus(ticketId, status);
      if (!ticket) {
        writeJson(response, 404, { error: "ticketId was not found.", ticketId });
        return;
      }

      await saveChatSessions();
      writeJson(response, 200, { ticket });
      return;
    }

    if (request.method === "POST" && requestPath === "/chat/session") {
      await loadStoredChatSessions();
      const body = await readJsonBody(request);
      const session = createChatSession(body as Record<string, unknown>);
      await saveChatSessions();
      writeJson(response, 201, { session: publicSession(session) });
      return;
    }

    if (request.method === "POST" && requestPath === "/chat/message") {
      await loadStoredChatSessions();
      const body = await readJsonBody(request);
      const message = typeof (body as { message?: unknown }).message === "string" ? (body as { message: string }).message : "";
      if (!message.trim()) {
        writeJson(response, 400, { error: "message is required." });
        return;
      }

      const sessionId = typeof (body as { sessionId?: unknown }).sessionId === "string" ? (body as { sessionId: string }).sessionId.trim() : "";
      const session = sessionId ? chatSessions.get(sessionId) : createChatSession((body as { context?: unknown }).context ?? {});
      if (!session) {
        writeJson(response, 404, {
          error: "sessionId was not found. Create a new session with POST /chat/session before sending messages.",
          sessionId
        });
        return;
      }

      const now = new Date().toISOString();
      session.messages.push({ role: "user", content: message, createdAt: now });

      const supportResponse = await answerSupportMessage(message);
      session.humanSupportStatus = supportResponse.escalated ? "escalated" : session.humanSupportStatus;
      session.updatedAt = new Date().toISOString();
      session.messages.push({
        role: "assistant",
        content: supportResponse.response,
        createdAt: session.updatedAt,
        escalated: supportResponse.escalated
      });
      const ticket = createOrUpdateSupportTicket(session, supportResponse);
      const chatwoot = await createChatwootEscalation(session, supportResponse);
      if (chatwoot.conversation) {
        attachChatwootConversation(session, chatwoot.conversation);
      }
      await saveChatSessions();

      writeJson(response, 200, {
        session: publicSession(session),
        reply: {
          role: "assistant",
          content: supportResponse.response,
          escalated: supportResponse.escalated,
          escalationReason: supportResponse.escalationReason,
          confidence: supportResponse.confidence,
          sources: supportResponse.sources,
          slackDelivery: supportResponse.slackDelivery,
          chatwoot,
          ticket: session.ticket ? publicSupportTicket(session.ticket) : ticket ? publicSupportTicket(ticket) : undefined
        }
      });
      return;
    }

    if (request.method === "POST" && requestPath === "/support") {
      const body = await readJsonBody(request);
      const message = typeof (body as { message?: unknown }).message === "string" ? (body as { message: string }).message : "";

      if (!message.trim()) {
        writeJson(response, 400, { error: "message is required." });
        return;
      }

      writeJson(response, 200, await answerSupportMessage(message));
      return;
    }

    writeJson(response, 404, { error: "Use POST /support or the /chat/session and /chat/message endpoints." });
  } catch (error) {
    writeJson(response, 500, { error: error instanceof Error ? error.message : "Unknown error." });
  }
});

server.listen(PORT, () => {
  console.log(`Halosight support agent API listening on http://localhost:${PORT}`);
  console.log("POST /support with { \"message\": \"...\" }");
});
