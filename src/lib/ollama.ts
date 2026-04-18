// Ollama client — calls a locally running Ollama server directly from the browser.
// Default endpoint: http://localhost:11434
//
// IMPORTANT: For browser → Ollama to work, the user must allow CORS by starting
// Ollama with `OLLAMA_ORIGINS=*` (or a more specific origin) in the environment.

export type OllamaModel = {
  name: string;
  model: string;
  size?: number;
  modified_at?: string;
};

export type OllamaChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export const DEFAULT_OLLAMA_URL = "http://localhost:11434";

function trimUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

export async function listOllamaModels(baseUrl: string): Promise<OllamaModel[]> {
  const res = await fetch(`${trimUrl(baseUrl)}/api/tags`, { method: "GET" });
  if (!res.ok) throw new Error(`Ollama /api/tags failed (${res.status})`);
  const data = (await res.json()) as { models?: OllamaModel[] };
  return data.models ?? [];
}

export async function chatWithOllama(
  baseUrl: string,
  model: string,
  messages: OllamaChatMessage[],
): Promise<string> {
  const res = await fetch(`${trimUrl(baseUrl)}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ollama /api/chat failed (${res.status}): ${text || "no body"}`);
  }
  const data = (await res.json()) as {
    message?: { content?: string };
    error?: string;
  };
  if (data.error) throw new Error(data.error);
  return data.message?.content?.trim() ?? "";
}
