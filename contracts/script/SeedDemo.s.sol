// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IMonsGame} from "../src/interfaces/IMonsGame.sol";
import {IMonsCommunity} from "../src/interfaces/IMonsCommunity.sol";

/// C9b demo seed: four registered players and two communities, idempotent.
/// forge script script/SeedDemo.s.sol --rpc-url https://testnet-rpc.monad.xyz --account monslab-deployer --broadcast
/// env: DEMO_ADDRESSES (comma list of public addresses), reads addresses from deployments/testnet.json.
contract SeedDemo is Script {
    bytes32 internal constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    function run() external {
        require(block.chainid == 10143, "testnet only");
        string memory json = vm.readFile("deployments/testnet.json");
        address gameAddr = vm.parseJsonAddress(json, ".game");
        address communityAddr = vm.parseJsonAddress(json, ".community");
        address[] memory players = vm.envAddress("DEMO_ADDRESSES", ",");
        require(players.length >= 2, "need at least 2 demo players");

        vm.startBroadcast();
        _borrowRelayer(gameAddr, communityAddr);
        _seed(gameAddr, communityAddr, players);
        _returnRelayer(gameAddr, communityAddr);
        vm.stopBroadcast();

        console2.log("seeded players", players.length);
        console2.log("game", gameAddr);
        console2.log("community", communityAddr);
    }

    /// External entry for tests. The caller must already hold RELAYER_ROLE on both
    /// contracts (the test grants it first); `run()` borrows it for the broadcast.
    function seed(address gameAddr, address communityAddr, address[] memory players) external {
        _seed(gameAddr, communityAddr, players);
    }

    function _borrowRelayer(address gameAddr, address communityAddr) internal {
        address admin = msg.sender;
        if (!AccessControl(gameAddr).hasRole(RELAYER_ROLE, admin)) {
            AccessControl(gameAddr).grantRole(RELAYER_ROLE, admin);
            AccessControl(communityAddr).grantRole(RELAYER_ROLE, admin);
            borrowed = true;
        }
    }

    function _returnRelayer(address gameAddr, address communityAddr) internal {
        if (!borrowed) return;
        borrowed = false;
        AccessControl(gameAddr).revokeRole(RELAYER_ROLE, msg.sender);
        AccessControl(communityAddr).revokeRole(RELAYER_ROLE, msg.sender);
    }

    bool private borrowed;

    function _seed(address gameAddr, address communityAddr, address[] memory players) internal {
        IMonsGame game = IMonsGame(gameAddr);
        IMonsCommunity community = IMonsCommunity(communityAddr);

        for (uint256 i; i < players.length; ++i) {
            address p = players[i];
            if (!game.getPlayer(p).registered) {
                string memory name = string(abi.encodePacked("demo_", bytes1(uint8(97 + (i % 26)))));
                game.register(p, name, bytes6(keccak256(abi.encode(p))));
            }
        }

        _community(community, players, 0, 1, "Indonads");
        if (players.length >= 4) _community(community, players, 2, 3, "UGM Devs");
    }

    function _community(IMonsCommunity community, address[] memory players, uint256 leaderAt, uint256 memberAt, string memory name)
        internal
    {
        address leader = players[leaderAt];
        if (community.communityOf(leader) != 0) return;
        uint32 cid = community.create(leader, name);
        address member = players[memberAt];
        if (community.communityOf(member) == 0) community.join(member, cid);
    }
}
