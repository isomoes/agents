import {
  getFunctionDefinition,
  invokeFunction,
  listFunctionDefinitions,
} from "@/lib/agents/functions/registry";

describe("function registry", () => {
  it("registers only the approved function", () => {
    const definitions = listFunctionDefinitions();

    expect(definitions).toHaveLength(1);
    expect(definitions[0]?.name).toBe("get_installed_skills");
  });

  it("reads installed skills from skills-lock.json", async () => {
    const result = await invokeFunction("get_installed_skills", {});

    expect(result.skills).toEqual([
      "vercel-react-best-practices",
      "web-design-guidelines",
    ]);
  });

  it("looks up function metadata by name", () => {
    expect(getFunctionDefinition("get_installed_skills")?.description).toMatch(
      /installed skills/i,
    );
  });
});
