import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare, Bot } from "lucide-react";
import { ExtensionPanel } from "@/components/ExtensionPanel";
import { ChatPanel } from "@/components/ChatPanel";
import { SuperAgentPanel } from "@/components/SuperAgentPanel";
import { useVsixSession } from "@/hooks/useVsixSession";
import { useModelSettings } from "@/hooks/useModelSettings";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "VSIX Runner — Mock Chat UI" },
      {
        name: "description",
        content:
          "Upload a .vsix file and chat with a mocked VS Code extension runtime. Powered by Lovable AI or your local Ollama.",
      },
      { property: "og:title", content: "VSIX Runner — Mock Chat UI" },
      {
        property: "og:description",
        content:
          "A browser-only chat interface that simulates running a VS Code extension.",
      },
    ],
  }),
});

type Tab = "chat" | "agent";

function Index() {
  const { settings, update } = useModelSettings();
  const {
    extension,
    messages,
    installLog,
    installing,
    thinking,
    installVsix,
    sendMessage,
    reset,
  } = useVsixSession(settings);
  const [tab, setTab] = useState<Tab>("chat");

  return (
    <main className="flex h-screen w-full flex-col md:flex-row">
      <ExtensionPanel
        extension={extension}
        installing={installing}
        installLog={installLog}
        onUpload={installVsix}
        onReset={reset}
        modelSettings={settings}
        onModelSettingsChange={update}
      />
      <div className="flex h-full min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-1 border-b border-border bg-card/30 px-2 pt-2">
          <TabButton active={tab === "chat"} onClick={() => setTab("chat")} icon={<MessageSquare className="h-3.5 w-3.5" />}>
            Chat
          </TabButton>
          <TabButton active={tab === "agent"} onClick={() => setTab("agent")} icon={<Bot className="h-3.5 w-3.5" />}>
            Super Agent
          </TabButton>
        </div>
        <div className="min-h-0 flex-1">
          {tab === "chat" ? (
            <ChatPanel
              extension={extension}
              messages={messages}
              onSend={sendMessage}
              thinking={thinking}
            />
          ) : (
            <SuperAgentPanel extension={extension} settings={settings} />
          )}
        </div>
      </div>
    </main>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-t-md border-b-2 px-3 py-2 text-xs font-medium transition-colors",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

