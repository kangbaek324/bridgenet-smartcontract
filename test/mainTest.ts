import { ethers } from "hardhat";
import { Signer } from "ethers";
import { expect } from "chai"
import { Bridge } from "../typechain-types";

describe("Bridge Contract Main Test", function () {
    let owner: Signer,
        otherAccounts: Signer[],
        bridge: Bridge

    before(async () => {
        [owner, ...otherAccounts] = await ethers.getSigners();
        
        const Bridge = await ethers.getContractFactory("Bridge");
        bridge = await Bridge.connect(owner).deploy();
    });

    // onlyOwner
    it ("Auth Test", async () => {
        await expect(bridge
            .connect(otherAccounts[0])
            .setWhiteList(await otherAccounts[0].getAddress(), true)
        ).to.be.revertedWithCustomError(bridge, "OwnableUnauthorizedAccount");
    });

    it("chain add", async () => {
        const tx = await bridge
            .connect(owner)
            .addChain(1n);
        await tx.wait();

        expect((await bridge.chainListArray(0)).id == 1n);
        expect((await bridge.chainListArray(0)).active == true);

        expect((await bridge.chainList(1n)).id == 1n);
        expect((await bridge.chainList(1n)).active == true);

        // 중복 등록 요청
        await expect(bridge
            .connect(owner)
            .addChain(1)
        ).to.be.revertedWithCustomError(bridge, "ChainAlreadyExists");

        await expect(tx).to.emit(bridge, "ChainListUpdated");
    });

    it("chain remove", async () => {
        const tx = await bridge
            .connect(owner)
            .removeChain(1n);
        await tx.wait();

        expect((await bridge.chainListArray(0)).id == 1n);
        expect((await bridge.chainListArray(0)).active == false);

        expect((await bridge.chainList(1n)).id == 1n);
        expect((await bridge.chainList(1n)).active == false);

        // 이미 삭제된 체인 삭제 요청
        await expect(bridge
            .connect(owner)
            .removeChain(1n)
        ).to.be.revertedWithCustomError(bridge, "ChainAlreadyRemoved");

        await expect(tx).to.emit(bridge, "ChainListUpdated");
    });
});