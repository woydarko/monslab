// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {CommunityFixture} from "./utils/CommunityFixture.sol";
import {MonsGameHarness} from "./utils/Fixture.sol";
import {MonsParts} from "../src/MonsParts.sol";
import {MonsCommunity} from "../src/MonsCommunity.sol";
import {MockEntropy} from "../src/test-helpers/MockEntropy.sol";
import {Outcome, PlayerView, WarView} from "../src/interfaces/Types.sol";

/// Random walk over the player-facing flows. Every call is wrapped so reverts only shrink the state space.
contract WarHandler is Test {
    MonsGameHarness game;
    MonsCommunity community;
    MonsParts parts;
    MockEntropy entropy;
    address relayer;
    uint32 warId;

    address[] public pool; // every registered player
    address[] public crew; // war participants (both teams)

    uint256 public bought;
    uint256 public hatched;
    uint64[] pendingSeqs;
    bool public starterMoved;

    mapping(address => uint256) public warStarts; // successful WAR startBattle per attacker
    mapping(uint8 => mapping(uint8 => uint256)) public targetFinalized; // [targetSide][idx] -> counted results
    uint256 nextPlayer = 100;

    constructor(
        MonsGameHarness game_,
        MonsCommunity community_,
        MonsParts parts_,
        MockEntropy entropy_,
        address relayer_,
        uint32 warId_,
        address[] memory registered
    ) {
        game = game_;
        community = community_;
        parts = parts_;
        entropy = entropy_;
        relayer = relayer_;
        warId = warId_;
        for (uint256 i; i < registered.length; ++i) {
            pool.push(registered[i]);
            crew.push(registered[i]);
            bought += game.getPlayer(registered[i]).eggs; // starter egg from register
        }
    }

    function poolLength() external view returns (uint256) {
        return pool.length;
    }

    function register() external {
        address p = address(uint160(0x1000 + nextPlayer));
        bytes memory name = abi.encodePacked("h", vm.toString(nextPlayer));
        nextPlayer++;
        vm.prank(relayer);
        game.register(p, string(name), bytes6(keccak256(name)));
        pool.push(p);
        bought += game.getPlayer(p).eggs;
    }

    function buyEggs(uint256 who, uint32 n) external {
        address p = pool[who % pool.length];
        n = uint32(bound(n, 1, 5));
        game.setGloo(p, 10_000);
        vm.prank(relayer);
        game.buyEgg(p, n);
        bought += n;
    }

    function openEgg(uint256 who) external {
        address p = pool[who % pool.length];
        if (game.getPlayer(p).eggs == 0) return;
        vm.prank(relayer);
        uint64 seq = game.openEgg{value: 1 ether}(p, 0);
        pendingSeqs.push(seq);
    }

    function fireEgg(uint256 which, bytes32 random) external {
        if (pendingSeqs.length == 0) return;
        uint256 i = which % pendingSeqs.length;
        uint64 seq = pendingSeqs[i];
        pendingSeqs[i] = pendingSeqs[pendingSeqs.length - 1];
        pendingSeqs.pop();
        entropy.fire(seq, random);
        hatched += 1;
    }

    function moveStarter(uint256 who, address to) external {
        address p = pool[who % pool.length];
        if (to == address(0) || to.code.length != 0 || to == p) return;
        vm.prank(p);
        try parts.safeTransferFrom(p, to, 101, 1, "") {
            starterMoved = true;
        } catch {}
    }

    function warp(uint256 dt) external {
        vm.warp(block.timestamp + bound(dt, 1, 130));
        vm.roll(block.number + 1);
    }

    function warAttack(uint256 who, uint8 targetIdx, uint8 winner, uint32 hpLeftA) external {
        address a = crew[who % crew.length];
        targetIdx = uint8(bound(targetIdx, 0, 4));
        vm.prank(relayer);
        try community.lockTarget(a, warId, targetIdx) {}
        catch {
            return;
        }
        uint256 id;
        uint32 seed;
        vm.prank(relayer);
        try game.startBattle(a, 2, (uint256(warId) << 8) | targetIdx) returns (uint256 id_, uint32 seed_) {
            (id, seed) = (id_, seed_);
        } catch {
            return;
        }
        warStarts[a] += 1;

        winner = uint8(bound(winner, 0, 1));
        Outcome memory o = Outcome({
            winner: winner,
            actions: 9,
            hpLeftA: uint32(bound(hpLeftA, 0, 100)),
            hpLeftB: winner == 0 ? 0 : 10,
            maxHpA: 100,
            maxHpB: 100,
            resultHash: 0
        });
        o.resultHash =
            keccak256(abi.encode(id, seed, o.winner, o.actions, o.hpLeftA, o.hpLeftB, o.maxHpA, o.maxHpB));
        uint8 ts = _targetSide(a);
        bool wasDone = community.getWar(warId).done[ts][targetIdx];
        vm.prank(relayer);
        try game.finalizeBattle(id, o) {
            if (!wasDone && community.getWar(warId).done[ts][targetIdx]) targetFinalized[ts][targetIdx] += 1;
        } catch {}
        vm.roll(block.number + 1);
    }

    function _targetSide(address attacker) internal view returns (uint8) {
        WarView memory w = community.getWar(warId);
        for (uint8 i; i < 5; ++i) {
            if (w.team[0][i] == attacker) return 1;
        }
        return 0;
    }
}

