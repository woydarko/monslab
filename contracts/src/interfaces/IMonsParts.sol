// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IMonsParts {
    error Soulbound();

    function mint(address to, uint256 id, uint256 amount) external;

    function balanceOf(address account, uint256 id) external view returns (uint256);
}
