// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SimpleStorage {
    string private message;
    address public owner;
    
    event MessageUpdated(string newMessage);
    
    constructor() {
        owner = msg.sender;
        message = "Hello BSC Testnet!";
    }
    
    function setMessage(string memory newMessage) public {
        message = newMessage;
        emit MessageUpdated(newMessage);
    }
    
    function getMessage() public view returns (string memory) {
        return message;
    }
} 