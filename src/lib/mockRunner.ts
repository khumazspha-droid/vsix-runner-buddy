// Mock VSIX runner — simulates extension installation & a tiny command registry.
// Everything is purely client-side; no real extension code is executed.

export type InstallLogLine = {
  text: string;
  kind: "info" | "success" | "muted";
};

export type RegisteredCommand = {
  id: string;
  title: string;
};

export type LoadedExtension = {
  id: string;
  displayName: string;
  publisher: string;
  version: string;
  fileName: string;
  fileSizeBytes: number;
  installedAt: number;
  commands: RegisteredCommand[];
};

const PUBLISHERS = ["acme", "lovable", "openlab", "pixelworks", "neon"];
const VERSIONS = ["0.1.0", "0.4.2", "1.0.0", "1.2.3", "2.0.1"];

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function deriveExtensionIdFromFile(fileName: string): {
  id: string;
  displayName: string;
} {
  const base = fileName.replace(/\.vsix$/i, "").replace(/[_\s]+/g, "-");
  const id = base.toLowerCase().replace(/[^a-z0-9-]/g, "") || "extension";
  const displayName = base
    .split("-")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ") || "Extension";
  return { id, displayName };
}

export function buildMockExtension(file: { name: string; size: number }): LoadedExtension {
  const { id, displayName } = deriveExtensionIdFromFile(file.name);
  const seed = hashString(id);
  const commands: RegisteredCommand[] = [
    { id: `${id}.ask`, title: `${displayName}: Ask` },
    { id: `${id}.help`, title: `${displayName}: Help` },
    { id: `${id}.reset`, title: `${displayName}: Reset Session` },
  ];
  return {
    id,
    displayName,
    publisher: pick(PUBLISHERS, seed),
    version: pick(VERSIONS, seed >> 3),
    fileName: file.name,
    fileSizeBytes: file.size,
    installedAt: Date.now(),
    commands,
  };
}

export function buildInstallLog(ext: LoadedExtension): InstallLogLine[] {
  const sizeKB = Math.max(1, Math.round(ext.fileSizeBytes / 1024));
  return [
    { text: `$ vsix install ${ext.fileName}`, kind: "muted" },
    { text: `Reading archive (${sizeKB} KB)...`, kind: "info" },
    { text: `Extracting extension/...`, kind: "info" },
    { text: `Loading package.json...`, kind: "info" },
    { text: `Resolved ${ext.publisher}.${ext.id}@${ext.version}`, kind: "info" },
    { text: `Injecting vscode mock runtime...`, kind: "info" },
    { text: `Activating extension...`, kind: "info" },
    ...ext.commands.map<InstallLogLine>((c) => ({
      text: `Registered command: ${c.id}`,
      kind: "success",
    })),
    { text: `✓ Extension activated. Ready to chat.`, kind: "success" },
  ];
}

// --- Mock chat command engine ---------------------------------------------

function formatCommands(ext: LoadedExtension): string {
  return ext.commands.map((c) => `- \`${c.id}\` — ${c.title}`).join("\n");
}

export function runCommand(
  ext: LoadedExtension,
  commandId: string,
  input: string,
): string {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();

  // Built-in canned responses
  if (!trimmed) {
    return "_(empty input — try saying hello)_";
  }
  if (/^(hi|hello|hey|yo)\b/.test(lower)) {
    return `**hi there** 👋 — I'm \`${ext.id}\` running in mock mode. Type \`help\` to see what I can do.`;
  }
  if (lower === "help" || lower === "/help") {
    return `Here are the commands registered by **${ext.displayName}**:\n\n${formatCommands(ext)}\n\nThis is a mocked runtime — replies are generated locally in your browser.`;
  }
  if (lower === "ping") {
    return "pong 🏓";
  }
  if (lower.startsWith("echo ")) {
    return trimmed.slice(5);
  }
  if (/(who are you|what are you|about)/.test(lower)) {
    return `I'm a mock of **${ext.displayName}** (\`${ext.publisher}.${ext.id}@${ext.version}\`). No real VS Code extension is being executed — this is a UI simulation.`;
  }
  if (/(time|date|now)/.test(lower)) {
    return `Local time is **${new Date().toLocaleString()}**.`;
  }

  // Default: simulate a command-like response
  const wordCount = trimmed.split(/\s+/).length;
  return `\`${commandId}\` received your message (${wordCount} word${wordCount === 1 ? "" : "s"}).\n\n> ${trimmed}\n\n_This is a mocked reply. Wire up a real backend to make it smarter._`;
}
