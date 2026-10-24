// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {MonsParts} from "../src/MonsParts.sol";
import {MonsGame} from "../src/MonsGame.sol";
import {MonsCommunity} from "../src/MonsCommunity.sol";
import {IMonsGame} from "../src/interfaces/IMonsGame.sol";
import {MonsTypes, CommunityParams} from "../src/interfaces/Types.sol";

/// forge script script/Deploy.s.sol --rpc-url https://testnet-rpc.monad.xyz --account monslab-deployer --broadcast
/// env: RELAYER_ADDRESSES (comma list, public addresses), REDEEM_CODE, optional ENTROPY_ADDRESS, DROP_STARTS_AT,
/// DROP_ENDS_AT. Writes deployments/testnet.json (addresses only, no secrets).
contract Deploy is Script {
    address internal constant PYTH_ENTROPY_V2 = 0x825c0390f379C631f3Cf11A82a37D20BddF93c07;
    string internal constant META_URI = "https://monslab.vercel.app/meta/{id}.json";

    struct Config {
        address admin;
        address entropy;
        address[] relayers;
        bytes32 codeHash;
        uint64 dropStartsAt;
        uint64 dropEndsAt;
        uint8[] slots;
        uint8[] rarities;
        uint64 weekLength;
        uint64 warDuration;
    }

    function run() external {
        string memory code = vm.envOr("REDEEM_CODE", string(""));
        // shortcut: default window starts in 1 day so the owner can still move it with setDropWindow
        uint64 startsAt = uint64(vm.envOr("DROP_STARTS_AT", block.timestamp + 1 days));
        Config memory cfg = Config({
            admin: msg.sender,
            entropy: vm.envOr("ENTROPY_ADDRESS", PYTH_ENTROPY_V2),
            // relayers optional: admin can grantRole(RELAYER_ROLE) later on both contracts
            relayers: vm.envOr("RELAYER_ADDRESSES", ",", new address[](0)),
            codeHash: bytes(code).length == 0 ? bytes32(0) : keccak256(bytes(code)),
            dropStartsAt: startsAt,
            dropEndsAt: uint64(vm.envOr("DROP_ENDS_AT", uint256(startsAt) + 1 days)),
            slots: readSlots(),
            rarities: readRarities(),
            weekLength: uint64(vm.envOr("WEEK_LENGTH", uint256(900))),
            warDuration: uint64(vm.envOr("WAR_DURATION", uint256(300)))
        });
        require(block.chainid == 10143, "testnet only");
        uint256 deployBlock = block.number;

        vm.startBroadcast();
        (MonsParts parts, MonsGame game,) = _deploy(cfg);
        vm.stopBroadcast();

        string memory o = "deployment";
        vm.serializeUint(o, "chainId", block.chainid);
        vm.serializeUint(o, "deployBlock", deployBlock);
        vm.serializeAddress(o, "parts", address(parts));
        vm.serializeAddress(o, "game", address(game));
        vm.serializeAddress(o, "community", game.community());
        string memory json = vm.serializeAddress(o, "entropy", cfg.entropy);
        vm.writeJson(json, "deployments/testnet.json");
        console2.log("parts", address(parts));
        console2.log("game", address(game));
    }

    /// External entry for tests (admin must be the caller, i.e. this contract).
    function deploy(Config memory cfg) external returns (MonsParts, MonsGame, MonsCommunity) {
        return _deploy(cfg);
    }

    function _deploy(Config memory cfg) internal returns (MonsParts parts, MonsGame game, MonsCommunity community) {
        parts = new MonsParts(cfg.admin, META_URI);
        game = new MonsGame(cfg.admin, parts, cfg.entropy, cfg.slots, cfg.rarities);
        community = new MonsCommunity(
            cfg.admin,
            IMonsGame(address(game)),
            parts,
            CommunityParams({
                maxMembers: 30,
                weekGenesis: uint64(block.timestamp),
                weekLength: cfg.weekLength,
                themeTiers: [uint32(5), 10, 20],
                hatchTiers: [uint32(10), 25, 50],
                warAcceptWindow: 600,
                warDuration: cfg.warDuration,
                lockDuration: 120,
                warEggReward: 2
            })
        );
        game.setCommunity(address(community));
        parts.grantRole(parts.MINTER_ROLE(), address(game));
        parts.grantRole(parts.MINTER_ROLE(), address(community));
        game.grantRole(game.COMMUNITY_ROLE(), address(community));
        community.grantRole(community.GAME_ROLE(), address(game));
        for (uint256 i; i < cfg.relayers.length; ++i) {
            game.grantRole(game.RELAYER_ROLE(), cfg.relayers[i]);
            community.grantRole(community.RELAYER_ROLE(), cfg.relayers[i]);
        }
        if (cfg.codeHash != bytes32(0)) {
            game.createDrop(1, cfg.codeHash, MonsTypes.ACC_CROWN, cfg.dropStartsAt, cfg.dropEndsAt, 500);
        }
    }

    function readSlots() public view returns (uint8[] memory) {
        return _readU8("$.slots");
    }

    function readRarities() public view returns (uint8[] memory) {
        return _readU8("$.rarities");
    }

    function _readU8(string memory key) internal view returns (uint8[] memory out) {
        uint256[] memory raw = vm.parseJsonUintArray(vm.readFile("script/parts.json"), key);
        out = new uint8[](raw.length);
        for (uint256 i; i < raw.length; ++i) {
            out[i] = uint8(raw[i]);
        }
    }
}
