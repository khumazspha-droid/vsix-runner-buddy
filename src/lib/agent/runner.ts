// Super Agent — perceive → understand → decide → act → learn.
// Powered by whichever AI provider the user has selected (Lovable AI or Ollama).
// VSIX-registered commands are exposed to the agent as callable tools.

import { snapshotPage, executeAction, type AgentAction, type DomSnapshot } from "@/lib/agent/dom";
import { callJsonLLM, type LlmMessage } from "@/lib/agent/llm";
import { runCommand, type LoadedExtension } from "@/lib/mockRunner";
import type { ModelSettings } from "@/hooks/useModelSettings";

export type AgentStatus = "action_needed" | "navigation_needed" | "task_complete" | "need_red";

export type AgentDecision = {
  status: AgentStatus;
  confidence: number;
  actions: AgentAction[];
  reasoning: string;
  // Optional VSIX tool invocation
  tool?: { commandId: string; input: string };
};

export type AgentMemory = {
  goal: string;
  clicked: string[];
  failed: { selector: string; reason: string }[];
  steps: { reasoning: string; actions: AgentAction[]; result: string }[];
  toolResults: { commandId: string; input: string; output: string }[];
};

export function emptyMemory(goal: string): AgentMemory {
  return { goal, clicked: [], failed: [], steps: [], toolResults: [] };
}

function buildSystemPrompt(extension: LoadedExtension | null): string {
  const cmds =
    extension && extension.commands.length > 0
      ? extension.commands.map((c) => `- ${c.id} — ${c.title}`).join("\n")
      : "- (no VSIX extension loaded — no tools available)";

  const ext = extension
    ? `\nYou are EMPOWERED by the VSIX extension "${extension.displayName}" (${extension.publisher}.${extension.id}@${extension.version}). Its registered commands are exposed to you as TOOLS you may invoke each turn:\n${cmds}\n\nTo call a tool, set "tool": {"commandId": "<id>", "input": "<text>"} in your JSON. The tool's output is fed back to you on the next turn under memory.toolResults. Use tools when they could help reason about the page, transform data, or summarize state. Skip "tool" when no tool is useful.`
    : `\nNo VSIX extension is currently loaded, so no extension tools are available — rely on direct DOM actions only.`;

  return `You are a Super Autonomous Web Agent.

Your purpose is to intelligently perceive, understand, and interact with any website in real time to complete user tasks with high accuracy and minimal steps.

You are not a simple assistant. You are an adaptive system that combines perception, reasoning, memory, and action.

CORE LOOP
1. PERCEIVE — Read the structured DOM interaction map provided each turn.
2. UNDERSTAND — Match the user's goal to available UI elements (buttons, inputs, links, dropdowns, grids, symbols ▼ → ✔).
3. DECIDE — Choose the NEXT BEST ACTION only (not a full plan). Avoid repeated/failed actions.
4. ACT — Return precise, minimal actions: click | type | fill | select | submit.
5. LEARN — Memory of successful and failed actions is preserved between turns.

SELECTOR PRIORITY (best to worst)
1. id  →  "#submit-btn"
2. name  →  "[name=email]"
3. placeholder  →  the literal placeholder text
4. visible text  →  "Sign in"
5. ref index from the snapshot  →  "ref:12"

UI INTELLIGENCE — understand grids (act within the same row), dropdowns (open then select), hidden UI (reveal via hover/scroll), and symbols (▼ = dropdown, → = next, ✔ = confirm).

FALLBACK — if no clear action: try alternatives, use grid relationships, reveal hidden UI, use semantic meaning, then visual reasoning as last resort.

MEMORY RULES — never repeat a failed action with the same selector. Avoid re-clicking the same element unnecessarily. Build on previous progress.
${ext}

OUTPUT FORMAT — STRICT JSON ONLY, no prose, no markdown, no code fences:
{
  "status": "action_needed" | "navigation_needed" | "task_complete" | "need_red",
  "confidence": <number 0-1>,
  "actions": [
    { "type": "click" | "type" | "fill" | "select" | "submit", "selector": "string", "value": "optional string" }
  ],
  "reasoning": "one short sentence",
  "tool": { "commandId": "string", "input": "string" }   // OPTIONAL — omit if not using a tool
}

CRITICAL RULES
- NEVER output text outside the JSON object.
- NEVER hallucinate elements not present in the snapshot.
- ALWAYS prefer visible, high-confidence elements.
- ALWAYS minimize the number of actions per turn (1-2 max).
- ALWAYS adapt if previous actions failed.

Behave like a real human: observant, adaptive, efficient, accurate.`;
}

