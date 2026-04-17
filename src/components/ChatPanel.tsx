import { useEffect, useRef, useState, type FormEvent } from "react";
import { Send, Bot, User, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Markdown } from "@/lib/markdown";
import { cn } from "@/lib/utils";
import type { LoadedExtension } from "@/lib/mockRunner";

export type ChatMessage = {
  id: string;
  role: "user" | "bot";
  content: string;
  commandId?: string;
  timestamp: number;
};

interface ChatPanelProps {
  extension: LoadedExtension | null;
  messages: ChatMessage[];
  onSend: (text: string) => void;
  thinking: boolean;
}

export function ChatPanel({ extension, messages, onSend, thinking }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, thinking]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !extension || thinking) return;
    onSend(text);
    setInput("");
  }

  const disabled = !extension;

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border bg-card/50 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Bot className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">
            {extension ? extension.displayName : "No extension loaded"}
          </h2>
          <p className="truncate font-mono text-[11px] text-muted-foreground">
            {extension
              ? `${extension.commands[0]?.id ?? "—"} · mock runtime`
              : "Upload a .vsix to start"}
          </p>
        </div>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 ? (
          <EmptyState extension={extension} />
        ) : (
          <ul className="mx-auto flex max-w-3xl flex-col gap-4">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {thinking && (
              <li className="flex items-start gap-3">
                <Avatar role="bot" />
                <div className="rounded-2xl rounded-tl-sm bg-bot-bubble px-4 py-3 text-bot-bubble-foreground">
                  <span className="inline-flex gap-1">
                    <Dot delay="0ms" />
                    <Dot delay="120ms" />
                    <Dot delay="240ms" />
                  </span>
                </div>
              </li>
            )}
          </ul>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-border bg-card/50 px-4 py-3"
      >
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as unknown as FormEvent);
              }
            }}
            placeholder={
              disabled
                ? "Install a .vsix to enable chat…"
                : "Message the extension… (Enter to send, Shift+Enter for newline)"
            }
            disabled={disabled || thinking}
            rows={1}
            className="max-h-40 min-h-10 resize-none bg-background"
          />
          <Button type="submit" disabled={disabled || thinking || !input.trim()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="mx-auto mt-2 max-w-3xl text-[11px] text-muted-foreground">
          Replies are generated locally — no server, no real extension code is executed.
        </p>
      </form>
    </section>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
      style={{ animationDelay: delay }}
    />
  );
}

function Avatar({ role }: { role: "user" | "bot" }) {
  return (
    <div
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
        role === "user"
          ? "bg-user-bubble text-user-bubble-foreground"
          : "bg-primary/15 text-primary",
      )}
    >
      {role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <li className={cn("flex items-start gap-3", isUser && "flex-row-reverse")}>
      <Avatar role={message.role} />
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5",
          isUser
            ? "rounded-tr-sm bg-user-bubble text-user-bubble-foreground"
            : "rounded-tl-sm bg-bot-bubble text-bot-bubble-foreground",
        )}
      >
        {message.commandId && !isUser && (
          <p className="mb-1 font-mono text-[10px] uppercase tracking-wider opacity-60">
            via {message.commandId}
          </p>
        )}
        <Markdown source={message.content} />
      </div>
    </li>
  );
}

function EmptyState({ extension }: { extension: LoadedExtension | null }) {
  return (
    <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-3 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Sparkles className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-semibold">
        {extension ? "Say hello to get started" : "Install a .vsix to begin"}
      </h3>
      <p className="text-sm text-muted-foreground">
        {extension
          ? `Try "hello", "help", "ping", or "echo your text". Messages are routed to ${extension.commands[0]?.id}.`
          : "Drop a .vsix file in the panel on the left. We'll fake the install and register a few demo commands."}
      </p>
    </div>
  );
}
