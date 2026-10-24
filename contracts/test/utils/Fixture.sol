// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {MonsParts} from "../../src/MonsParts.sol";
import {MonsGame} from "../../src/MonsGame.sol";
import {MockEntropy} from "../../src/test-helpers/MockEntropy.sol";
import {IMonsParts} from "../../src/interfaces/IMonsParts.sol";
import {Outcome} from "../../src/interfaces/Types.sol";

/// Exposes balance setters for tests only.
contract MonsGameHarness is MonsGame {
    constructor(address admin, IMonsParts parts_, address entropy_, uint8[] memory slots, uint8[] memory rarities)
        MonsGame(admin, parts_, entropy_, slots, rarities)
    {}

    function setGloo(address p, uint64 g) external {
        players[p].gloo = g;
    }

    function setBrain(address p, uint32 b) external {
        players[p].brain = b;
    }
}

abstract contract Fixture is Test {
    MonsParts parts;
    MonsGameHarness game;
    MockEntropy entropy;
    address admin = address(this);
    address relayer = address(0xE1);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address carol = address(0xCA201);

    // PARTS order: fang, goo, eye, claw, bone, shroom, ghost x (head, body, legs); 0 common, 1 rare, 2 epic
    uint8[21] internal RARITY = [0, 0, 1, 0, 0, 0, 1, 2, 0, 0, 0, 1, 0, 0, 2, 1, 0, 0, 1, 2, 0];

    uint64 constant STARTER_LOADOUT = (uint64(101) << 48) | (uint64(102) << 32) | (uint64(103) << 16);

    function setUp() public virtual {
        vm.warp(1_761_300_000);
        vm.roll(100);
        parts = new MonsParts(admin, "https://example.invalid/meta/{id}.json");
        entropy = new MockEntropy();
        uint8[] memory slots = new uint8[](21);
        uint8[] memory rarities = new uint8[](21);
        for (uint256 i; i < 21; ++i) {
            slots[i] = uint8(i % 3);
            rarities[i] = RARITY[i];
        }
        game = new MonsGameHarness(admin, parts, address(entropy), slots, rarities);
        parts.grantRole(parts.MINTER_ROLE(), address(game));
        parts.grantRole(parts.MINTER_ROLE(), admin);
        game.grantRole(game.RELAYER_ROLE(), relayer);
        vm.deal(relayer, 100 ether);
    }

    function _register(address p, string memory name) internal {
        vm.prank(relayer);
        game.register(p, name, bytes6(keccak256(bytes(name))));
    }

    function _give(address p, uint256 id) internal {
        parts.mint(p, id, 1);
    }

    function _hash(uint256 id, uint32 seed, Outcome memory o) internal pure returns (bytes32) {
        return keccak256(abi.encode(id, seed, o.winner, o.actions, o.hpLeftA, o.hpLeftB, o.maxHpA, o.maxHpB));
    }

    function _outcome(uint256 id, uint32 seed, uint8 winner) internal pure returns (Outcome memory o) {
        o = Outcome({winner: winner, actions: 17, hpLeftA: 42, hpLeftB: 0, maxHpA: 108, maxHpB: 95, resultHash: 0});
        if (winner == 1) (o.hpLeftA, o.hpLeftB) = (0, 30);
        o.resultHash = _hash(id, seed, o);
    }

    function _fight(address p, uint8 mode, uint256 ref, uint8 winner) internal returns (uint256 id) {
        vm.prank(relayer);
        (uint256 bid, uint32 seed) = game.startBattle(p, mode, ref);
        Outcome memory o = _outcome(bid, seed, winner);
        vm.prank(relayer);
        game.finalizeBattle(bid, o);
        vm.roll(block.number + 1);
        return bid;
    }
}
