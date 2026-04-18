import { useCallback, useRef, useState } from "react";
import {
  emptyMemory,
  runAgentTurn,
  type AgentDecision,
  type AgentMemory,
} from "@/lib/agent/runner";
import type { AgentAction } from "@/lib/agent/dom";
import type { LoadedExtension } from "@/lib/mockRunner";
import type { ModelSettings } from "@/hooks/useModelSettings";

export type AgentStep = {
  id: string;
  turn: number;
  decision: AgentDecision;
  results: { action: AgentAction; ok: boolean; detail: string }[];
  toolResult?: { commandId: string; input: string; output: string };
  timestamp: number;
};

const MAX_TURNS = 10;

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function useSuperAgent(extension: LoadedExtension | null, settings: ModelSettings) {
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [goal, setGoal] = useState("");
  const memoryRef = useRef<AgentMemory | null>(null);
  const stopRef = useRef(false);

  const stop = useCallback(() => {
    stopRef.current = true;
  }, []);

  const reset = useCallback(() => {
    memoryRef.current = null;
    setSteps([]);
    setError(null);
    stopRef.current = false;
  }, []);

  const start = useCallback(
    async (taskGoal: string) => {
      const trimmed = taskGoal.trim();
      if (!trimmed || running) return;
      setGoal(trimmed);
      setError(null);
      setSteps([]);
      stopRef.current = false;
      memoryRef.current = emptyMemory(trimmed);
      setRunning(true);

      let turn = 0;
      try {
        while (turn < MAX_TURNS && !stopRef.current) {
          turn += 1;
          const memory = memoryRef.current!;
          const { decision, results, toolResult } = await runAgentTurn({
            goal: trimmed,
            memory,
            settings,
            extension,
          });

          const step: AgentStep = {
            id: makeId(),
            turn,
            decision,
            results,
            toolResult,
            timestamp: Date.now(),
          };
          setSteps((prev) => [...prev, step]);

          // Update memory
          for (const r of results) {
            if (r.ok) {
              memory.clicked.push(r.action.selector);
            } else {
              memory.failed.push({ selector: r.action.selector, reason: r.detail });
            }
          }
          memory.steps.push({
            reasoning: decision.reasoning,
            actions: decision.actions,
            result: results.map((r) => `${r.ok ? "✓" : "✗"} ${r.detail}`).join("; ") || "(no actions executed)",
          });
          if (toolResult) memory.toolResults.push(toolResult);

          if (decision.status === "task_complete" || decision.status === "need_red") break;
          if (decision.status === "action_needed" && results.length === 0) break;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setRunning(false);
      }
    },
    [extension, running, settings],
  );

  return { running, steps, error, goal, start, stop, reset };
}
