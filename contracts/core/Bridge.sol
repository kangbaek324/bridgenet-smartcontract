// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Bridge is Ownable {
    uint256 public requestIdCount = 1;
    uint256 public requestMinimumValue = 0.00001 ether;
    uint256 public requestMaximumValue = 0.05 ether;

    // enum
    enum RequestStatus {
        normal,
        rejected,
        canceled
    }

    struct RequestInfo {
        uint256 id;
        address requestBy;
        uint256 fromChainId;
        uint256 fromValue;
        uint256 toChainId;
        uint256 toValue;
        RequestStatus status;
    }

    // mapping, array
    mapping(address => bool) public whiteList;
    mapping(uint256 => RequestInfo) public requestList;
    mapping(uint256 => mapping(uint256 => bool)) public payoutList; // chainId:reqId = bool

    // error
    error WhiteListUnauthorizedAccount(address _address);
    error BelowMinimumValue(uint256 minimum, uint256 actual);
    error ExceedsMaximumValue(uint256 maximum, uint256 actual);

    error IncorrectRequestId(uint256 requestId);
    error IncorrectRequestStatus(RequestStatus status);

    error InvalidMinimumValue(uint256 min);
    error InvalidMaximumValue(uint256 max);

    error RequestAlreadyFinalized(RequestStatus current);
    error AlreadyProcessed(uint256 fromChainId, uint256 requestId);
    error InsufficientBalance(uint256 requested, uint256 available);
    error PayoutFailed(address to, uint256 value);

    // event
    event WhitelistUpdated(address indexed _address, bool status);
    event Requested(address indexed requestAddress, RequestInfo request);
    event SetRequested(
        uint256 indexed requestId,
        RequestStatus indexed requestStatus
    );
    event TriggerPayouted(address indexed _address, uint256 value);

    // modifier
    modifier onlyWhiteList() {
        if (!whiteList[msg.sender])
            revert WhiteListUnauthorizedAccount(msg.sender);
        _;
    }

    constructor() Ownable(msg.sender) {
        whiteList[msg.sender] = true;
    }

    function setWhiteList(address _address, bool status) external onlyOwner {
        whiteList[_address] = status;

        emit WhitelistUpdated(_address, status);
    }

    function setMaximumValue(uint256 max) external onlyOwner {
        if (max == 0 || max <= requestMinimumValue)
            revert InvalidMaximumValue(max);

        requestMaximumValue = max;
    }

    function setMinimumValue(uint256 min) external onlyOwner {
        if (min == 0 || min >= requestMaximumValue)
            revert InvalidMinimumValue(min);

        requestMinimumValue = min;
    }

    // 교환 요청
    function request(uint256 toChainId) external payable onlyWhiteList {
        if (msg.value > requestMaximumValue)
            revert ExceedsMaximumValue(requestMaximumValue, msg.value);
        else if (msg.value < requestMinimumValue)
            revert BelowMinimumValue(requestMinimumValue, msg.value);

        RequestInfo memory req;
        uint256 requestId = requestIdCount++;

        req.id = requestId;
        req.requestBy = msg.sender;
        req.fromChainId = block.chainid;
        req.toChainId = toChainId;
        req.fromValue = msg.value;
        req.status = RequestStatus.normal;

        // @TODO chainLink 사용해서 가격 받아오기
        // 교환 비율 지정 (현재 1 : 1)
        req.toValue = msg.value;

        requestList[requestId] = req;

        emit Requested(msg.sender, req);
    }

    // 교환 요청 취소 및 거절
    function setRequest(
        uint256 requestId,
        RequestStatus status
    ) external onlyOwner {
        RequestInfo storage req = requestList[requestId];
        if (req.id == 0) revert IncorrectRequestId(requestId);
        else if (status == RequestStatus.normal)
            revert IncorrectRequestStatus(status);
        else if (req.status != RequestStatus.normal)
            revert RequestAlreadyFinalized(req.status);

        req.status = status;

        // 환불
        address _address = req.requestBy;
        uint256 _value = req.fromValue;
        (bool success, ) = _address.call{value: _value}("");
        if (!success) revert PayoutFailed(_address, _value);

        emit SetRequested(requestId, status);
    }

    // 송금 함수
    function triggerPayout(
        uint256 fromChainId,
        uint256 requestId,
        address payable _address,
        uint256 _value
    ) external onlyOwner {
        if (payoutList[fromChainId][requestId])
            revert AlreadyProcessed(fromChainId, requestId);
        if (_value >= address(this).balance)
            revert InsufficientBalance(_value, address(this).balance);

        payoutList[fromChainId][requestId] = true;
        (bool success, ) = _address.call{value: _value}("");
        if (!success) revert PayoutFailed(_address, _value);

        emit TriggerPayouted(_address, _value);
    }
}
