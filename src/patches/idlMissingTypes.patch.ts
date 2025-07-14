/**
 * Post-codegen patch for idlMissingTypes.ts
 * This file applies type fixes to the generated idlMissingTypes instruction
 * Run this after codegen to fix compilation errors
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const filePath = join(
  __dirname,
  "../@codegen/farms/instructions/idlMissingTypes.ts",
);

export function patchIdlMissingTypes() {
  let content = readFileSync(filePath, "utf8");

  // Add type assertions to fix the compilation errors
  content = content.replace(
    "globalConfigOptionKind: args.globalConfigOptionKind.toEncodable(),",
    "globalConfigOptionKind: args.globalConfigOptionKind.toEncodable() as any,",
  );

  content = content.replace(
    "farmConfigOptionKind: args.farmConfigOptionKind.toEncodable(),",
    "farmConfigOptionKind: args.farmConfigOptionKind.toEncodable() as any,",
  );

  content = content.replace(
    "timeUnit: args.timeUnit.toEncodable(),",
    "timeUnit: args.timeUnit.toEncodable() as any,",
  );

  content = content.replace(
    "lockingMode: args.lockingMode.toEncodable(),",
    "lockingMode: args.lockingMode.toEncodable() as any,",
  );

  content = content.replace(
    "rewardType: args.rewardType.toEncodable(),",
    "rewardType: args.rewardType.toEncodable() as any,",
  );

  writeFileSync(filePath, content);
  console.log("Successfully patched idlMissingTypes.ts");
}

// Auto-run if this file is executed directly
if (require.main === module) {
  patchIdlMissingTypes();
}
