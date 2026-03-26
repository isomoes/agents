import {
  RuntimeKindSchema,
  normalizeDeepStreamChunk,
  toSingleAgentStreamEvent,
} from "@/lib/agents/types";

describe("agent types", () => {
  it("validates runtime kinds", () => {
    expect(RuntimeKindSchema.parse("single")).toBe("single");
    expect(RuntimeKindSchema.parse("deep")).toBe("deep");
  });

  it("normalizes single-agent chunks with an empty namespace", () => {
    expect(toSingleAgentStreamEvent(["updates", { step: "model" }])).toEqual([
      [],
      "updates",
      { step: "model" },
    ]);
  });

  it("preserves deep-agent namespace tuples", () => {
    const chunk = [["general-purpose"], "messages", { token: "hi" }] as const;

    expect(normalizeDeepStreamChunk(chunk)).toEqual(chunk);
  });
});
