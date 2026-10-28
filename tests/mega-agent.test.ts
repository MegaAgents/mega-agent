import { describe, it, expect } from 'vitest';
import { MegaAgentClient } from '../src/MegaAgentClient.js';

describe('MegaAgent Protocol - Sub-10ms Swarm Settlement', () => {
  const config = {
    chainId: 424242,
    rpcUrl: 'https://testnet.megaeth.systems/rpc',
    wsUrl: 'wss://testnet.megaeth.systems/ws',
    contractAddress: '0x1234567890123456789012345678901234567890',
    treasuryAddress: '0x40B7d9273092822341860F5610168861351e71eb'
  };

  const principal = '0x1111111111111111111111111111111111111111';
  const agent = '0x2222222222222222222222222222222222222222';
  const recipient = '0x3333333333333333333333333333333333333333';

  it('correctly calculates 20 bps protocol fee on micro-transactions', async () => {
    const client = new MegaAgentClient(config);
    client.provisionLocalAllowance(principal, {
      agentAddress: agent,
      maxBudgetWei: 10_000_000n,
      validUntil: Date.now() + 60000
    });

    const receipt = await client.streamMicroSpend(agent, {
      principalAddress: principal,
      recipientAddress: recipient,
      amountWei: 10_000n, // 10,000 units
      taskProofHash: '0xproof_test_01'
    });

    // 20 bps of 10,000 = 20
    expect(receipt.protocolFeeWei).toBe(20n);
    expect(receipt.netAmountWei).toBe(9980n);
    expect(receipt.status).toBe('confirmed');
    expect(client.getRemainingBudget(principal, agent)).toBe(9_990_000n);
  });

  it('enforces maximum budget ceiling without overspend', async () => {
    const client = new MegaAgentClient(config);
    client.provisionLocalAllowance(principal, {
      agentAddress: agent,
      maxBudgetWei: 500n,
      validUntil: Date.now() + 60000
    });

    // First spend 400
    await client.streamMicroSpend(agent, {
      principalAddress: principal,
      recipientAddress: recipient,
      amountWei: 400n,
      taskProofHash: '0xproof_01'
    });

    // Second spend 200 should fail (400 + 200 > 500)
    await expect(
      client.streamMicroSpend(agent, {
        principalAddress: principal,
        recipientAddress: recipient,
        amountWei: 200n,
        taskProofHash: '0xproof_02'
      })
    ).rejects.toThrow('MegaAgentRail: Budget exceeded');
  });

  it('enforces recipient address scope restrictions', async () => {
    const client = new MegaAgentClient(config);
    client.provisionLocalAllowance(principal, {
      agentAddress: agent,
      maxBudgetWei: 1000n,
      validUntil: Date.now() + 60000,
      allowedTarget: recipient // ONLY recipient allowed
    });

    const unauthorizedRecipient = '0x9999999999999999999999999999999999999999';

    await expect(
      client.streamMicroSpend(agent, {
        principalAddress: principal,
        recipientAddress: unauthorizedRecipient,
        amountWei: 100n,
        taskProofHash: '0xproof_unauth'
      })
    ).rejects.toThrow('Recipient does not match scoped allowance target');
  });

  it('guarantees execution latency is strictly sub-10ms', async () => {
    const client = new MegaAgentClient(config);
    client.provisionLocalAllowance(principal, {
      agentAddress: agent,
      maxBudgetWei: 1_000_000n,
      validUntil: Date.now() + 60000
    });

    const receipt = await client.streamMicroSpend(agent, {
      principalAddress: principal,
      recipientAddress: recipient,
      amountWei: 100n,
      taskProofHash: '0xproof_latency'
    });

    expect(receipt.latencyMs).toBeLessThan(10.0);
    expect(receipt.blockLatencyMs).toBeLessThanOrEqual(10.0);
  });
});
