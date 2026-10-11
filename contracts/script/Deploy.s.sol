// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {TrackRecordRegistry} from "../src/TrackRecordRegistry.sol";

contract Deploy is Script {
    function run() external returns (TrackRecordRegistry registry) {
        vm.startBroadcast();
        registry = new TrackRecordRegistry();
        console2.log("TrackRecordRegistry", address(registry));
        vm.stopBroadcast();
    }
}
