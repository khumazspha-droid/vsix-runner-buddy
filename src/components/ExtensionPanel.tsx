import { useRef, useState } from "react";
import { Upload, Trash2, Package, Terminal, CheckCircle2 } from "lucide-react";
import type { InstallLogLine, LoadedExtension } from "@/lib/mockRunner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ModelSettingsPanel } from "@/components/ModelSettingsPanel";
import type { ModelSettings } from "@/hooks/useModelSettings";
import { cn } from "@/lib/utils";

interface ExtensionPanelProps {
  extension: LoadedExtension | null;
  installing: boolean;
  installLog: InstallLogLine[];
  onUpload: (file: File) => void;
  onReset: () => void;
  modelSettings: ModelSettings;
  onModelSettingsChange: (patch: Partial<ModelSettings>) => void;
}

export function ExtensionPanel({
  extension,
  installing,
  installLog,
  onUpload,
  onReset,
  modelSettings,
  onModelSettingsChange,
}: ExtensionPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) onUpload(file);
  }

  return (
    <aside className="flex h-full w-full flex-col gap-4 border-r border-border bg-card p-4 md:w-80">
      <header className="flex items-center gap-2">
        <Package className="h-5 w-5 text-primary" />
        <h1 className="text-base font-semibold">VSIX Runner</h1>
        <Badge variant="secondary" className="ml-auto font-mono text-[10px]">
          mock
        </Badge>
      </header>

      <input
        ref={fileRef}
        type="file"
        accept=".vsix"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {!extension && !installing && (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground",
            dragOver && "border-primary bg-accent text-foreground",
          )}
        >
          <Upload className="h-6 w-6" />
          <span className="font-medium">Drop a .vsix file</span>
          <span className="text-xs">or click to browse</span>
        </button>
      )}

      {extension && (
        <div className="rounded-lg border border-border bg-background/40 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{extension.displayName}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {extension.publisher}.{extension.id}@{extension.version}
              </p>
            </div>
            <Badge className="shrink-0 bg-terminal-success/20 text-terminal-success hover:bg-terminal-success/20">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              active
            </Badge>
          </div>
          <p className="mt-2 truncate text-[11px] text-muted-foreground">
            {extension.fileName} · {(extension.fileSizeBytes / 1024).toFixed(1)} KB
          </p>
        </div>
      )}

      {extension && (
        <div className="flex min-h-0 flex-1 flex-col">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Registered commands
          </p>
          <ul className="space-y-1">
            {extension.commands.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-2 rounded-md bg-background/40 px-2 py-1.5"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-terminal-success" />
                <span className="truncate font-mono text-xs">{c.id}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(installing || installLog.length > 0) && (
        <div className="flex min-h-0 flex-col">
          <div className="mb-2 flex items-center gap-2">
            <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Install log
            </p>
          </div>
          <ScrollArea className="h-40 rounded-md border border-border bg-terminal p-2">
            <div className="space-y-0.5 font-mono text-[11px] leading-relaxed">
              {installLog.map((line, i) => (
                <div
                  key={i}
                  className={cn(
                    line.kind === "success" && "text-terminal-success",
                    line.kind === "info" && "text-terminal-foreground",
                    line.kind === "muted" && "text-terminal-muted",
                  )}
                >
                  {line.text}
                </div>
              ))}
              {installing && (
                <div className="terminal-cursor text-terminal-foreground" />
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      <div className="mt-auto flex gap-2">
        {extension && (
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            Replace
          </Button>
        )}
        {extension && (
          <Button variant="ghost" size="sm" className="flex-1" onClick={onReset}>
            <Trash2 className="h-3.5 w-3.5" />
            Reset
          </Button>
        )}
      </div>
    </aside>
  );
}
