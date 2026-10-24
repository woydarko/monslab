// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Deploy} from "../script/Deploy.s.sol";
import {MonsParts} from "../src/MonsParts.sol";
import {MonsGame} from "../src/MonsGame.sol";
import {MockEntropy} from "../src/test-helpers/MockEntropy.sol";

contract DeployTest is Test {
    function test_deployWiresRoles() public {
        Deploy d = new Deploy();
        address[] memory relayers = new address[](2);
        relayers[0] = address(0xE1);
        relayers[1] = address(0xE2);
        Deploy.Config memory cfg = Deploy.Config({
            admin: address(d),
            entropy: address(new MockEntropy()),
            relayers: relayers,
            codeHash: keccak256(bytes("BLITZJOGJA")),
            dropStartsAt: uint64(block.timestamp + 60),
            dropEndsAt: uint64(block.timestamp + 1 days),
            slots: d.readSlots(),
            rarities: d.readRarities()
        });
        (MonsParts parts, MonsGame game) = d.deploy(cfg);

        assertTrue(parts.hasRole(parts.MINTER_ROLE(), address(game)));
        for (uint256 i; i < relayers.length; ++i) {
            assertTrue(game.hasRole(game.RELAYER_ROLE(), relayers[i]));
        }
        assertEq(game.drops(1).tokenId, 201);
        assertEq(game.drops(1).codeHash, keccak256(bytes("BLITZJOGJA")));
        assertEq(game.entropy(), cfg.entropy);
        assertEq(game.rarityOf(8), 2);
        assertEq(game.slotOf(8), 1);
        assertEq(game.slotOf(101), 0);
    }
}
