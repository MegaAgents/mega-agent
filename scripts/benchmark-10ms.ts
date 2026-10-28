/**
 * MegaAgent High-Frequency Benchmark
 * Measures sub-10ms latency across 1,000 synthetic AI agent micro-spend transactions.
 * Author: sparkysolutions10-pixel (ORCID: https://orcid.org/0009-0008-2818-6579)
 */

import { MegaAgentClient } from '../src/MegaAgentClient.js';

async function run10msBenchmark() {
  console.log('='.repeat(80));
  console.log('⚡ MEGAAGENT HIGH-FREQUENCY BENCHMARK: SUB-10MS MEGAETH ENGINE');
  console.log('Author ORCID: https://orcid.org/0009-0008-2818-6579');
  console.log('='.repeat(80));

  const client = new MegaAgentClient({
    chainId: 424242,
    rpcUrl: 'https://testnet.megaeth.systems/rpc',
    wsUrl: 'wss://testnet.megaeth.systems/ws',
    contractAddress: '0x1234567890123456789012345678901234567890',
    treasuryAddress: '0x40B7d9273092822341860F5610168861351e71eb'
  });

  const principal = '0x1111111111111111111111111111111111111111';
  const agent = '0x2222222222222222222222222222222222222222';
  const recipient = '0x3333333333333333333333333333333333333333';

  // Provision $10,000 equivalent budget
  client.provisionLocalAllowance(principal, {
    agentAddress: agent,
    maxBudgetWei: 10_000_000_000_000_000_000n, // 10 ETH
    validUntil: Date.now() + 86400000
  });

  const SAMPLES = 1000;
  const latencies: number[] = [];

  console.log(`\nStreaming ${SAMPLES} autonomous AI agent micro-transactions...`);
  const startAll = performance.now();

  for (let i = 0; i < SAMPLES; i++) {
    const t0 = performance.now();
    const receipt = await client.streamMicroSpend(agent, {
      principalAddress: principal,
      recipientAddress: recipient,
      amountWei: 1_000_000_000_000_000n, // 0.001 ETH
      taskProofHash: `0xhash_${i}_${Date.now()}`
    });
    const t1 = performance.now();
    latencies.push(t1 - t0);
  }

  const durationSec = (performance.now() - startAll) / 1000;
  latencies.sort((a, b) => a - b);

  const p50 = latencies[Math.floor(SAMPLES * 0.50)].toFixed(3);
  const p95 = latencies[Math.floor(SAMPLES * 0.95)].toFixed(3);
  const p99 = latencies[Math.floor(SAMPLES * 0.99)].toFixed(3);
  const tps = (SAMPLES / durationSec).toFixed(1);

  console.log(`\n--- BENCHMARK RESULTS ---`);
  console.log(`• Total Processed Transactions: ${SAMPLES}`);
  console.log(`• Total Elapsed Time:           ${durationSec.toFixed(3)}s`);
  console.log(`• Throughput:                   ${tps} tx/sec`);
  console.log(`• Median Latency (p50):         ${p50} ms`);
  console.log(`• 95th Percentile (p95):        ${p95} ms`);
  console.log(`• 99th Percentile (p99):        ${p99} ms (TARGET: < 10.0 ms)`);
  console.log(`• Sub-10ms Invariant:           ${Number(p99) < 10.0 ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log('='.repeat(80));
}

run10msBenchmark().catch(console.error);
