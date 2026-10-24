// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Fixture} from "./Fixture.sol";
import {MonsCommunity} from "../../src/MonsCommunity.sol";
import {IMonsGame} from "../../src/interfaces/IMonsGame.sol";
import {CommunityParams, Outcome} from "../../src/interfaces/Types.sol";

abstract contract CommunityFixture is Fixture {
    MonsCommunity community;
    uint64 constant WEEK = 900;

    function setUp() public virtual override {
        super.setUp();
        community = new MonsCommunity(admin, IMonsGame(address(game)), parts, _demoParams());
        game.setCommunity(address(community));
        game.grantRole(game.COMMUNITY_ROLE(), address(community));
        community.grantRole(community.GAME_ROLE(), address(game));
        community.grantRole(community.RELAYER_ROLE(), relayer);
        parts.grantRole(parts.MINTER_ROLE(), address(community));
    }

    function _demoParams() internal view returns (CommunityParams memory) {
        return CommunityParams({
            maxMembers: 30,
            weekGenesis: uint64(block.timestamp),
            weekLength: WEEK,
            themeTiers: [uint32(5), 10, 20],
            hatchTiers: [uint32(10), 25, 50],
            warAcceptWindow: 600,
            warDuration: 300,
            lockDuration: 120,
            warEggReward: 2
        });
    }

    function _player(uint256 i) internal pure returns (address) {
        return address(uint160(0x1000 + i));
    }

    /// Registers player i with username "p<i>" (i < 100).
    function _reg(uint256 i) internal returns (address p) {
        p = _player(i);
        bytes memory name = abi.encodePacked("p", bytes1(uint8(0x30 + i / 10)), bytes1(uint8(0x30 + i % 10)));
        _register(p, string(name));
    }

    function _create(address p, string memory name) internal returns (uint32 cid) {
        vm.prank(relayer);
        cid = community.create(p, name);
    }

    function _join(address p, uint32 cid) internal {
        vm.prank(relayer);
        community.join(p, cid);
    }

    /// Community of `n` fresh players starting at index `from`; first is leader.
    function _crew(string memory name, uint256 from, uint256 n) internal returns (uint32 cid, address[] memory ms) {
        ms = new address[](n);
        for (uint256 i; i < n; ++i) {
            ms[i] = _reg(from + i);
        }
        cid = _create(ms[0], name);
        for (uint256 i = 1; i < n; ++i) {
            _join(ms[i], cid);
        }
    }

    function _warFight(address p, uint32 warId, uint8 idx, uint8 winner, uint32 hpLeftA, uint32 maxHpA)
        internal
        returns (uint256 bid)
    {
        vm.prank(relayer);
        (uint256 id, uint32 seed) = game.startBattle(p, 2, (uint256(warId) << 8) | idx);
        Outcome memory o = Outcome({
            winner: winner,
            actions: 9,
            hpLeftA: hpLeftA,
            hpLeftB: winner == 0 ? 0 : 10,
            maxHpA: maxHpA,
            maxHpB: 100,
            resultHash: 0
        });
        o.resultHash = _hash(id, seed, o);
        vm.prank(relayer);
        game.finalizeBattle(id, o);
        return id;
    }
}