function trimSnapshotForPrompt(snap: DomSnapshot, max = 80): DomSnapshot {
  return { ...snap, elements: snap.elements.slice(0, max) };
}

function buildTurnUserMessage(snapshot: DomSnapshot, memory: AgentMemory): string {
  const trimmed = trimSnapshotForPrompt(snapshot);
  const recentSteps = memory.steps.slice(-4).map((s, i) => ({
    step: memory.steps.length - recentSlice(memory.steps, 4) + i + 1,
    reasoning: s.reasoning,
    actions: s.actions,
    result: s.result,
  }));
  const recentTools = memory.toolResults.slice(-3);

  const payload = {
    goal: memory.goal,
    page: { url: snapshot.url, title: snapshot.title, totalElements: snapshot.elements.length },
    interactionMap: trimmed.elements,
    memory: {
      stepsTaken: memory.steps.length,
      failedSelectors: memory.failed.slice(-8),
      recentSteps,
      recentToolResults: recentTools,
    },
  };
  return JSON.stringify(payload, null, 2);
}

function recentSlice<T>(arr: T[], n: number): number {
  return Math.min(arr.length, n);
}

function isDecision(value: unknown): value is AgentDecision {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.status !== "string") return false;
  if (!Array.isArray(v.actions)) return false;
  return true;
}

export async function runAgentTurn(params: {
  goal: string;
  memory: AgentMemory;
  settings: ModelSettings;
  extension: LoadedExtension | null;
}): Promise<{
  decision: AgentDecision;
  snapshot: DomSnapshot;
  results: { action: AgentAction; ok: boolean; detail: string }[];
  toolResult?: { commandId: string; input: string; output: string };
}> {
  const snapshot = snapshotPage();
  const messages: LlmMessage[] = [
    { role: "system", content: buildSystemPrompt(params.extension) },
    { role: "user", content: buildTurnUserMessage(snapshot, params.memory) },
  ];

  const raw = await callJsonLLM(params.settings, messages);
  if (!isDecision(raw)) {
    throw new Error(`Agent returned invalid JSON shape: ${JSON.stringify(raw).slice(0, 200)}`);
  }
  const decision = raw;

  // Run tool first (if any, and extension is loaded) so the result can be fed back next turn.
  let toolResult: { commandId: string; input: string; output: string } | undefined;
  if (decision.tool && params.extension) {
    const valid = params.extension.commands.some((c) => c.id === decision.tool!.commandId);
    if (valid) {
      const output = runCommand(params.extension, decision.tool.commandId, decision.tool.input ?? "");
      toolResult = { commandId: decision.tool.commandId, input: decision.tool.input ?? "", output };
    } else {
      toolResult = {
        commandId: decision.tool.commandId,
        input: decision.tool.input ?? "",
        output: `⚠️ Unknown command "${decision.tool.commandId}" — not registered by this extension.`,
      };
    }
  }

  // Execute DOM actions (cap at 3 per turn for safety).
  const results: { action: AgentAction; ok: boolean; detail: string }[] = [];
  if (decision.status === "action_needed") {
    for (const action of decision.actions.slice(0, 3)) {
      const r = executeAction(action);
      results.push({ action, ok: r.ok, detail: r.detail });
      if (!r.ok) break;
      // Small yield so the page can react before the next action.
      await new Promise((res) => setTimeout(res, 120));
    }
  }

  return { decision, snapshot, results, toolResult };
}
