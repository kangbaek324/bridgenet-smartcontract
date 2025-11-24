import { ethers } from "hardhat";
import { Signer, ethers as _ethers } from "ethers";
import { expect } from "chai";
import { Bridge } from "../typechain-types";

describe("Bridge Contract Main Test", () => {
  let owner: Signer, otherAccounts: Signer[], bridge: Bridge;

  const RequestStatus = {
    pending: 0n,
    approved: 1n,
    rejected: 2n,
    canceled: 3n,
  };

  before(async () => {
    [owner, ...otherAccounts] = await ethers.getSigners();

    const Bridge = await ethers.getContractFactory("Bridge");
    bridge = await Bridge.connect(owner).deploy();
  });

  // onlyOwner
  it("Auth Test", async () => {
    await expect(
      bridge
        .connect(otherAccounts[0])
        .setWhiteList(await otherAccounts[0].getAddress(), true)
    ).to.be.revertedWithCustomError(bridge, "OwnableUnauthorizedAccount");
  });

  // onlyWhiteList
  it("whiteList Test", async () => {
    const tx = await bridge.connect(owner).setWhiteList(otherAccounts[0], true);
    await tx.wait();

    await expect(tx)
      .to.emit(bridge, "WhitelistUpdated")
      .withArgs(otherAccounts[0], true);
  });

  // 체인 추가
  it("should add chain", async () => {
    const tx = await bridge.connect(owner).addChain(1n);
    await tx.wait();

    expect((await bridge.chainList(1n)).id == 1n);
    expect((await bridge.chainList(1n)).active == true);

    // 중복 등록 요청
    await expect(
      bridge.connect(owner).addChain(1)
    ).to.be.revertedWithCustomError(bridge, "ChainAlreadyExists");

    await expect(tx).to.emit(bridge, "ChainListUpdated");
  });

  // 체인 삭제 (비활성화)
  it("should remove chain", async () => {
    const tx = await bridge.connect(owner).removeChain(1n);
    await tx.wait();

    expect((await bridge.chainList(1n)).id == 1n);
    expect((await bridge.chainList(1n)).active == false);

    // 이미 삭제된 체인 삭제 요청
    await expect(
      bridge.connect(owner).removeChain(1n)
    ).to.be.revertedWithCustomError(bridge, "ChainAlreadyRemoved");

    // 잘못된 체인 삭제 요청
    await expect(
      bridge.connect(owner).removeChain(2n)
    ).to.be.revertedWithCustomError(bridge, "IncorrectChainId");

    await expect(tx).to.emit(bridge, "ChainListUpdated");
  });

  // 재활성화 되는지 테스트
  it("should activate an inactive chain", async () => {
    const tx = await bridge.connect(owner).addChain(1n);
    await tx.wait();

    expect((await bridge.chainList(1n)).active);
  });

  // 교환 요청 제출
  it("should request", async () => {
    for (let i = 1; i <= 3; i++) {
      const tx = await bridge
        .connect(otherAccounts[0])
        .request(2n, 1000n, { value: 1000 });
      await tx.wait();

      await expect(tx).to.emit(bridge, "Requested");

      const request = await bridge.requestList(i);
      expect(request.id).to.equal(i);
      expect(request.requestBy).to.equal(otherAccounts[0]);
      expect(request.fromChainId).to.equal(1n);
      expect(request.fromValue).to.equal(1000n);
      expect(request.toChainId).to.equal(2n);
      expect(request.toValue).to.equal(1000n);
      expect(request.status).to.equal(RequestStatus.pending);
      expect(request.statusDecidedBy).to.equal(ethers.ZeroAddress);
      expect(request.exchangedAt).to.equal(0n);
    }
  });

  // 교환 요청 취소
  it("should request cancel", async () => {
    // 잘못된 requestId
    await expect(
      bridge.connect(otherAccounts[0]).cancelRequest(99n)
    ).to.be.revertedWithCustomError(bridge, "IncorrectRequestId");

    // 요청자가 아닌 다른 사람의 취소요청
    await expect(bridge.connect(owner).cancelRequest(1n)).to.be.revertedWith(
      "only the requester can cancel"
    );

    // 취소요청
    const tx = await bridge.connect(otherAccounts[0]).cancelRequest(1n);
    await tx.wait();

    expect(tx)
      .to.emit(bridge, "SetRequested")
      .withArgs(1, RequestStatus.canceled);

    // 이미 처리된 요청에 취소요청
    await expect(
      bridge.connect(otherAccounts[0]).cancelRequest(1n)
    ).to.be.revertedWith("only when status pending can cancel");
  });

  // 교환 요청 처리
  it("should request decide", async () => {
    // 잘못된 requestId
    await expect(
      bridge.connect(owner).setRequest(99n, RequestStatus.approved)
    ).to.be.revertedWithCustomError(bridge, "IncorrectRequestId");

    // 취소된 요청 처리 시도 할때
    await expect(
      bridge.connect(owner).setRequest(1n, RequestStatus.approved)
    ).to.be.revertedWith("only when status pending can setRequest");

    // 승인 됐을때
    const tx2 = await bridge
      .connect(owner)
      .setRequest(2n, RequestStatus.approved);
    await tx2.wait();

    expect(tx2).to.emit(bridge, "SetRequested");
    expect((await bridge.requestList(2n)).exchangedAt).to.not.equal(0n);
    expect((await bridge.requestList(2n)).status).to.equal(
      RequestStatus.approved
    );
    expect((await bridge.requestList(2n)).statusDecidedBy).to.equal(
      await owner.getAddress()
    );

    // 거절 됐을때
    const tx3 = await bridge
      .connect(owner)
      .setRequest(3n, RequestStatus.rejected);
    await tx3.wait();

    expect(tx3).to.emit(bridge, "SetRequested");
    expect((await bridge.requestList(3n)).exchangedAt).to.equal(0n);
    expect((await bridge.requestList(3n)).status).to.equal(
      RequestStatus.rejected
    );
    expect((await bridge.requestList(3n)).statusDecidedBy).to.equal(
      await owner.getAddress()
    );
  });

  it("trigger payout test", async () => {
    await expect(
      bridge.connect(owner).triggerPayout(otherAccounts[3], 10000)
    ).to.be.revertedWith("contract value low");

    const tx = await bridge
      .connect(owner)
      .triggerPayout(otherAccounts[3], 1000);

    await tx.wait();

    expect(tx)
      .to.emit(bridge, "TriggerPayouted")
      .withArgs(otherAccounts[3], 1000);
  });
});
