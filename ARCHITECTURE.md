# 🏗️ MegaAgent Protocol: System Architecture & Technical Specification

---

## 🏛️ High-Level System Architecture

MegaAgent coordinates real-time streaming settlements and micro-allowance enforcement between autonomous AI agent swarms and the high-throughput MegaETH sequencer.

```mermaid
flowchart TD
    subgraph AgentSwarm["Autonomous AI Agent Swarm"]
        A1["ElizaOS Agent Worker"]
        A2["LangChain Reasoning Loop"]
        A3["Vercel AI SDK Tool Executor"]
    end

    subgraph ClientCore["MegaAgent Client SDK (In-Memory Runtime)"]
        direction TB
        Interceptor["Tool Invocation Interceptor"]
        Limiter["Sliding-Window Velocity Limiter (Nanosecond Resolution)"]
        ReentryGuard["In-Memory Reentrancy Guard (Atomic Lock)"]
        BudgetTracker["Scoped Micro-Allowance Ledger"]
        
        Interceptor --> Limiter
        Limiter --> ReentryGuard
        ReentryGuard --> BudgetTracker
    end

    subgraph MegaETHNetwork["MegaETH Network (100,000 TPS | 1ms Block Time)"]
        Sequencer["Real-Time MegaETH Sequencer"]
        SettlementContract["MegaAgent Settlement Smart Contract (EVM)"]
        StateEngine["In-Memory State Transition Engine"]
        
        Sequencer --> StateEngine
        StateEngine --> SettlementContract
    end

    A1 -->|Micro-Spend Request| Interceptor
    A2 -->|Tool Payment Request| Interceptor
    A3 -->|Vector Retrieval Fee| Interceptor

    BudgetTracker -->|Pipelined Zero-Gas Batch| Sequencer
```

---

## ⚙️ Core Architectural Components

### 1. `MegaAgentClient` (In-Memory Execution Engine)
The primary entrypoint for autonomous agents. Manages private key signers, off-chain EIP-712 typed authorizations, and dispatches sub-10ms micro-payments.
* **Location:** [`src/MegaAgentClient.ts`](https://github.com/MegaAgents/mega-agent/blob/main/src/MegaAgentClient.ts)
* **Zero Overhead:** Employs zero asynchronous network lookups during internal allowance balance verification.

### 2. Nanosecond Sliding-Window Velocity Limiter (`SlidingWindowLimiter`)
Enforces mathematical bounds on micro-spend transaction frequencies:
$$\text{WindowRate} = \sum_{i=1}^{N} \text{SpendAmount}_i \quad \text{for } t_i \in [T_{\text{now}} - \Delta t_{\text{window}}, T_{\text{now}}]$$
* **Resolution:** 64-bit nanosecond timestamps (`hrtime.bigint()`).
* **Protection:** Halts runaway execution loops before transactions are broadcasted to the RPC node.

### 3. Reentrancy Immunity Guard
Ensures that recursive or nested agent callbacks cannot drain funds before the previous state balance has been decremented.
* **Mechanism:** Thread-safe in-memory boolean flag locking the active session context.
* **Rejection Latency:** Deterministic sub-10 microsecond exception throw.

---

## 🔄 Interaction Sequence: Autonomous Micro-Payment Settlement

```mermaid
sequenceDiagram
    autonumber
    actor Agent as Autonomous AI Agent
    participant SDK as MegaAgent Client
    participant Limiter as Sliding-Window Limiter
    participant Sequencer as MegaETH Sequencer (1ms)
    participant Contract as Settlement Vault Contract

    Agent->>SDK: executeToolCall(toolId, allowanceMax)
    SDK->>Limiter: checkVelocity(amount, timestampNs)
    
    alt Velocity Exceeded / Anomaly Detected
        Limiter-->>SDK: REJECT (VelocityBurstException)
        SDK-->>Agent: HALT (Execution Blocked & Logged)
    else Velocity Compliant
        Limiter-->>SDK: ALLOW
        SDK->>SDK: acquireReentrancyLock()
        SDK->>SDK: deductLocalAllowance(amount)
        SDK->>Sequencer: streamMicroSpend(EIP712Signature, recipient, amount)
        Sequencer->>Contract: commitStateTransition(batch)
        Contract-->>Sequencer: confirmed(txHash, blockTime < 1ms)
        Sequencer-->>SDK: settlementReceipt(txHash)
        SDK->>SDK: releaseReentrancyLock()
        SDK-->>Agent: toolExecutionAuthorized(receipt)
    end
```

---

## 💾 Memory Layout & Cryptographic Invariants

```
MegaAgent Session Memory Layout:
┌────────────────────────────────┬──────────┬─────────────────────────────┐
│ Field                          │ Type     │ Purpose                     │
├────────────────────────────────┼──────────┼─────────────────────────────┤
│ agentAddress                   │ Address  │ 20-byte EVM Signer          │
│ totalBudgetAllocated           │ uint128  │ Maximum total budget wei    │
│ totalSpentWei                  │ uint128  │ Cumulative spend accounting │
│ maxSpendPerCallWei             │ uint128  │ Single-call spend limit     │
│ lastSpendTimestampNs           │ uint64   │ Monotonic nanosecond timer  │
│ reentrancyActiveFlag           │ bool     │ 1-byte reentrancy lock      │
│ allowedEndpointsBitmask        │ bytes32  │ Whitelisted tool receptors  │
└────────────────────────────────┴──────────┴─────────────────────────────┘
```

---

## 🔒 Security Invariant Verification

1. **Total Spend Invariant:**
   $$\text{totalSpentWei} \le \text{totalBudgetAllocated} \quad (\forall t)$$
2. **Reentrancy Invariant:**
   $$\text{reentrancyActiveFlag} = \text{true} \implies \text{concurrectSpendCalls} = 0$$
3. **Monotonicity Invariant:**
   $$t_{i+1} \ge t_i \quad (\text{Strict Monotonic Nanosecond Clocks})$$
