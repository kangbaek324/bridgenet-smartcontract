// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Bridge is Ownable {
    uint256 requestIdCount;

    // enum
    enum RequestStatus {
        pending,
        approved,
        rejected,
        canceled
    }

    struct Chain {
        uint256 id;
        bool active;
    }

    struct RequestInfo {
        uint256 id;
        address requestBy;
        uint256 fromChainId;
        uint256 fromValue;
        uint256 toChainId;
        uint256 toValue;
        RequestStatus status;
        address statusDecidedBy;
        uint256 exchangedAt;
    }

    // mapping, array
    // @TODO List대신 s로 변경하면 더 좋을듯
    mapping(address => bool) public whiteList;
    mapping(uint256 => Chain) public chainList;
    mapping(uint256 => RequestInfo) public requestList;

    // error
    error WhiteListUnauthorizedAccount(address _address);
    error IncorrectChainId(uint256 chainId);
    error ChainAlreadyExists(uint256 chainId);
    error ChainAlreadyRemoved(uint256 chainId);
    error IncorrectRequestId(uint256 requestId);

    // event
    event WhitelistUpdated(address indexed _address, bool status);
    event ChainListUpdated(uint256 indexed chainId, bool status);
    event Requested(address indexed requestedBy, RequestInfo request);
    event SetRequested(uint256 indexed requestId, RequestStatus indexed requestStatus, address requestedBy);
    event TriggerPayouted(address indexed _address, uint256 value);
    event AddBalance(address _address, uint256 value);

    // modifier
    modifier onlyWhiteList() {
        if (!whiteList[msg.sender])
            revert WhiteListUnauthorizedAccount(msg.sender);
        _;
    }

    modifier checkValue(uint256 value) {
        require(value == msg.value, "incorrect value");
        _;
    }

    constructor() Ownable(msg.sender) {
        whiteList[msg.sender] = true;
    }

    function setWhiteList(address _address, bool status) external onlyOwner {
        whiteList[_address] = status;

        emit WhitelistUpdated(_address, status);
    }

    function addChain(uint256 chainId) external onlyOwner {
        if (chainList[chainId].active) revert ChainAlreadyExists(chainId);

        chainList[chainId].id = chainId;
        chainList[chainId].active = true;

        emit ChainListUpdated(chainId, true);
    }

    function removeChain(uint256 chainId) external onlyOwner {
        if (chainList[chainId].id == 0) revert IncorrectChainId(chainId);
        else if (!chainList[chainId].active)
            revert ChainAlreadyRemoved(chainId);

        chainList[chainId].active = false;

        emit ChainListUpdated(chainId, false);
    }

    // 교환 요청
    function request(
        uint256 toChainId,
        uint256 _value
    ) external payable checkValue(_value) onlyWhiteList {
        RequestInfo memory req;
        uint256 requestId = ++requestIdCount;
        // @TODO 체인검사 로직 없음
        req.id = requestId;
        req.requestBy = msg.sender;
        req.fromChainId = block.chainid;
        req.toChainId = toChainId;
        req.fromValue = _value;
        req.status = RequestStatus.pending;

        // @TODO chainLink 사용해서 가격 받아오기
        // 교환 비율 지정 (현재 1 : 1)
        req.toValue = _value;

        requestList[requestId] = req;

        emit Requested(msg.sender, req);
    }

    // 교환 요청 취소
    function cancelRequest(uint256 requestId) external onlyWhiteList {
        RequestInfo storage req = requestList[requestId];
        if (req.id == 0) revert IncorrectRequestId(requestId);
        require(req.requestBy == msg.sender || msg.sender == owner(), "requester or owner can cancel");
        require(
            req.status == RequestStatus.pending,
            "only when status pending can cancel"
        );

        req.status = RequestStatus.canceled;

        require(req.fromValue < address(this).balance, "contract value low");
        (bool success, ) = req.requestBy.call{value: req.fromValue}("");
        require(success, "refund Fail");

        emit SetRequested(requestId, RequestStatus.canceled, msg.sender);
    }

    // 교환 요청 상태 결정
    function setRequest(
        uint256 requestId,
        RequestStatus status
    ) external onlyOwner {
        RequestInfo storage req = requestList[requestId];

        if (req.id == 0) revert IncorrectRequestId(requestId);
        require(
            req.status == RequestStatus.pending,
            "only when status pending can setRequest"
        );

        if (status == RequestStatus.approved) req.exchangedAt = block.timestamp;
        req.status = status;
        req.statusDecidedBy = msg.sender;

        emit SetRequested(requestId, status, msg.sender);
    }

    // 송금 함수
    function triggerPayout(
        address payable _address,
        uint256 _value
    ) external onlyOwner {
        require(_value < address(this).balance, "contract value low");
        (bool success, ) = _address.call{value: _value}("");
        require(success, "triggerPayout Fail");

        emit TriggerPayouted(_address, _value);
    }

    function addBalance() external payable {
        emit AddBalance(msg.sender, msg.value);
    }
}
