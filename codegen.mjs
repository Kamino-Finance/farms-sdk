import { createFromRoot } from "codama";
import { rootNodeFromAnchor } from "@codama/nodes-from-anchor";
import { renderVisitor } from "@codama/renderers-js";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const idlPath = path.join(process.cwd(), "src", "idl", "farms.json");
const anchorIdl = JSON.parse(readFileSync(idlPath, "utf-8"));

const codama = createFromRoot(rootNodeFromAnchor(anchorIdl));

const outputDir = path.join(process.cwd(), "src", "@codegen", "farms");

// renderVisitor first arg is the "package folder"
// generatedFolder="" puts files directly in the output dir
codama.accept(
  renderVisitor(outputDir, {
    formatCode: true,
    deleteFolderBeforeRendering: true,
    syncPackageJson: false,
    generatedFolder: "",
  })
);

console.log("TypeScript client generated!");

// Post-generation: fix the empty FARMS_PROGRAM_ADDRESS with the real program ID
const farmsProgamFilePath = path.join(outputDir, "programs", "farms.ts");
let farmsContent = readFileSync(farmsProgamFilePath, "utf-8");

farmsContent = farmsContent.replace(
  'export const FARMS_PROGRAM_ADDRESS = "" as Address<"">;',
  'export const FARMS_PROGRAM_ADDRESS = "FarmsPZpWu9i7Kky8tPN37rs2TpmMrAZrC7S7vJa91Hr" as Address<"FarmsPZpWu9i7Kky8tPN37rs2TpmMrAZrC7S7vJa91Hr">;'
);

writeFileSync(farmsProgamFilePath, farmsContent);
console.log("Fixed FARMS_PROGRAM_ADDRESS in programs/farms.ts");
