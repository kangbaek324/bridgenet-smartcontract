// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Bridge is Ownable {
    constructor() Ownable(msg.sender) {}

    struct Chain {
        string id;
        string name;
    }

    mapping (address => bool) whiteList;
    Chain[] chainList;

    error WhiteListUnauthorizedAccount(address _address);
    error IncorrectChain(string chainId);

    event WhitelistUpdated(address _address, bool status);
    event ChainListUpdated(string chainId, bool status); // true : add, false : remove
    
    modifier iswhiteList {
        if (!whiteList[msg.sender]) revert WhiteListUnauthorizedAccount(msg.sender);
        _;
    }

    modifier isChainList(string calldata _chainId) {
        bool isCorrect;
        for (uint i = 0; i < chainList.length; i++) {
          if (keccak256(bytes(chainList[i].id)) == keccak256(bytes(_chainId))) isCorrect = true;  
        }

        if (!isCorrect) revert IncorrectChain(_chainId);
        _;
    }

    function setWhiteList(address _address, bool status) public onlyOwner {
        whiteList[_address] = status;

        emit WhitelistUpdated(_address, status);
    }

}