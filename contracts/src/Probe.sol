// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// D-07 probe: exposes the block values the battle seed uses.
contract Probe {
    function read() external view returns (uint256 prevrandao, bytes32 prevHash, uint256 number) {
        return (block.prevrandao, blockhash(block.number - 1), block.number);
    }
}
