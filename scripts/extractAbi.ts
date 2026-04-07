import * as fs from "fs";
import * as path from "path";

const artifactPath = path.resolve(
  __dirname,
  "../artifacts/contracts/core/Bridge.sol/Bridge.json"
);

const outputDir = path.resolve(__dirname, "../abi");

const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

fs.writeFileSync(
  path.join(outputDir, "Bridge.abi.json"),
  JSON.stringify(artifact.abi, null, 2)
);

fs.writeFileSync(
  path.join(outputDir, "Bridge.bin"),
  artifact.bytecode
);

console.log("ABI and bytecode extracted to /abi");
