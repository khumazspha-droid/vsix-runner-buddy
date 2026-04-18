import { useEffect, useState } from "react";
import { Cpu, RefreshCw, AlertCircle, CheckCircle2, Cloud } from "lucide-react";
import { listOllamaModels, type OllamaModel } from "@/lib/ollama";
import type { ModelSettings } from "@/hooks/useModelSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface ModelSettingsPanelProps {
  settings: ModelSettings;
  onChange: (patch: Partial<ModelSettings>) => void;
}

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; count: number }
  | { kind: "error"; message: string };

export function ModelSettingsPanel({ settings, onChange }: ModelSettingsPanelProps) {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [urlDraft, setUrlDraft] = useState(settings.ollamaUrl);

  useEffect(() => {
    setUrlDraft(settings.ollamaUrl);
  }, [settings.ollamaUrl]);

  async function refresh(url: string) {
    setStatus({ kind: "loading" });
    try {
      const list = await listOllamaModels(url);
      setModels(list);
      setStatus({ kind: "ok", count: list.length });
      // Auto-select first model if none chosen or current is missing
      if (list.length > 0) {
        const stillValid = settings.ollamaModel
          ? list.some((m) => m.name === settings.ollamaModel)
          : false;
        if (!stillValid) {
          onChange({ ollamaModel: list[0].name });
        }
      } else {
        onChange({ ollamaModel: null });
      }
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to reach Ollama",
      });
    }
  }

  // Auto-fetch when switching to Ollama
  useEffect(() => {
    if (settings.provider === "ollama" && status.kind === "idle") {
      refresh(settings.ollamaUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.provider]);

  return (
    <div className="rounded-lg border border-border bg-background/40 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        AI provider
      </p>

      <div className="mb-3 grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
        <button
          type="button"
          onClick={() => onChange({ provider: "lovable" })}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-colors",
            settings.provider === "lovable"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Cloud className="h-3.5 w-3.5" />
          Lovable AI
        </button>
        <button
          type="button"
          onClick={() => onChange({ provider: "ollama" })}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-colors",
            settings.provider === "ollama"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Cpu className="h-3.5 w-3.5" />
          Ollama
        </button>
      </div>

      {settings.provider === "ollama" && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ollama-url" className="text-[11px] text-muted-foreground">
              Ollama base URL
            </Label>
            <div className="flex gap-1.5">
              <Input
                id="ollama-url"
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                onBlur={() => {
                  if (urlDraft !== settings.ollamaUrl) {
                    onChange({ ollamaUrl: urlDraft });
                    refresh(urlDraft);
                  }
                }}
                placeholder="http://localhost:11434"
                className="h-8 font-mono text-xs"
              />
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8 shrink-0"
                onClick={() => refresh(urlDraft)}
                disabled={status.kind === "loading"}
                title="Refresh model list"
              >
                <RefreshCw
                  className={cn("h-3.5 w-3.5", status.kind === "loading" && "animate-spin")}
                />
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Model</Label>
            <Select
              value={settings.ollamaModel ?? ""}
              onValueChange={(v) => onChange({ ollamaModel: v })}
              disabled={models.length === 0}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue
                  placeholder={
                    status.kind === "loading"
                      ? "Loading models…"
                      : models.length === 0
                        ? "No models found"
                        : "Select a model"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m.name} value={m.name} className="font-mono text-xs">
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {status.kind === "ok" && (
            <p className="flex items-center gap-1.5 text-[11px] text-terminal-success">
              <CheckCircle2 className="h-3 w-3" />
              {status.count} model{status.count === 1 ? "" : "s"} available
            </p>
          )}
          {status.kind === "error" && (
            <div className="flex items-start gap-1.5 rounded border border-destructive/40 bg-destructive/10 p-2 text-[11px] text-destructive">
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
              <div className="min-w-0">
                <p className="font-medium">Can't reach Ollama</p>
                <p className="mt-0.5 break-words opacity-80">{status.message}</p>
                <p className="mt-1 opacity-70">
                  Run <code className="font-mono">OLLAMA_ORIGINS=* ollama serve</code> to allow
                  browser requests.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
