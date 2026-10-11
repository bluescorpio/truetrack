// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract TrackRecordRegistry {
    struct Attestation {
        address trader;
        uint64  timestamp;
        int256  equity;    // 1e8-scaled USD
        int256  pnl;       // 1e8-scaled USD
        bytes32 dataHash;
    }
    address public owner;
    mapping(address => bool) public attesters;
    mapping(address => Attestation[]) private _records;
    mapping(address => uint256) public latestIndex;
    event Attested(address indexed trader, uint64 timestamp, int256 equity, int256 pnl, bytes32 dataHash);
    modifier onlyAttester() { require(attesters[msg.sender], "not attester"); _; }
    constructor() { owner = msg.sender; attesters[msg.sender] = true; }
    function setAttester(address a, bool ok) external { require(msg.sender == owner, "not owner"); attesters[a] = ok; }
    function attest(address trader, uint64 timestamp, int256 equity, int256 pnl, bytes32 dataHash) external onlyAttester {
        require(trader != address(0), "zero trader");
        _records[trader].push(Attestation(trader, timestamp, equity, pnl, dataHash));
        latestIndex[trader] = _records[trader].length;
        emit Attested(trader, timestamp, equity, pnl, dataHash);
    }
    function getLatest(address trader) external view returns (Attestation memory) {
        uint256 i = latestIndex[trader]; require(i != 0, "no record"); return _records[trader][i - 1];
    }
    function getHistory(address trader) external view returns (Attestation[] memory) { return _records[trader]; }
    function recordCount(address trader) external view returns (uint256) { return _records[trader].length; }
}
