import { ethers } from "hardhat";
import { Signer } from "ethers";
import { expect } from "chai";
import { Bridge, Bridge__factory } from "../typechain-types";

describe("Bridge Contract Main Test", () => {
  // ----------- 변수 세팅 ----------- //
  let owner: Signer, otherAccounts: Signer[], bridge: Bridge;

  const RequestStatus = {
    normal: 0n,
    rejected: 1n,
    canceled: 2n,
  };

  const ValueRange = {
    min: 0n,
    max: 1n,
  };

  const MIN_VALUE = ethers.parseEther("0.00001");
  const MAX_VALUE = ethers.parseEther("0.05");
  const VALID_VALUE = ethers.parseEther("0.001");

  // ----------- 컨트랙트 배포 및 세팅 ----------- //

  before(async () => {
    [owner, ...otherAccounts] = await ethers.getSigners();

    bridge = await new Bridge__factory(owner).deploy();
    await owner.sendTransaction({
      to: await bridge.getAddress(),
      value: ethers.parseEther("1"),
    });
  });

  // ----------- 테스트 시작 ----------- //

  // onlyOwner
  it("should revert when non-owner calls onlyOwner function", async () => {
    await expect(
      bridge
        .connect(otherAccounts[0])
        .setWhiteList(await otherAccounts[0].getAddress(), true),
    ).to.be.revertedWithCustomError(bridge, "OwnableUnauthorizedAccount");
  });

  // [ whitelist ]
  // 화이트 리스트 추가
  it("should add address to whitelist and emit event", async () => {
    const tx = await bridge
      .connect(owner)
      .setWhiteList(await otherAccounts[0].getAddress(), true);
    await tx.wait();

    await expect(tx)
      .to.emit(bridge, "WhitelistUpdated")
      .withArgs(await otherAccounts[0].getAddress(), true);

    expect(
      await bridge.whiteList(await otherAccounts[0].getAddress()),
    ).to.equal(true);
  });

  // 화이트 리스트가 아닌 사용자가 호출 했을때
  it("should revert when non-whitelisted address calls request", async () => {
    await expect(
      bridge.connect(otherAccounts[1]).request(2n, { value: VALID_VALUE }),
    ).to.be.revertedWithCustomError(bridge, "WhiteListUnauthorizedAccount");
  });

  // [ min/max value ]
  // 유효하지않은 Max 값 설정
  it("should revert setMaximumValue with invalid value", async () => {
    await expect(
      bridge.connect(owner).setMaximumValue(0n),
    ).to.be.revertedWithCustomError(bridge, "InvalidMaximumValue");

    await expect(
      bridge.connect(owner).setMaximumValue(MIN_VALUE - 1n),
    ).to.be.revertedWithCustomError(bridge, "InvalidMaximumValue");
  });

  // 유효하지않은 Min 값 설정
  it("should revert setMinimumValue with invalid value", async () => {
    await expect(
      bridge.connect(owner).setMinimumValue(0n),
    ).to.be.revertedWithCustomError(bridge, "InvalidMinimumValue");

    await expect(
      bridge.connect(owner).setMinimumValue(MAX_VALUE + 1n),
    ).to.be.revertedWithCustomError(bridge, "InvalidMinimumValue");
  });

  // 유효한 Max 값 설정
  it("should update maximum value", async () => {
    const newMax = ethers.parseEther("0.1");
    await bridge.connect(owner).setMaximumValue(newMax);
    expect(await bridge.requestMaximumValue()).to.equal(newMax);

    // 원복
    await expect(bridge.connect(owner).setMaximumValue(MAX_VALUE))
      .to.emit(bridge, "setValueRange")
      .withArgs(ValueRange.max, MAX_VALUE);
  });

  // 유효한 Min 값 설정
  it("should update minimum value", async () => {
    const newMin = ethers.parseEther("0.000001");
    await bridge.connect(owner).setMinimumValue(newMin);
    expect(await bridge.requestMinimumValue()).to.equal(newMin);

    // 원복
    await expect(bridge.connect(owner).setMinimumValue(MIN_VALUE))
      .to.emit(bridge, "setValueRange")
      .withArgs(ValueRange.min, MIN_VALUE);
  });

  // [ Request ]
  // 최소값보다 낮은 값으로 요청
  it("should revert request below minimum value", async () => {
    await expect(
      bridge.connect(otherAccounts[0]).request(2n, { value: MIN_VALUE - 1n }),
    ).to.be.revertedWithCustomError(bridge, "BelowMinimumValue");
  });

  // 최대값보다 높은 값으로 요청
  it("should revert request above maximum value", async () => {
    await expect(
      bridge.connect(otherAccounts[0]).request(2n, { value: MAX_VALUE + 1n }),
    ).to.be.revertedWithCustomError(bridge, "ExceedsMaximumValue");
  });

  // 정상 요청 후 이벤트 확인
  it("should submit requests and store correct data", async () => {
    const chainId = (await ethers.provider.getNetwork()).chainId;

    for (let i = 1; i <= 3; i++) {
      const tx = await bridge
        .connect(otherAccounts[0])
        .request(2n, { value: VALID_VALUE });
      await tx.wait();

      await expect(tx).to.emit(bridge, "Requested");

      const req = await bridge.requestList(i);
      expect(req.id).to.equal(i);
      expect(req.requestBy).to.equal(await otherAccounts[0].getAddress());
      expect(req.fromChainId).to.equal(chainId);
      expect(req.fromValue).to.equal(VALID_VALUE);
      expect(req.toChainId).to.equal(2n);
      expect(req.toValue).to.equal(VALID_VALUE);
      expect(req.status).to.equal(RequestStatus.normal);
    }
  });

  // 교환 요청 상태 변경
  // 없는 RequestId로 요청했을때
  it("should revert setRequest with incorrect requestId", async () => {
    await expect(
      bridge.connect(owner).setRequest(99n, RequestStatus.rejected),
    ).to.be.revertedWithCustomError(bridge, "IncorrectRequestId");
  });

  // Status를 Normal로 요청했을때
  it("should revert setRequest when status is normal", async () => {
    await expect(
      bridge.connect(owner).setRequest(1n, RequestStatus.normal),
    ).to.be.revertedWithCustomError(bridge, "IncorrectRequestStatus");
  });

  // 정상 요청 후 환불 로직 테스트
  // 거부시 환불
  it("should reject request and refund ETH", async () => {
    const balanceBefore = await ethers.provider.getBalance(
      await otherAccounts[0].getAddress(),
    );

    const tx = await bridge
      .connect(owner)
      .setRequest(1n, RequestStatus.rejected);
    await tx.wait();

    await expect(tx)
      .to.emit(bridge, "SetRequested")
      .withArgs(1n, RequestStatus.rejected);

    expect((await bridge.requestList(1n)).status).to.equal(
      RequestStatus.rejected,
    );

    const balanceAfter = await ethers.provider.getBalance(
      await otherAccounts[0].getAddress(),
    );
    expect(balanceAfter).to.be.greaterThan(balanceBefore);
  });

  // 취소시 환불
  it("should cancel request and refund ETH", async () => {
    const balanceBefore = await ethers.provider.getBalance(
      await otherAccounts[0].getAddress(),
    );

    const tx = await bridge
      .connect(owner)
      .setRequest(2n, RequestStatus.canceled);
    await tx.wait();

    await expect(tx)
      .to.emit(bridge, "SetRequested")
      .withArgs(2n, RequestStatus.canceled);

    expect((await bridge.requestList(2n)).status).to.equal(
      RequestStatus.canceled,
    );

    const balanceAfter = await ethers.provider.getBalance(
      await otherAccounts[0].getAddress(),
    );
    expect(balanceAfter).to.be.greaterThan(balanceBefore);
  });

  // 재처리 방지 로직 테스트
  it("should revert setRequest when already finalized", async () => {
    await expect(
      bridge.connect(owner).setRequest(1n, RequestStatus.rejected),
    ).to.be.revertedWithCustomError(bridge, "RequestAlreadyFinalized");
  });

  // [ triggerPayout ]
  // 자산 전송 함수 테스트
  it("should process payout and mark as processed", async () => {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const recipient = await otherAccounts[2].getAddress();

    const tx = await bridge
      .connect(owner)
      .triggerPayout(chainId, 3n, recipient, VALID_VALUE);
    await tx.wait();

    await expect(tx)
      .to.emit(bridge, "TriggerPayouted")
      .withArgs(recipient, VALID_VALUE);

    expect(await bridge.payoutList(chainId, 3n)).to.equal(true);
  });

  // 이중 지불 방지 로직 테스트
  it("should revert triggerPayout when already processed", async () => {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const recipient = await otherAccounts[2].getAddress();

    await expect(
      bridge.connect(owner).triggerPayout(chainId, 3n, recipient, VALID_VALUE),
    ).to.be.revertedWithCustomError(bridge, "AlreadyProcessed");
  });

  // 컨트랙트 잔고 부족시
  it("should revert triggerPayout when insufficient balance", async () => {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const hugeValue = ethers.parseEther("999");

    await expect(
      bridge
        .connect(owner)
        .triggerPayout(
          chainId,
          99n,
          await otherAccounts[1].getAddress(),
          hugeValue,
        ),
    ).to.be.revertedWithCustomError(bridge, "InsufficientBalance");
  });
});
