// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IMonsParts} from "./interfaces/IMonsParts.sol";
import {MonsTypes} from "./interfaces/Types.sol";

/// Monster parts (ERC-1155). Starter parts 101..103 are soulbound; only minters (game, community) create tokens.
contract MonsParts is ERC1155, AccessControl, IMonsParts {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor(address admin, string memory uri_) ERC1155(uri_) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function mint(address to, uint256 id, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, id, amount, "");
    }

    function balanceOf(address account, uint256 id) public view override(ERC1155, IMonsParts) returns (uint256) {
        return super.balanceOf(account, id);
    }

    function setURI(string calldata uri_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setURI(uri_);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _update(address from, address to, uint256[] memory ids, uint256[] memory values) internal override {
        if (from != address(0) && to != address(0)) {
            for (uint256 i; i < ids.length; ++i) {
                if (ids[i] >= MonsTypes.STARTER_HEAD && ids[i] <= MonsTypes.STARTER_LEGS) revert Soulbound();
            }
        }
        super._update(from, to, ids, values);
    }
}
