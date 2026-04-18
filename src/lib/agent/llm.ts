// Provider-agnostic JSON chat call for the Super Agent.
// Routes through /api/chat (Lovable AI) or directly to Ollama, and forces JSON output.

import { chatWithOllama, type OllamaChatMessage } from "@/lib/ollama";
import type { ModelSettings } from "@/hooks/useModelSettings";

export type LlmMessage = { role: "system" | "user" | "assistant"; content: string };

export async function callJsonLLM(
  settings: ModelSettings,
  messages: LlmMessage[],
): Promise<unknown> {
  const raw = await callRawLLM(settings, messages);
  return parseJsonLoose(raw);
}

async function callRawLLM(
  settings: ModelSettings,
  messages: LlmMessage[],
): Promise<string> {
  if (settings.provider === "ollama") {
    if (!settings.ollamaModel) {
      throw new Error("No Ollama model selected");
    }
    return chatWithOllama(
      settings.ollamaUrl,
      settings.ollamaModel,
      messages as OllamaChatMessage[],
    );
  }

  // Lovable AI via the existing /api/chat route — it accepts {messages, extension?}
  // and returns {reply}. We pass a minimal extension stub since the agent supplies
  // the full system prompt itself as the first message.
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      // The route prepends its own system prompt; we put ours as a user message
      // tail-loaded with explicit JSON-only instructions. To make our system
      // truly first, we collapse it into the messages array.
      extension: { commands: [] },
      messages: messages.map((m) => ({
        role: m.role === "system" ? "user" : m.role,
        content: m.role === "system" ? `[SYSTEM]\n${m.content}` : m.content,
      })),
    }),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `LLM request failed (${res.status})`);
  }
  const data = (await res.json()) as { reply?: string };
  return data.reply ?? "";
}

// Strip ```json fences and parse, tolerating leading/trailing prose.
export function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Empty LLM response");

  // 1) direct parse
  try {
    return JSON.parse(trimmed);
  } catch {
    // continue
  }

  // 2) ```json ... ``` fenced block
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      // continue
    }
  }

  // 3) first { ... last }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) {
    try {
      return JSON.parse(trimmed.slice(first, last + 1));
    } catch {
      // continue
    }
  }

  throw new Error(`LLM did not return JSON. Got: ${trimmed.slice(0, 200)}…`);
}
