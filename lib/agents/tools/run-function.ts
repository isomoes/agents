import "server-only";

import { tool } from "langchain";
import { z } from "zod";

import { invokeFunction } from "@/lib/agents/functions/registry";

export const RunFunctionInputSchema = z.object({
  functionName: z.literal("get_installed_skills").describe("The approved function to execute."),
  args: z.record(z.string(), z.unknown()).default({}).describe("JSON arguments for the function."),
});

export const runFunctionTool = tool(
  async ({ functionName, args }) => ({
    functionName,
    ok: true,
    result: await invokeFunction(functionName, args),
  }),
  {
    name: "run_function",
    description: "Run one approved server-side function from the MVP registry.",
    schema: RunFunctionInputSchema,
  },
);
