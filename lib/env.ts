import "server-only";

import { z } from "zod";

const truthyValues = new Set(["1", "true", "yes", "on"]);

const RuntimeEnvSchema = z.object({
  AGENT_MODEL: z
    .string()
    .trim()
    .min(1, "AGENT_MODEL is required to create an agent runtime."),
  DEEPAGENTS_ENABLE_DEEP_MODE: z.string().optional(),
});

export type RuntimeEnv = {
  model: string;
  deepModeEnabled: boolean;
  runtimeMode: "single" | "deep";
};

export function createRuntimeEnv(source: Record<string, string | undefined> = process.env): RuntimeEnv {
  const parsed = RuntimeEnvSchema.parse({
    AGENT_MODEL: source.AGENT_MODEL,
    DEEPAGENTS_ENABLE_DEEP_MODE: source.DEEPAGENTS_ENABLE_DEEP_MODE,
  });

  const deepModeEnabled = truthyValues.has(
    parsed.DEEPAGENTS_ENABLE_DEEP_MODE?.toLowerCase() ?? "",
  );

  return {
    model: parsed.AGENT_MODEL,
    deepModeEnabled,
    runtimeMode: deepModeEnabled ? "deep" : "single",
  };
}
