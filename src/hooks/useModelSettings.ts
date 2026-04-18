import { useCallback, useEffect, useState } from "react";
import { DEFAULT_OLLAMA_URL } from "@/lib/ollama";

export type ChatProvider = "lovable" | "ollama";

export type ModelSettings = {
  provider: ChatProvider;
  ollamaUrl: string;
  ollamaModel: string | null;
};

const STORAGE_KEY = "vsix-runner.model-settings.v1";

const DEFAULT_SETTINGS: ModelSettings = {
  provider: "lovable",
  ollamaUrl: DEFAULT_OLLAMA_URL,
  ollamaModel: null,
};

function load(): ModelSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<ModelSettings>;
    return {
      provider: parsed.provider === "ollama" ? "ollama" : "lovable",
      ollamaUrl: parsed.ollamaUrl?.trim() || DEFAULT_OLLAMA_URL,
      ollamaModel: parsed.ollamaModel ?? null,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function useModelSettings() {
  const [settings, setSettings] = useState<ModelSettings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSettings(load());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore quota errors
    }
  }, [settings, hydrated]);

  const update = useCallback((patch: Partial<ModelSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  return { settings, update, hydrated };
}
