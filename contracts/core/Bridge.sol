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
    mapping (address => bool) public whiteList;
    mapping (uint256 => Chain) public chainList;
    mapping (uint256 => RequestInfo) public requestList;

    // error
    error WhiteListUnauthorizedAccount(address _address);
    error IncorrectChainId(uint256 chainId);
    error ChainAlreadyExists(uint256 chainId);
    error ChainAlreadyRemoved(uint256 chainId);
    error IncorrectRequestId(uint256 requestId);
    error IncoorectRequestStatus(RequestStatus requestStatus);

    // event
    event WhitelistUpdated(address indexed _address, bool status);
    event ChainListUpdated(uint256 indexed chainId, bool status);
    event Requested(address indexed requestAddress, RequestInfo request);
    event SetRequested(uint256 indexed requestId, RequestStatus indexed requestStatus);
    
    // modifier
    modifier onlyWhiteList {
        if (!whiteList[msg.sender]) revert WhiteListUnauthorizedAccount(msg.sender);
        _;
    }

    constructor() Ownable(msg.sender) {
        whiteList[msg.sender] = true;
    }

    function setWhiteList(address _address, bool status) public onlyOwner {
        whiteList[_address] = status;

        emit WhitelistUpdated(_address, status);
    }

    function addChain(uint256 chainId) public onlyOwner {
        if (chainList[chainId].active) revert ChainAlreadyExists(chainId);

        chainList[chainId].id = chainId;
        chainList[chainId].active = true;

        emit ChainListUpdated(chainId, true);
    }

    function removeChain(uint256 chainId) public onlyOwner {
        if (chainList[chainId].id == 0) revert IncorrectChainId(chainId);
        else if (!chainList[chainId].active) revert ChainAlreadyRemoved(chainId);
        
        chainList[chainId].active = false;

        emit ChainListUpdated(chainId, false);
    }

    // 교환 요청
    function request(
        uint256 fromChainId,
        uint256 toChainId,
        uint256 value
    ) public onlyWhiteList {
        RequestInfo memory req;
        uint256 requestId = ++requestIdCount;

        req.id = requestId;
        req.requestBy = msg.sender;
        req.fromChainId = fromChainId;
        req.toChainId = toChainId;
        req.fromValue = value;
        req.status = RequestStatus.pending;

        // @TODO chainLink 사용해서 가격 받아오기
        // 교환 비율 지정 (현재 1 : 1)
        req.toValue = value;

        requestList[requestId] = req;
        
        emit Requested(msg.sender, req);
    }

    // 교환 요청 취소
    function cancelRequest(uint256 requestId) public onlyWhiteList {
        RequestInfo storage req = requestList[requestId];
        if (req.id == 0) revert IncorrectRequestId(requestId);
        require(req.requestBy == msg.sender, "only the requester can cancel");
        require(req.status == RequestStatus.pending, "only when status pending can cancel");

        req.status = RequestStatus.canceled;
        
        emit SetRequested(requestId, RequestStatus.canceled);
    }

    // 교환 요청 상태 결정
    function setRequest(uint256 requestId, RequestStatus status) public onlyOwner {
        RequestInfo storage req = requestList[requestId];

        if (req.id == 0) revert IncorrectRequestId(requestId);
        require(req.status == RequestStatus.pending, "only when status pending can setRequest");

        if (status == RequestStatus.approved) req.exchangedAt = block.timestamp;
        req.status = status;
        req.statusDecidedBy = msg.sender;

        emit SetRequested(requestId, status);
    }
}