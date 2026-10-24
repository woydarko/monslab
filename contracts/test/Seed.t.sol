// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Deploy} from "../script/Deploy.s.sol";
import {SeedDemo} from "../script/SeedDemo.s.sol";
import {MonsParts} from "../src/MonsParts.sol";
import {MonsGame} from "../src/MonsGame.sol";
import {MonsCommunity} from "../src/MonsCommunity.sol";
import {MockEntropy} from "../src/test-helpers/MockEntropy.sol";

contract SeedTest is Test {
    bytes32 internal constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    Deploy internal _deployer;

    function _deploy() internal returns (MonsParts parts, MonsGame game, MonsCommunity community) {
        Deploy d = new Deploy();
        _deployer = d;
        address[] memory relayers = new address[](1);
        relayers[0] = address(0xE1);
        Deploy.Config memory cfg = Deploy.Config({
            admin: address(d),
            entropy: address(new MockEntropy()),
            relayers: relayers,
            codeHash: bytes32(0),
            dropStartsAt: 0,
            dropEndsAt: 0,
            slots: d.readSlots(),
            rarities: d.readRarities(),
            weekLength: 900,
            warDuration: 300
        });
        (parts, game, community) = d.deploy(cfg);
    }

    function test_seed_registersAndBuildsCommunities() public {
        (MonsParts parts, MonsGame game, MonsCommunity community) = _deploy();

        address[] memory players = new address[](4);
        players[0] = address(0xA1);
        players[1] = address(0xA2);
        players[2] = address(0xA3);
        players[3] = address(0xA4);

        SeedDemo seed = new SeedDemo();
        vm.prank(address(_deployer));
        game.grantRole(RELAYER_ROLE, address(seed));
        vm.prank(address(_deployer));
        community.grantRole(RELAYER_ROLE, address(seed));
        seed.seed(address(game), address(community), players);

        for (uint256 i; i < players.length; ++i) {
            assertTrue(game.getPlayer(players[i]).registered, "registered");
            assertEq(parts.balanceOf(players[i], 101), 1, "starter");
        }
        assertEq(community.communityCount(), 2);
        uint32 first = community.communityOf(players[0]);
        uint32 second = community.communityOf(players[2]);
        assertTrue(first != 0 && first == community.communityOf(players[1]));
        assertTrue(second != 0 && second == community.communityOf(players[3]));
        assertEq(community.getCommunity(first).members.length, 2);
        assertEq(community.getCommunity(first).name, "Indonads");
        assertEq(community.getCommunity(second).name, "UGM Devs");

    }

    function test_seed_isIdempotent() public {
        (, MonsGame game, MonsCommunity community) = _deploy();
        address[] memory players = new address[](2);
        players[0] = address(0xB1);
        players[1] = address(0xB2);

        SeedDemo seed = new SeedDemo();
        vm.prank(address(_deployer));
        game.grantRole(RELAYER_ROLE, address(seed));
        vm.prank(address(_deployer));
        community.grantRole(RELAYER_ROLE, address(seed));
        seed.seed(address(game), address(community), players);
        seed.seed(address(game), address(community), players);

        assertEq(community.communityCount(), 1);
        assertEq(community.getCommunity(1).members.length, 2);
    }
}
