import { createFileRoute } from "@tanstack/react-router";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

type IncomingMessage = { role: "user" | "assistant"; content: string };

type ChatRequest = {
  extension?: {
    id?: string;
    displayName?: string;
    publisher?: string;
    version?: string;
    commands?: { id: string; title: string }[];
  };
  messages?: IncomingMessage[];
};

function buildSystemPrompt(ext: ChatRequest["extension"]): string {
  const name = ext?.displayName ?? "Mock Extension";
  const id = ext?.id ?? "extension";
  const publisher = ext?.publisher ?? "unknown";
  const version = ext?.version ?? "0.0.0";
  const cmds =
    ext?.commands && ext.commands.length > 0
      ? ext.commands.map((c) => `- ${c.id} — ${c.title}`).join("\n")
      : "- (no commands registered)";

  return [
    `You are roleplaying as a VS Code extension named "${name}" (${publisher}.${id}@${version}).`,
    `You are running inside a browser-based mock VS Code runtime — there is no real editor, file system, or workspace. Stay in character but be honest if asked about your nature.`,
    `Your registered commands are:\n${cmds}`,
    `Respond in concise, helpful Markdown. Use code fences for code, inline backticks for command IDs and identifiers. Keep replies focused — usually under 200 words.`,
    `When the user asks for "help", list your commands and a one-line description of each.`,
  ].join("\n\n");
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: corsHeaders }),

      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as ChatRequest;
          const messages = Array.isArray(body.messages) ? body.messages : [];
          if (messages.length === 0) {
            return new Response(
              JSON.stringify({ error: "No messages provided" }),
              {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }

          const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
          if (!LOVABLE_API_KEY) {
            return new Response(
              JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
              {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }

          const aiResponse = await fetch(
            "https://ai.gateway.lovable.dev/v1/chat/completions",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-3-flash-preview",
                messages: [
                  { role: "system", content: buildSystemPrompt(body.extension) },
                  ...messages.map((m) => ({
                    role: m.role,
                    content: String(m.content ?? ""),
                  })),
                ],
              }),
            },
          );

          if (!aiResponse.ok) {
            if (aiResponse.status === 429) {
              return new Response(
                JSON.stringify({
                  error: "Rate limits exceeded, please try again in a moment.",
                }),
                {
                  status: 429,
                  headers: {
                    ...corsHeaders,
                    "Content-Type": "application/json",
                  },
                },
              );
            }
            if (aiResponse.status === 402) {
              return new Response(
                JSON.stringify({
                  error:
                    "AI credits exhausted. Add funds to your Lovable workspace to keep chatting.",
                }),
                {
                  status: 402,
                  headers: {
                    ...corsHeaders,
                    "Content-Type": "application/json",
                  },
                },
              );
            }
            const errText = await aiResponse.text();
            console.error(
              `AI gateway error [${aiResponse.status}]: ${errText}`,
            );
            return new Response(
              JSON.stringify({ error: "AI gateway request failed" }),
              {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }

          const data = (await aiResponse.json()) as {
            choices?: { message?: { content?: string } }[];
          };
          const reply =
            data.choices?.[0]?.message?.content?.trim() ??
            "_(no reply generated)_";

          return new Response(JSON.stringify({ reply }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("chat handler error:", error);
          return new Response(
            JSON.stringify({
              error:
                error instanceof Error ? error.message : "Unknown server error",
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      },
    },
  },
});
