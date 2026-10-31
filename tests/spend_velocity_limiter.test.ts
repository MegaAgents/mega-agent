import { describe, it, expect } from 'vitest';
import { MegaAgentClient } from '../src/MegaAgentClient.js';

describe('MegaAgent Protocol - Spend Velocity Limiter & Runaway Loop Defense (#25)', () => {
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

  it('allows high-frequency micro-spends within configured velocity ceiling', async () => {
    const client = new MegaAgentClient(config);
    client.provisionLocalAllowance(principal, {
      agentAddress: agent,
      maxBudgetWei: 1_000_000n,
      validUntil: Date.now() + 60000,
      maxVelocitySpendsPerSecond: 5 // Max 5 spends per second
    });

    // 4 spends within velocity should succeed cleanly
    for (let i = 0; i < 4; i++) {
      const receipt = await client.streamMicroSpend(agent, {
        principalAddress: principal,
        recipientAddress: recipient,
        amountWei: 100n,
        taskProofHash: `0xproof_normal_${i}`
      });
      expect(receipt.status).toBe('confirmed');
    }

    expect(client.isAllowanceActive(principal, agent)).toBe(true);
    expect(client.getRemainingBudget(principal, agent)).toBe(999_600n);
  });

  it('halts runaway agent loop and automatically revokes allowance when velocity ceiling is breached', async () => {
    const client = new MegaAgentClient(config);
    client.provisionLocalAllowance(principal, {
      agentAddress: agent,
      maxBudgetWei: 1_000_000n,
      validUntil: Date.now() + 60000,
      maxVelocitySpendsPerSecond: 3 // Max 3 spends per second
    });

    // 1st spend: PASS
    await client.streamMicroSpend(agent, {
      principalAddress: principal,
      recipientAddress: recipient,
      amountWei: 100n,
      taskProofHash: '0xproof_loop_1'
    });

    // 2nd spend: PASS
    await client.streamMicroSpend(agent, {
      principalAddress: principal,
      recipientAddress: recipient,
      amountWei: 100n,
      taskProofHash: '0xproof_loop_2'
    });

    // 3rd spend: PASS
    await client.streamMicroSpend(agent, {
      principalAddress: principal,
      recipientAddress: recipient,
      amountWei: 100n,
      taskProofHash: '0xproof_loop_3'
    });

    // 4th burst spend in same second: MUST TRIP VELOCITY BREAKER & AUTO-REVOKE
    await expect(
      client.streamMicroSpend(agent, {
        principalAddress: principal,
        recipientAddress: recipient,
        amountWei: 100n,
        taskProofHash: '0xproof_loop_4'
      })
    ).rejects.toThrow('Velocity limit exceeded (3 spends in 1000ms). Automated circuit breaker triggered: allowance revoked to prevent runaway loop');

    // Verify allowance is now revoked in state
    expect(client.isAllowanceActive(principal, agent)).toBe(false);
    expect(client.getRemainingBudget(principal, agent)).toBe(0n);

    // Any subsequent spend (even with available budget) MUST be permanently blocked
    await expect(
      client.streamMicroSpend(agent, {
        principalAddress: principal,
        recipientAddress: recipient,
        amountWei: 100n,
        taskProofHash: '0xproof_loop_subsequent'
      })
    ).rejects.toThrow('MegaAgentRail: Allowance has been revoked or frozen');
  });

  it('manual revokeAllowance immediately freezes agent spend capabilities', async () => {
    const client = new MegaAgentClient(config);
    client.provisionLocalAllowance(principal, {
      agentAddress: agent,
      maxBudgetWei: 50_000n,
      validUntil: Date.now() + 60000
    });

    expect(client.isAllowanceActive(principal, agent)).toBe(true);

    // Principal revokes allowance
    client.revokeAllowance(principal, agent);

    expect(client.isAllowanceActive(principal, agent)).toBe(false);

    await expect(
      client.streamMicroSpend(agent, {
        principalAddress: principal,
        recipientAddress: recipient,
        amountWei: 100n,
        taskProofHash: '0xproof_revoked'
      })
    ).rejects.toThrow('MegaAgentRail: Allowance has been revoked or frozen');
  });
});