contract WarInvariantsTest is CommunityFixture {
    WarHandler handler;
    uint32 warId;

    function setUp() public override {
        super.setUp();
        (, address[] memory a) = _crew("Alpha", 0, 5);
        (uint32 cb, address[] memory b) = _crew("Bravo", 10, 5);
        vm.prank(relayer);
        warId = community.declareWar(a[0], cb);
        vm.prank(relayer);
        community.acceptWar(b[0], warId);

        address[] memory all = new address[](10);
        for (uint256 i; i < 5; ++i) {
            all[i] = a[i];
            all[5 + i] = b[i];
        }
        handler = new WarHandler(game, community, parts, entropy, relayer, warId, all);
        targetContract(address(handler));
        bytes4[] memory sel = new bytes4[](7);
        sel[0] = WarHandler.register.selector;
        sel[1] = WarHandler.buyEggs.selector;
        sel[2] = WarHandler.openEgg.selector;
        sel[3] = WarHandler.fireEgg.selector;
        sel[4] = WarHandler.moveStarter.selector;
        sel[5] = WarHandler.warp.selector;
        sel[6] = WarHandler.warAttack.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: sel}));
    }

    /// Guards against a dead handler: the try/catch in the handler would otherwise hide a broken war path.
    function test_handlerReachesEveryPath() public {
        handler.register();
        handler.buyEggs(0, 3);
        handler.openEgg(0);
        handler.fireEgg(0, bytes32(uint256(7)));
        handler.warAttack(0, 0, 0, 50);
        assertEq(handler.warStarts(handler.crew(0)), 1, "war attack never started");
        assertEq(handler.targetFinalized(1, 0), 1, "war result never counted");
        assertEq(handler.hatched(), 1, "egg never hatched");
        assertEq(handler.poolLength(), 11);
    }

    /// forge-config: default.invariant.runs = 64
    /// forge-config: default.invariant.depth = 120
    function invariant_starterNeverMoves() public view {
        uint256 total;
        for (uint256 i; i < handler.poolLength(); ++i) {
            total += parts.balanceOf(handler.pool(i), 101);
        }
        assertEq(total, handler.poolLength(), "starter 101 left its owner");
        assertFalse(handler.starterMoved());
    }

    /// forge-config: default.invariant.runs = 64
    /// forge-config: default.invariant.depth = 120
    function invariant_eggsConserved() public view {
        uint256 held;
        for (uint256 i; i < handler.poolLength(); ++i) {
            PlayerView memory p = game.getPlayer(handler.pool(i));
            held += p.eggs + p.rareEggs + p.pendingEggs;
        }
        assertEq(held, handler.bought() - handler.hatched(), "eggs created or lost");
    }

    /// forge-config: default.invariant.runs = 64
    /// forge-config: default.invariant.depth = 120
    function invariant_targetSingleAttack() public view {
        for (uint256 i; i < 10; ++i) {
            assertLe(handler.warStarts(handler.crew(i)), 1, "attacker started more than one war battle");
        }
        for (uint8 s; s < 2; ++s) {
            for (uint8 t; t < 5; ++t) {
                assertLe(handler.targetFinalized(s, t), 1, "target counted twice");
            }
        }
    }
}
