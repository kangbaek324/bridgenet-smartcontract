import fs from "fs";
import path from "path";

// Hardhat artifact 경로
const artifactPath = path.join(
  __dirname,
  "../artifacts/contracts/core/Bridge.sol/Bridge.json"
);

// 출력 폴더
const abiFolder = path.join(__dirname, "abis");
const binFolder = path.join(__dirname, "bins");

// 폴더 생성
if (!fs.existsSync(abiFolder)) fs.mkdirSync(abiFolder, { recursive: true });
if (!fs.existsSync(binFolder)) fs.mkdirSync(binFolder, { recursive: true });

// JSON 읽기
const data = fs.readFileSync(artifactPath, "utf-8");
const json = JSON.parse(data);

// ABI 추출
const abi = json.abi;
fs.writeFileSync(
  path.join(abiFolder, "Bridge.abi"),
  JSON.stringify(abi, null, 2)
);
console.log("ABI saved to:", path.join(abiFolder, "Bridge.abi"));

// BIN 추출
const bin = json.bytecode;
fs.writeFileSync(path.join(binFolder, "Bridge.bin"), bin);
console.log("BIN saved to:", path.join(binFolder, "Bridge.bin"));
