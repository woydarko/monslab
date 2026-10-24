// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {CommunityFixture} from "./utils/CommunityFixture.sol";
import {MonsGameHarness} from "./utils/Fixture.sol";
import {MonsParts} from "../src/MonsParts.sol";
import {MonsTypes, Outcome, PlayerView} from "../src/interfaces/Types.sol";

/// Drives the game through its public (relayer) surface with bounded inputs.
contract GameHandler is Test {
    MonsGameHarness internal immutable game;
    MonsParts internal immutable parts;
    address internal immutable community;
    address internal immutable relayer;
    address[] internal actors;

    uint256 public registeredCount;
    uint256 public eggsGranted;
    uint256 public eggsOpened;

    constructor(MonsGameHarness game_, MonsParts parts_, address community_, address relayer_, address[] memory actors_) {
        game = game_;
        parts = parts_;
        community = community_;
        relayer = relayer_;
        actors = actors_;
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }

    function actorAt(uint256 i) external view returns (address) {
        return actors[i];
    }

    function _actor(uint256 i) internal view returns (address) {
        return actors[i % actors.length];
    }

    function _registered(address p) internal view returns (bool) {
        return game.getPlayer(p).registered;
    }

    function register(uint256 i) public {
        address p = _actor(i);
        if (_registered(p)) return;
        string memory name =
            string(abi.encodePacked("p", bytes1(uint8(97 + i % 26)), bytes1(uint8(97 + (i / 26) % 26))));
        vm.prank(relayer);
        game.register(p, name, bytes6(keccak256(bytes(name))));
        registeredCount += 1;
        eggsGranted += 1; // register grants the first egg
    }

    function grantEgg(uint256 i) public {
        address p = _actor(i);
        if (!_registered(p)) return;
        vm.prank(community);
        game.grantEggs(p, 1, 1);
        eggsGranted += 2;
    }

    function openEgg(uint256 i) public {
        address p = _actor(i);
        if (!_registered(p)) return;
        if (game.getPlayer(p).eggs == 0) return;
        vm.prank(relayer);
        uint64 sequence = game.openEgg(p, MonsTypes.EGG_NORMAL);
        eggsOpened += 1;
        if (i % 2 == 0) {
            vm.prank(relayer);
            game.fulfillEggBackend(sequence, keccak256(abi.encode(sequence)));
        }
    }

    function fight(uint256 i) public {
        address p = _actor(i);
        if (!_registered(p)) return;
        vm.prank(relayer);
        (uint256 id, uint32 seed) = game.startBattle(p, MonsTypes.MODE_PVE, 0);
        Outcome memory o =
            Outcome({winner: 0, actions: 17, hpLeftA: 42, hpLeftB: 0, maxHpA: 108, maxHpB: 95, resultHash: 0});
        o.resultHash = keccak256(abi.encode(id, seed, o.winner, o.actions, o.hpLeftA, o.hpLeftB, o.maxHpA, o.maxHpB));
        vm.prank(relayer);
        game.finalizeBattle(id, o);
    }
}

/// forge-config: default.invariant.runs = 32
/// forge-config: default.invariant.depth = 25
contract InvariantsTest is CommunityFixture {
    GameHandler internal handler;

    function setUp() public override {
        super.setUp();
        game.setRandomSource(MonsTypes.RANDOM_BACKEND);

        address[] memory actors = new address[](4);
        actors[0] = address(0x10001);
        actors[1] = address(0x10002);
        actors[2] = address(0x10003);
        actors[3] = address(0x10004);
        handler = new GameHandler(game, parts, address(community), relayer, actors);
        targetContract(address(handler));
    }

    /// Starter parts are soulbound and minted exactly once per registration.
    function invariant_starterNeverMoves() public view {
        uint256 sum;
        for (uint256 i; i < handler.actorCount(); ++i) {
            sum += parts.balanceOf(handler.actorAt(i), MonsTypes.STARTER_HEAD);
        }
        assertEq(sum, handler.registeredCount());
    }

    /// Eggs only enter through register/grantEggs and leave through openEgg.
    function invariant_eggsConserved() public view {
        uint256 held;
        for (uint256 i; i < handler.actorCount(); ++i) {
            PlayerView memory v = game.getPlayer(handler.actorAt(i));
            held += v.eggs + v.rareEggs;
        }
        assertEq(handler.eggsGranted(), handler.eggsOpened() + held);
    }

    /// A battle can be finalized at most once (status moves 1 -> 2 and never back).
    function invariant_battlesFinalizeOnce() public view {
        uint256 count = game.battleCount();
        for (uint256 id = 1; id <= count; ++id) {
            assertLe(game.battles(id).status, 2);
        }
    }
}
