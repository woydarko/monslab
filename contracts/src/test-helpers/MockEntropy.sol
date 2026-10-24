// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IEntropyConsumer} from "@pythnetwork/entropy-sdk-solidity/IEntropyConsumer.sol";

/// Test double for Pyth Entropy v2: records the requester, `fire` delivers the callback.
contract MockEntropy {
    uint128 public constant FEE = 0.128 ether;
    uint64 public seq;
    mapping(uint64 => address) public consumer;

    function getFeeV2() external pure returns (uint128) {
        return FEE;
    }

    function requestV2() external payable returns (uint64) {
        require(msg.value >= FEE, "fee");
        seq += 1;
        consumer[seq] = msg.sender;
        return seq;
    }

    function fire(uint64 sequence, bytes32 random) external {
        IEntropyConsumer(consumer[sequence])._entropyCallback(sequence, address(this), random);
    }
}
