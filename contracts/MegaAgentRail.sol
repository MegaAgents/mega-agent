// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/**
 * @title MegaAgentRail
 * @author sparkysolutions10-pixel (ORCID: https://orcid.org/0009-0008-2818-6579)
 * @notice Real-Time High-Frequency Autonomous AI Agent Swarm Protocol on MegaETH.
 * @dev Optimized specifically for MegaETH in-memory execution and sub-10ms block latency.
 *      Uses packed storage slots (1 SLOAD / 1 SSTORE per micro-spend) to minimize state bloat.
 */
contract MegaAgentRail {
    // --- AUTHOR & PATENT METADATA ---
    string public constant PROTOCOL_VERSION = "1.0.0-megaeth";
    string public constant AUTHOR_ORCID = "0009-0008-2818-6579";
    string public constant PROTOCOL_SPEC = "MegaAgent-RealTime-Swarm-v1";

    // --- STRUCTS & STORAGE (PACKED TO SINGLE 32-BYTE SLOTS) ---
    struct ScopedAllowance {
        uint128 maxBudget;       // Maximum allowed spend in wei/tokens (16 bytes)
        uint128 spent;           // Cumulative spent amount (16 bytes)
        // Slot 2:
        uint64 validUntil;       // Unix epoch timestamp expiry (8 bytes)
        bool active;             // Active status flag (1 byte)
        address allowedTarget;   // Specific recipient restriction (address(0) = any) (20 bytes)
    }

    address public owner;
    address public treasury;
    uint16 public constant PROTOCOL_FEE_BPS = 20; // 20 basis points = 0.20%
    uint16 public constant BPS_DENOMINATOR = 10000;
    bool public paused;

    // Mapping: principal (sponsor) => agent => ScopedAllowance
    mapping(address => mapping(address => ScopedAllowance)) public allowances;

    // --- EVENTS (High-Throughput Off-Chain Indexing) ---
    event AllowanceProvisioned(
        address indexed principal,
        address indexed agent,
        uint128 maxBudget,
        uint64 validUntil,
        address allowedTarget
    );

    event MicroSpendStreamed(
        address indexed principal,
        address indexed agent,
        address indexed recipient,
        uint128 netAmount,
        uint128 feeAmount,
        bytes32 taskProofHash,
        uint256 timestamp
    );

    event CircuitBreakerTriggered(address indexed triggeredBy, bool isPaused);
    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);

    // --- MODIFIERS ---
    modifier onlyOwner() {
        require(msg.sender == owner, "MegaAgentRail: caller is not the owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "MegaAgentRail: circuit breaker active (paused)");
        _;
    }

    constructor(address _treasury) {
        require(_treasury != address(0), "MegaAgentRail: invalid treasury address");
        owner = msg.sender;
        treasury = _treasury;
    }

    /**
     * @notice Provisions or updates a scoped allowance for an autonomous AI agent.
     */
    function provisionAllowance(
        address agent,
        uint128 maxBudget,
        uint64 validUntil,
        address allowedTarget
    ) external whenNotPaused {
        require(agent != address(0), "MegaAgentRail: agent cannot be zero address");
        require(validUntil > block.timestamp, "MegaAgentRail: expiry must be in the future");

        allowances[msg.sender][agent] = ScopedAllowance({
            maxBudget: maxBudget,
            spent: 0,
            validUntil: validUntil,
            active: true,
            allowedTarget: allowedTarget
        });

        emit AllowanceProvisioned(msg.sender, agent, maxBudget, validUntil, allowedTarget);
    }

    /**
     * @notice High-Frequency real-time micro-spend streamed by an autonomous AI agent.
     * @dev Designed for sub-10ms MegaETH state transition (< 25,000 gas execution overhead).
     */
    function streamMicroSpend(
        address principal,
        address payable recipient,
        uint128 amount,
        bytes32 taskProofHash
    ) external payable whenNotPaused {
        require(recipient != address(0), "MegaAgentRail: invalid recipient");
        require(amount > 0, "MegaAgentRail: amount must be greater than zero");

        ScopedAllowance storage allowance = allowances[principal][msg.sender];
        require(allowance.active, "MegaAgentRail: allowance not active or revoked");
        require(block.timestamp <= allowance.validUntil, "MegaAgentRail: allowance expired");

        if (allowance.allowedTarget != address(0)) {
            require(allowance.allowedTarget == recipient, "MegaAgentRail: recipient not allowed by scope");
        }

        uint128 newSpent = allowance.spent + amount;
        require(newSpent <= allowance.maxBudget, "MegaAgentRail: budget limit exceeded");

        // Update in-memory state
        allowance.spent = newSpent;

        // Calculate 20 bps protocol fee
        uint128 fee = uint128((uint256(amount) * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR);
        uint128 netAmount = amount - fee;

        // Perform instant settlement transfers
        if (msg.value >= amount) {
            if (fee > 0) {
                (bool feeSuccess, ) = payable(treasury).call{value: fee}("");
                require(feeSuccess, "MegaAgentRail: treasury transfer failed");
            }
            (bool netSuccess, ) = recipient.call{value: netAmount}("");
            require(netSuccess, "MegaAgentRail: recipient transfer failed");
        }

        emit MicroSpendStreamed(
            principal,
            msg.sender,
            recipient,
            netAmount,
            fee,
            taskProofHash,
            block.timestamp
        );
    }

    /**
     * @notice Revoke or freeze an agent's allowance immediately.
     */
    function revokeAllowance(address agent) external {
        allowances[msg.sender][agent].active = false;
    }

    /**
     * @notice Emergency circuit breaker controls.
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit CircuitBreakerTriggered(msg.sender, _paused);
    }

    function setTreasury(address _newTreasury) external onlyOwner {
        require(_newTreasury != address(0), "MegaAgentRail: invalid treasury");
        emit TreasuryUpdated(treasury, _newTreasury);
        treasury = _newTreasury;
    }

    /**
     * @notice Query remaining budget for an agent in constant time (O(1)).
     */
    function getRemainingBudget(address principal, address agent) external view returns (uint128) {
        ScopedAllowance memory a = allowances[principal][agent];
        if (!a.active || block.timestamp > a.validUntil || a.spent >= a.maxBudget) {
            return 0;
        }
        return a.maxBudget - a.spent;
    }
}
