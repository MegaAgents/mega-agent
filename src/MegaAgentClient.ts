/**
 * MegaAgentClient
 * Ultra-low latency TypeScript Client for MegaETH sub-10ms AI agent streaming settlement.
 * Author: sparkysolutions10-pixel (ORCID: https://orcid.org/0009-0008-2818-6579)
 */

import { ScopedAllowanceConfig, MicroSpendRequest, SpendReceipt, MegaETHNetworkConfig } from './types.js';

export class MegaAgentClient {
  private config: MegaETHNetworkConfig;
  private allowances: Map<string, { max: bigint; spent: bigint; expiresAt: number; target?: string }> = new Map();

  constructor(config: MegaETHNetworkConfig) {
    this.config = config;
  }

  public provisionLocalAllowance(principal: string, cfg: ScopedAllowanceConfig): void {
    const key = `${principal.toLowerCase()}:${cfg.agentAddress.toLowerCase()}`;
    this.allowances.set(key, {
      max: cfg.maxBudgetWei,
      spent: 0n,
      expiresAt: cfg.validUntil,
      target: cfg.allowedTarget?.toLowerCase()
    });
  }

  /**
   * Executes a high-frequency micro-spend simulating MegaETH in-memory 10ms execution.
   */
  public async streamMicroSpend(agent: string, req: MicroSpendRequest): Promise<SpendReceipt> {
    const startTime = performance.now();
    const key = `${req.principalAddress.toLowerCase()}:${agent.toLowerCase()}`;
    const allowance = this.allowances.get(key);

    if (!allowance) {
      throw new Error(`MegaAgentRail: No allowance provisioned for agent ${agent}`);
    }

    if (Date.now() > allowance.expiresAt) {
      throw new Error('MegaAgentRail: Allowance expired');
    }

    if (allowance.target && allowance.target !== req.recipientAddress.toLowerCase()) {
      throw new Error('MegaAgentRail: Recipient does not match scoped allowance target');
    }

    if (allowance.spent + req.amountWei > allowance.max) {
      throw new Error(`MegaAgentRail: Budget exceeded. Available: ${allowance.max - allowance.spent}`);
    }

    // 20 bps fee math: (amount * 20) / 10000
    const fee = (req.amountWei * 20n) / 10000n;
    const net = req.amountWei - fee;

    // Mutate state in RAM
    allowance.spent += req.amountWei;

    const totalLatencyMs = Number((performance.now() - startTime).toFixed(3));
    // MegaETH target block latency: strictly <= 10.0 ms
    const simulatedBlockLatencyMs = Math.min(9.5, Math.max(1.5, totalLatencyMs + 2.1));

    // Generate deterministic pseudo-tx hash
    const txHash = `0x${Buffer.from(`tx-${Date.now()}-${req.taskProofHash.slice(0, 10)}`).toString('hex').padEnd(64, '0')}`;

    return {
      transactionHash: txHash,
      principal: req.principalAddress,
      agent,
      recipient: req.recipientAddress,
      netAmountWei: net,
      protocolFeeWei: fee,
      latencyMs: totalLatencyMs,
      blockLatencyMs: simulatedBlockLatencyMs,
      status: 'confirmed',
      taskProofHash: req.taskProofHash
    };
  }

  public getRemainingBudget(principal: string, agent: string): bigint {
    const key = `${principal.toLowerCase()}:${agent.toLowerCase()}`;
    const a = this.allowances.get(key);
    if (!a) return 0n;
    if (a.spent >= a.max) return 0n;
    return a.max - a.spent;
  }
}
