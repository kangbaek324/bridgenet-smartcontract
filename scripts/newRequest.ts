import { ethers } from "hardhat";
import { Bridge__factory } from "../typechain-types";

async function main() {
  if (!process.env.CONTRACT_ADDRESS) {
    throw new Error("can not found contractAddress");
  }
  const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

  const contract = Bridge__factory.connect(CONTRACT_ADDRESS, ethers.provider);
  const signers = await ethers.getSigners();

  console.log("Start");

  const tx = await contract
    .connect(signers[0])
    .request(111555111n, 1, { value: 1 });

  const receipt = await tx.wait();

  console.log(receipt);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
