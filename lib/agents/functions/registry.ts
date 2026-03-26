import "server-only";

import skillsLock from "../../../skills-lock.json";

type FunctionHandler = (args: Record<string, unknown>) => Promise<unknown>;

export type ApprovedFunctionName = "get_installed_skills";

export type FunctionDefinition = {
  name: ApprovedFunctionName;
  description: string;
  handler: FunctionHandler;
};

type SkillsLockEntry = {
  source: string;
  sourceType: string;
  computedHash: string;
};

type SkillsLockDocument = {
  version: number;
  skills: Record<string, SkillsLockEntry>;
};

export type GetInstalledSkillsResult = {
  version: number;
  skills: string[];
  entries: Array<SkillsLockEntry & { name: string }>;
};

type ApprovedFunctionResultMap = {
  get_installed_skills: GetInstalledSkillsResult;
};

const typedSkillsLock = skillsLock as SkillsLockDocument;

async function getInstalledSkills(): Promise<GetInstalledSkillsResult> {
  const entries = Object.entries(typedSkillsLock.skills).map(([name, entry]) => ({
    name,
    ...entry,
  }));

  return {
    version: typedSkillsLock.version,
    skills: entries.map((entry) => entry.name),
    entries,
  };
}

const registry: Record<ApprovedFunctionName, FunctionDefinition> = {
  get_installed_skills: {
    name: "get_installed_skills",
    description: "Return the installed skills declared in skills-lock.json.",
    handler: async () => getInstalledSkills(),
  },
};

export function listFunctionDefinitions(): FunctionDefinition[] {
  return Object.values(registry);
}

export function getFunctionDefinition(name: ApprovedFunctionName): FunctionDefinition | undefined {
  return registry[name];
}

export async function invokeFunction<TName extends ApprovedFunctionName>(
  name: TName,
  args: Record<string, unknown>,
): Promise<ApprovedFunctionResultMap[TName]> {
  const definition = getFunctionDefinition(name);

  if (!definition) {
    throw new Error(`Unknown approved function: ${name}`);
  }

  return definition.handler(args) as Promise<ApprovedFunctionResultMap[TName]>;
}
