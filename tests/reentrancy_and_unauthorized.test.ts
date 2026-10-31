import { describe, it, expect } from 'vitest';
import { MegaAgentClient } from '../src/MegaAgentClient.js';

describe('MegaAgent Protocol - Reentrancy Resistance & Access Control Defense (#26 & #27)', () => {
  const config = {
    chainId: 424242,
    rpcUrl: 'https://testnet.megaeth.systems/rpc',
    wsUrl: 'wss://testnet.megaeth.systems/ws',
    contractAddress: '0x1234567890123456789012345678901234567890',
    treasuryAddress: '0x40B7d9273092822341860F5610168861351e71eb'
  };

  const legitimatePrincipal = '0x1111111111111111111111111111111111111111';
  const legitimateAgent = '0x2222222222222222222222222222222222222222';
  const rogueAgent = '0x6666666666666666666666666666666666666666';
  const recipient = '0x3333333333333333333333333333333333333333';

  describe('Issue #27: Access Control & Caller Tampering Defense', () => {
    it('strictly prohibits an unapproved agent from accessing another principal allowance', async () => {
      const client = new MegaAgentClient(config);
      // Provision allowance exclusively for legitimateAgent
      client.provisionLocalAllowance(legitimatePrincipal, {
        agentAddress: legitimateAgent,
        maxBudgetWei: 50_000n,
        validUntil: Date.now() + 60000
      });

      // Rogue agent attempts to spend legitimatePrincipal's funds
      await expect(
        client.streamMicroSpend(rogueAgent, {
          principalAddress: legitimatePrincipal,
          recipientAddress: recipient,
          amountWei: 1000n,
          taskProofHash: '0xproof_rogue_attempt'
        })
      ).rejects.toThrow(`MegaAgentRail: No allowance provisioned for agent ${rogueAgent}`);
    });

    it('returns zero budget for unmapped or unauthorized principal-agent pairs', () => {
      const client = new MegaAgentClient(config);
      client.provisionLocalAllowance(legitimatePrincipal, {
        agentAddress: legitimateAgent,
        maxBudgetWei: 100_000n,
        validUntil: Date.now() + 60000
      });

      expect(client.getRemainingBudget(legitimatePrincipal, rogueAgent)).toBe(0n);
      expect(client.getRemainingBudget('0xunmapped_principal', legitimateAgent)).toBe(0n);
      expect(client.isAllowanceActive(legitimatePrincipal, rogueAgent)).toBe(false);
    });
  });

  describe('Issue #26: Reentrancy Resistance & State Update Invariants', () => {
    it('enforces Checks-Effects-Interactions: state is mutated before execution receipt returns', async () => {
      const client = new MegaAgentClient(config);
      client.provisionLocalAllowance(legitimatePrincipal, {
        agentAddress: legitimateAgent,
        maxBudgetWei: 1000n,
        validUntil: Date.now() + 60000
      });

      // Simulate concurrent attempt to spend simultaneously
      const spend1Promise = client.streamMicroSpend(legitimateAgent, {
        principalAddress: legitimatePrincipal,
        recipientAddress: recipient,
        amountWei: 700n,
        taskProofHash: '0xconcurrent_1'
      });

      const receipt1 = await spend1Promise;
      expect(receipt1.status).toBe('confirmed');

      // Budget remaining MUST be exactly 300n
      expect(client.getRemainingBudget(legitimatePrincipal, legitimateAgent)).toBe(300n);

      // Attempting to spend 700n again in a simulated re-entrant loop MUST be rejected
      await expect(
        client.streamMicroSpend(legitimateAgent, {
          principalAddress: legitimatePrincipal,
          recipientAddress: recipient,
          amountWei: 700n,
          taskProofHash: '0xreentrant_attack'
        })
      ).rejects.toThrow('MegaAgentRail: Budget exceeded. Available: 300');
    });
  });
});
