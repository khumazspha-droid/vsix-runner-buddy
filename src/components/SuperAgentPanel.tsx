import { useState, type FormEvent } from "react";
import { Bot, Play, Square, RotateCcw, AlertCircle, CheckCircle2, XCircle, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useSuperAgent } from "@/hooks/useSuperAgent";
import type { LoadedExtension } from "@/lib/mockRunner";
import type { ModelSettings } from "@/hooks/useModelSettings";
import { cn } from "@/lib/utils";

interface SuperAgentPanelProps {
  extension: LoadedExtension | null;
  settings: ModelSettings;
}

export function SuperAgentPanel({ extension, settings }: SuperAgentPanelProps) {
  const { running, steps, error, goal, start, stop, reset } = useSuperAgent(extension, settings);
  const [input, setInput] = useState("");

  const providerLabel =
    settings.provider === "ollama"
      ? settings.ollamaModel
        ? `Ollama · ${settings.ollamaModel}`
        : "Ollama (no model selected)"
      : "Lovable AI";

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || running) return;
    start(text);
  }

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border bg-card/50 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Bot className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">Super Agent</h2>
          <p className="truncate font-mono text-[11px] text-muted-foreground">
            {providerLabel}
            {extension ? ` · armed with ${extension.commands.length} VSIX tool${extension.commands.length === 1 ? "" : "s"}` : " · no VSIX loaded"}
          </p>
        </div>
        {running && (
          <Badge className="bg-primary/20 text-primary hover:bg-primary/20">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            running
          </Badge>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {steps.length === 0 && !running && !error && <EmptyState extension={extension} />}

          {goal && (
            <div className="rounded-lg border border-border bg-card/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Goal
              </p>
              <p className="mt-1 text-sm">{goal}</p>
            </div>
          )}

          {steps.map((step) => (
            <StepCard key={step.id} step={step} />
          ))}

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Agent error</p>
                <p className="mt-0.5 break-words text-xs opacity-90">{error}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="border-t border-border bg-card/50 px-4 py-3">
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
            placeholder='Describe a task — e.g. "Switch to the Chat tab and send hello"'
            disabled={running}
            rows={2}
            className="max-h-40 min-h-12 resize-none bg-background"
          />
          {running ? (
            <Button type="button" size="icon" variant="destructive" onClick={stop} title="Stop">
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" size="icon" disabled={!input.trim()} title="Run agent">
              <Play className="h-4 w-4" />
            </Button>
          )}
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => {
              reset();
              setInput("");
            }}
            disabled={running}
            title="Reset"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
        <p className="mx-auto mt-2 max-w-3xl text-[11px] text-muted-foreground">
          Agent acts on this page's live DOM. {extension ? "VSIX commands are exposed as tools." : "Load a VSIX to give the agent extra tools."}
        </p>
      </form>
    </section>
  );
}

function StepCard({
  step,
}: {
  step: ReturnType<typeof useSuperAgent>["steps"][number];
}) {
  const { decision, results, toolResult } = step;
  const statusColor =
    decision.status === "task_complete"
      ? "bg-terminal-success/20 text-terminal-success"
      : decision.status === "need_red"
        ? "bg-destructive/20 text-destructive"
        : "bg-primary/15 text-primary";

  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Badge variant="outline" className="font-mono text-[10px]">
          turn {step.turn}
        </Badge>
        <Badge className={cn("font-mono text-[10px]", statusColor)}>{decision.status}</Badge>
        <span className="ml-auto text-[10px] text-muted-foreground">
          confidence {(decision.confidence ?? 0).toFixed(2)}
        </span>
      </div>

      <p className="text-sm">{decision.reasoning || <em className="opacity-60">(no reasoning)</em>}</p>

      {toolResult && (
        <div className="mt-2 rounded-md border border-border bg-background/40 p-2">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Wrench className="h-3 w-3" />
            tool · <span className="font-mono normal-case">{toolResult.commandId}</span>
          </div>
          <p className="font-mono text-[11px] opacity-80">input: {toolResult.input || <em>(empty)</em>}</p>
          <p className="mt-1 whitespace-pre-wrap text-[12px]">{toolResult.output}</p>
        </div>
      )}

      {decision.actions.length > 0 && (
        <ul className="mt-2 space-y-1">
          {decision.actions.map((a, i) => {
            const r = results[i];
            return (
              <li
                key={i}
                className="flex items-start gap-2 rounded-md bg-background/40 px-2 py-1.5 font-mono text-[11px]"
              >
                {r ? (
                  r.ok ? (
                    <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-terminal-success" />
                  ) : (
                    <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-destructive" />
                  )
                ) : (
                  <span className="mt-0.5 h-3 w-3 shrink-0 rounded-full border border-muted-foreground/40" />
                )}
                <div className="min-w-0 flex-1">
                  <span className="font-semibold">{a.type}</span>{" "}
                  <span className="opacity-80">{a.selector}</span>
                  {a.value !== undefined && <span className="opacity-60"> = "{a.value}"</span>}
                  {r && <p className="mt-0.5 whitespace-pre-wrap opacity-70">{r.detail}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function EmptyState({ extension }: { extension: LoadedExtension | null }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Bot className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-semibold">Super Autonomous Web Agent</h3>
      <p className="text-sm text-muted-foreground">
        Give me a goal and I'll perceive this page's DOM, reason step-by-step, and act —
        clicking, typing, selecting until the task is done.
      </p>
      {extension ? (
        <p className="text-xs text-muted-foreground">
          Empowered by <span className="font-mono text-foreground">{extension.displayName}</span>{" "}
          — its {extension.commands.length} command{extension.commands.length === 1 ? "" : "s"} are
          available as tools I can call.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Tip: load a VSIX in the sidebar to give me extra tools.
        </p>
      )}
    </div>
  );
}
