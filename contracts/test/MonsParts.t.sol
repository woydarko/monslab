// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {MonsParts} from "../src/MonsParts.sol";
import {IMonsParts} from "../src/interfaces/IMonsParts.sol";

contract MonsPartsTest is Test {
    MonsParts parts;
    address admin = address(this);
    address game = address(0x6A3E);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        parts = new MonsParts(admin, "https://example.invalid/meta/{id}.json");
        parts.grantRole(parts.MINTER_ROLE(), game);
    }

    function test_minterCanMint() public {
        vm.prank(game);
        parts.mint(alice, 5, 2);
        assertEq(parts.balanceOf(alice, 5), 2);
    }

    function test_nonMinterCannotMint() public {
        bytes32 role = parts.MINTER_ROLE();
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, bob, role));
        vm.prank(bob);
        parts.mint(alice, 5, 1);
    }

    function test_starterIsSoulbound() public {
        for (uint256 id = 101; id <= 103; id++) {
            vm.prank(game);
            parts.mint(alice, id, 1);
            vm.expectRevert(IMonsParts.Soulbound.selector);
            vm.prank(alice);
            parts.safeTransferFrom(alice, bob, id, 1, "");
        }
        uint256[] memory ids = new uint256[](2);
        uint256[] memory vals = new uint256[](2);
        vm.prank(game);
        parts.mint(alice, 7, 1);
        ids[0] = 7;
        ids[1] = 103;
        vals[0] = 1;
        vals[1] = 1;
        vm.expectRevert(IMonsParts.Soulbound.selector);
        vm.prank(alice);
        parts.safeBatchTransferFrom(alice, bob, ids, vals, "");
    }

    function test_regularPartTransfers() public {
        vm.prank(game);
        parts.mint(alice, 7, 1);
        vm.prank(alice);
        parts.safeTransferFrom(alice, bob, 7, 1, "");
        assertEq(parts.balanceOf(bob, 7), 1);
    }

    function test_accessoryTransfers() public {
        vm.prank(game);
        parts.mint(alice, 201, 1);
        vm.prank(alice);
        parts.safeTransferFrom(alice, bob, 201, 1, "");
        assertEq(parts.balanceOf(bob, 201), 1);
    }

    function test_supportsInterface() public view {
        assertTrue(parts.supportsInterface(type(IERC1155).interfaceId));
        assertTrue(parts.supportsInterface(type(IAccessControl).interfaceId));
    }
}
