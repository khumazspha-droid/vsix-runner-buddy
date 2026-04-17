import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildInstallLog,
  buildMockExtension,
  runCommand,
  type InstallLogLine,
  type LoadedExtension,
} from "@/lib/mockRunner";
import type { ChatMessage } from "@/components/ChatPanel";

const STORAGE_KEY = "vsix-runner.session.v1";

type Persisted = {
  extension: LoadedExtension | null;
  messages: ChatMessage[];
  installLog: InstallLogLine[];
};

function loadPersisted(): Persisted {
  if (typeof window === "undefined") {
    return { extension: null, messages: [], installLog: [] };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { extension: null, messages: [], installLog: [] };
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      extension: parsed.extension ?? null,
      messages: parsed.messages ?? [],
      installLog: parsed.installLog ?? [],
    };
  } catch {
    return { extension: null, messages: [], installLog: [] };
  }
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useVsixSession() {
  const [extension, setExtension] = useState<LoadedExtension | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [installLog, setInstallLog] = useState<InstallLogLine[]>([]);
  const [installing, setInstalling] = useState(false);
  const [thinking, setThinking] = useState(false);
  const hydrated = useRef(false);

  // Hydrate from localStorage on mount (client-only)
  useEffect(() => {
    const persisted = loadPersisted();
    setExtension(persisted.extension);
    setMessages(persisted.messages);
    setInstallLog(persisted.installLog);
    hydrated.current = true;
  }, []);

  // Persist whenever core state changes
  useEffect(() => {
    if (!hydrated.current || typeof window === "undefined") return;
    const payload: Persisted = { extension, messages, installLog };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore quota errors
    }
  }, [extension, messages, installLog]);

  const installVsix = useCallback(async (file: File) => {
    setInstalling(true);
    setExtension(null);
    setMessages([]);
    setInstallLog([]);

    const ext = buildMockExtension({ name: file.name, size: file.size });
    const log = buildInstallLog(ext);

    // Stream log lines for a terminal-like effect
    for (let i = 0; i < log.length; i++) {
      await new Promise((r) => setTimeout(r, 220 + Math.random() * 180));
      setInstallLog((prev) => [...prev, log[i]]);
    }

    setExtension(ext);
    setInstalling(false);

    // Bot greeting
    setMessages([
      {
        id: makeId(),
        role: "bot",
        commandId: ext.commands[0]?.id,
        content: `**${ext.displayName}** is now active. Type \`help\` to see what I can do.`,
        timestamp: Date.now(),
      },
    ]);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!extension) return;
      const userMsg: ChatMessage = {
        id: makeId(),
        role: "user",
        content: text,
        timestamp: Date.now(),
      };
      const nextMessages = [...messages, userMsg];
      setMessages(nextMessages);
      setThinking(true);

      const commandId = extension.commands[0]?.id ?? `${extension.id}.ask`;

      let replyContent: string;
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            extension: {
              id: extension.id,
              displayName: extension.displayName,
              publisher: extension.publisher,
              version: extension.version,
              commands: extension.commands,
            },
            messages: nextMessages.map((m) => ({
              role: m.role === "bot" ? "assistant" : "user",
              content: m.content,
            })),
          }),
        });

        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          replyContent = `⚠️ ${errBody.error ?? `Request failed (${res.status})`}\n\n_Falling back to mock reply:_\n\n${runCommand(extension, commandId, text)}`;
        } else {
          const data = (await res.json()) as { reply?: string };
          replyContent = data.reply?.trim() || runCommand(extension, commandId, text);
        }
      } catch (err) {
        console.error("chat request failed", err);
        replyContent = `⚠️ Network error — using mock fallback.\n\n${runCommand(extension, commandId, text)}`;
      }

      const botMsg: ChatMessage = {
        id: makeId(),
        role: "bot",
        commandId,
        content: replyContent,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, botMsg]);
      setThinking(false);
    },
    [extension, messages],
  );

  const reset = useCallback(() => {
    setExtension(null);
    setMessages([]);
    setInstallLog([]);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  }, []);

  return {
    extension,
    messages,
    installLog,
    installing,
    thinking,
    installVsix,
    sendMessage,
    reset,
  };
}
