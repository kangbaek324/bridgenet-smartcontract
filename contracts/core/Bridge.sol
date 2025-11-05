// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Bridge is Ownable {

    // error
    error WhiteListUnauthorizedAccount(address _address);
    error IncorrectChainId(uint256 chainId);
    error ChainAlreadyExists(uint256 chainId);
    error ChainAlreadyRemoved(uint256 chainId);

    // enum
    enum RequestStatus {
        pending,
        approved,
        rejected
    }

    struct Chain {
        uint256 id;
        bool active;
    }

    // mapping, array
    mapping (address => bool) public whiteList;
    mapping (uint256 => Chain) public chainList;
    Chain[] public chainListArray;

    // event
    event WhitelistUpdated(address _address, bool status);
    event ChainListUpdated(uint256 chainId, bool status);
    
    // modifier
    modifier onlyWhiteList {
        if (!whiteList[msg.sender]) revert WhiteListUnauthorizedAccount(msg.sender);
        _;
    }

    constructor() Ownable(msg.sender) {}

    function setWhiteList(address _address, bool status) public onlyOwner {
        whiteList[_address] = status;

        emit WhitelistUpdated(_address, status);
    }

    // chainList
    function getChainIdx(uint256 chainId) internal view returns(uint256, bool) {
        uint256 chainIdx;
        bool exists;

        for (uint i = 0; i < chainListArray.length; i++) {
          if (chainListArray[i].id == chainId) {
            chainIdx = i;
            exists = true;

            break;
          }
        }

        return(chainIdx, exists);
    }

    function addChain(uint256 chainId) public onlyOwner {
        if (chainList[chainId].active) revert ChainAlreadyExists(chainId);

        chainListArray.push(Chain(chainId, true));
        chainList[chainId].id = chainId;
        chainList[chainId].active = true;

        emit ChainListUpdated(chainId, true);
    }

    function removeChain(uint256 chainId) public onlyOwner {
        (uint256 chainIdx, bool exists) = getChainIdx(chainId);
        if (!exists) revert IncorrectChainId(chainId);
        else if (exists && !chainListArray[chainIdx].active) revert ChainAlreadyRemoved(chainId);
        
        chainListArray[chainIdx].active = false;
        chainList[chainId].active = false;

        emit ChainListUpdated(chainId, false);
    }

    // bridge
    function request() public onlyOwner {

    }

    function setRequest(uint256 requestId, RequestStatus requestStatus) public onlyOwner {
    }
}