// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {TrackRecordRegistry} from "../src/TrackRecordRegistry.sol";

contract TrackRecordRegistryTest is Test {
    TrackRecordRegistry internal registry;
    address internal trader = address(0xBEEF);
    address internal stranger = address(0xCAFE);

    function setUp() public {
        registry = new TrackRecordRegistry();
    }

    function testOwnerIsAttester() public view {
        assertEq(registry.owner(), address(this));
        assertTrue(registry.attesters(address(this)));
    }

    function testAttestStoresLatestAndHistory() public {
        bytes32 firstHash = keccak256("first");
        bytes32 secondHash = keccak256("second");

        registry.attest(trader, 1_700_000_000, 100_000_000_000, -2_500_000_000, firstHash);
        registry.attest(trader, 1_700_000_060, 110_000_000_000, 4_000_000_000, secondHash);

        assertEq(registry.recordCount(trader), 2);
        assertEq(registry.latestIndex(trader), 2);

        TrackRecordRegistry.Attestation memory latest = registry.getLatest(trader);
        assertEq(latest.trader, trader);
        assertEq(latest.timestamp, 1_700_000_060);
        assertEq(latest.equity, 110_000_000_000);
        assertEq(latest.pnl, 4_000_000_000);
        assertEq(latest.dataHash, secondHash);

        TrackRecordRegistry.Attestation[] memory history = registry.getHistory(trader);
        assertEq(history.length, 2);
        assertEq(history[0].dataHash, firstHash);
        assertEq(history[1].dataHash, secondHash);
    }

    function testRejectsZeroTraderAndStrangers() public {
        vm.expectRevert("zero trader");
        registry.attest(address(0), 1, 1, 1, bytes32("x"));

        vm.prank(stranger);
        vm.expectRevert("not attester");
        registry.attest(trader, 1, 1, 1, bytes32("x"));

        vm.prank(stranger);
        vm.expectRevert("not owner");
        registry.setAttester(stranger, true);
    }

    function testOwnerCanAuthorizeAttester() public {
        registry.setAttester(stranger, true);
        vm.prank(stranger);
        registry.attest(trader, 42, 7, -3, keccak256("ok"));
        assertEq(registry.recordCount(trader), 1);
        assertEq(registry.getLatest(trader).timestamp, 42);
    }

    function testGetLatestRevertsWhenEmpty() public {
        vm.expectRevert("no record");
        registry.getLatest(trader);
    }
}
