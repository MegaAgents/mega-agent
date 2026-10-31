/**
 * MegaAgent - Real-Time High-Frequency AI Swarm Protocol
 * Author: sparkysolutions10-pixel (ORCID: https://orcid.org/0009-0008-2818-6579)
 */

export interface ScopedAllowanceConfig {
  agentAddress: string;
  maxBudgetWei: bigint;
  validUntil: number;
  allowedTarget?: string;
  maxVelocitySpendsPerSecond?: number;
  velocityWindowMs?: number;
}

export interface MicroSpendRequest {
  principalAddress: string;
  recipientAddress: string;
  amountWei: bigint;
  taskProofHash: string;
}

export interface SpendReceipt {
  transactionHash: string;
  principal: string;
  agent: string;
  recipient: string;
  netAmountWei: bigint;
  protocolFeeWei: bigint;
  latencyMs: number;
  blockLatencyMs: number;
  status: 'confirmed' | 'reverted';
  taskProofHash: string;
}

export interface MegaETHNetworkConfig {
  chainId: number;
  rpcUrl: string;
  wsUrl: string;
  contractAddress: string;
  treasuryAddress: string;
}
