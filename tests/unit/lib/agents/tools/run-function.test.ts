import { runFunctionTool } from "@/lib/agents/tools/run-function";

describe("runFunctionTool", () => {
  it("invokes the approved function through a langchain tool", async () => {
    const result = await runFunctionTool.invoke({
      functionName: "get_installed_skills",
      args: {},
    });

    expect(result).toMatchObject({
      functionName: "get_installed_skills",
      ok: true,
      result: {
        skills: ["vercel-react-best-practices", "web-design-guidelines"],
      },
    });
  });
});
