// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {MonsTypes} from "../src/interfaces/Types.sol";

contract InterfacesTest is Test {
    function test_constantsMatchSpec() public pure {
        assertEq(MonsTypes.STARTER_HEAD, 101);
        assertEq(MonsTypes.STARTER_LEGS, 103);
        assertEq(MonsTypes.ACC_CROWN, 201);
        assertEq(MonsTypes.ACC_ORB, 203);
        assertEq(MonsTypes.MODE_WAR, 2);
        assertEq(MonsTypes.TASK_HATCH, 1);
    }
}
