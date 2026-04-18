import { createFileRoute } from "@tanstack/react-router";
import { ExtensionPanel } from "@/components/ExtensionPanel";
import { ChatPanel } from "@/components/ChatPanel";
import { useVsixSession } from "@/hooks/useVsixSession";
import { useModelSettings } from "@/hooks/useModelSettings";

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
      <ChatPanel
        extension={extension}
        messages={messages}
        onSend={sendMessage}
        thinking={thinking}
      />
    </main>
  );
}

