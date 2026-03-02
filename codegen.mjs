import { createFromRoot } from "codama";
import { rootNodeFromAnchor } from "@codama/nodes-from-anchor";
import { renderVisitor } from "@codama/renderers-js";
import { readFileSync } from "node:fs";
import path from "node:path";

const idlPath = path.join(process.cwd(), "src", "idl", "farms.json");
const anchorIdl = JSON.parse(readFileSync(idlPath, "utf-8"));

const codama = createFromRoot(rootNodeFromAnchor(anchorIdl));

// renderVisitor first arg is the "package folder"
// generatedFolder="" puts files directly in the output dir
codama.accept(
  renderVisitor(path.join(process.cwd(), "src", "@codegen", "farms"), {
    formatCode: true,
    deleteFolderBeforeRendering: true,
    syncPackageJson: false,
    generatedFolder: "",
  })
);

console.log("TypeScript client generated!");
