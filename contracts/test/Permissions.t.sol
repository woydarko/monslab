// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {CommunityFixture} from "./utils/CommunityFixture.sol";
import {IMonsGame} from "../src/interfaces/IMonsGame.sol";
import {IMonsCommunity} from "../src/interfaces/IMonsCommunity.sol";
import {Outcome, Params, CommunityParams} from "../src/interfaces/Types.sol";

/// Every relayer / game-hook / admin entry point must reject callers without the role.
contract PermissionsTest is CommunityFixture {
    address internal constant STRANGER = address(0xBAD);

    function _expectDenied(address target, bytes memory data) internal {
        vm.prank(STRANGER);
        (bool ok, bytes memory ret) = target.call(data);
        assertFalse(ok);
        assertEq(bytes4(ret), IAccessControl.AccessControlUnauthorizedAccount.selector);
    }

    function _expectDeniedFrom(address caller, address target, bytes memory data) internal {
        vm.prank(caller);
        (bool ok, bytes memory ret) = target.call(data);
        assertFalse(ok);
        assertEq(bytes4(ret), IAccessControl.AccessControlUnauthorizedAccount.selector);
    }

    function test_gameRelayerFunctionsRejectStranger() public {
        Outcome memory o;
        _expectDenied(address(game), abi.encodeCall(IMonsGame.register, (STRANGER, "stranger", bytes6("STRNG1"))));
        _expectDenied(address(game), abi.encodeCall(IMonsGame.setLoadout, (STRANGER, 101, 102, 103, 0)));
        _expectDenied(address(game), abi.encodeCall(IMonsGame.buyEgg, (STRANGER, 1)));
        _expectDenied(address(game), abi.encodeCall(IMonsGame.openEgg, (STRANGER, 0)));
        _expectDenied(address(game), abi.encodeCall(IMonsGame.fulfillEggBackend, (1, bytes32(uint256(1)))));
        _expectDenied(address(game), abi.encodeCall(IMonsGame.startBattle, (STRANGER, 0, 0)));
        _expectDenied(address(game), abi.encodeCall(IMonsGame.finalizeBattle, (1, o)));
        _expectDenied(address(game), abi.encodeCall(IMonsGame.redeem, (STRANGER, 1, "CODE")));
    }

    function test_gameHooksRejectStrangerAndRelayer() public {
        _expectDenied(address(game), abi.encodeCall(IMonsGame.grantEggs, (STRANGER, 1, 0)));
        _expectDeniedFrom(relayer, address(game), abi.encodeCall(IMonsGame.grantEggs, (STRANGER, 1, 0)));
    }

    function test_gameAdminRejectsStrangerAndRelayer() public {
        Params memory p = game.params();
        bytes memory setParams = abi.encodeCall(IMonsGame.setParams, (p));
        _expectDenied(address(game), setParams);
        _expectDeniedFrom(relayer, address(game), setParams);

        bytes memory setCommunity = abi.encodeCall(IMonsGame.setCommunity, (STRANGER));
        _expectDenied(address(game), setCommunity);
        _expectDeniedFrom(relayer, address(game), setCommunity);

        _expectDenied(address(game), abi.encodeCall(IMonsGame.createDrop, (9, bytes32(0), 201, 0, 1, 1)));
        _expectDenied(address(game), abi.encodeCall(IMonsGame.setDropWindow, (9, 0, 1)));
        _expectDenied(address(game), abi.encodeCall(IMonsGame.setRandomSource, (1)));
        _expectDenied(address(game), abi.encodeCall(IMonsGame.setSimVersion, (2)));
        _expectDenied(address(game), abi.encodeCall(IMonsGame.withdraw, (payable(STRANGER))));
    }

    function test_communityRelayerFunctionsRejectStranger() public {
        _expectDenied(address(community), abi.encodeCall(IMonsCommunity.create, (STRANGER, "strangers")));
        _expectDenied(address(community), abi.encodeCall(IMonsCommunity.join, (STRANGER, 1)));
        _expectDenied(address(community), abi.encodeCall(IMonsCommunity.leave, (STRANGER)));
        _expectDenied(address(community), abi.encodeCall(IMonsCommunity.claimWeekly, (STRANGER, 0, 0, 0)));
        _expectDenied(address(community), abi.encodeCall(IMonsCommunity.declareWar, (STRANGER, 1)));
        _expectDenied(address(community), abi.encodeCall(IMonsCommunity.acceptWar, (STRANGER, 1)));
        _expectDenied(address(community), abi.encodeCall(IMonsCommunity.lockTarget, (STRANGER, 1, 0)));
        _expectDenied(address(community), abi.encodeCall(IMonsCommunity.claimWarReward, (STRANGER, 1)));
    }

    function test_communityHooksRejectStrangerAndRelayer() public {
        bytes memory eggHook = abi.encodeCall(IMonsCommunity.onEggOpened, (STRANGER));
        bytes memory pvpHook = abi.encodeCall(IMonsCommunity.onPvpWin, (STRANGER, 1));
        bytes memory warStart = abi.encodeCall(IMonsCommunity.onWarBattleStart, (STRANGER, 1, 0));
        bytes memory warResult = abi.encodeCall(IMonsCommunity.onWarBattleResult, (1, STRANGER, 0, 3, 9000, 1));

        _expectDenied(address(community), eggHook);
        _expectDenied(address(community), pvpHook);
        _expectDenied(address(community), warStart);
        _expectDenied(address(community), warResult);

        _expectDeniedFrom(relayer, address(community), eggHook);
        _expectDeniedFrom(relayer, address(community), pvpHook);
        _expectDeniedFrom(relayer, address(community), warStart);
        _expectDeniedFrom(relayer, address(community), warResult);
    }

    function test_communityAdminRejectsStrangerAndRelayer() public {
        CommunityParams memory p = community.params();
        bytes memory setParams = abi.encodeCall(IMonsCommunity.setParams, (p));
        bytes memory setTheme = abi.encodeCall(IMonsCommunity.setWeeklyTheme, (0, 1));

        _expectDenied(address(community), setParams);
        _expectDenied(address(community), setTheme);
        _expectDeniedFrom(relayer, address(community), setParams);
        _expectDeniedFrom(relayer, address(community), setTheme);
    }

    function test_settleWarStaysPublic() public {
        // settleWar has no role gate on purpose (any player may settle a finished war);
        // it must still reject an unknown war instead of silently succeeding.
        vm.prank(STRANGER);
        vm.expectRevert(IMonsCommunity.UnknownWar.selector);
        community.settleWar(1);
    }
}
