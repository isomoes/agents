import { createRuntimeEnv } from "@/lib/env";

describe("createRuntimeEnv", () => {
  it("defaults to single-agent mode", () => {
    const env = createRuntimeEnv({ AGENT_MODEL: "openai:gpt-5.4-mini" });

    expect(env.runtimeMode).toBe("single");
    expect(env.model).toBe("openai:gpt-5.4-mini");
  });

  it("enables deep-agent mode behind the flag", () => {
    const env = createRuntimeEnv({
      AGENT_MODEL: "openai:gpt-5.4-mini",
      DEEPAGENTS_ENABLE_DEEP_MODE: "true",
    });

    expect(env.runtimeMode).toBe("deep");
  });

  it("rejects a missing model", () => {
    expect(() => createRuntimeEnv({})).toThrow(/AGENT_MODEL/i);
  });
});
