// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {Probe} from "../src/Probe.sol";

contract ProbeScript is Script {
    function run() external {
        vm.startBroadcast();
        Probe p = new Probe();
        vm.stopBroadcast();
        console2.log("probe", address(p));
    }
}
