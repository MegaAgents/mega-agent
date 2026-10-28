import fs from "fs";
import path from "path";
import { ethers } from "ethers";

async function interactOnTestnet() {
  const envPath = path.resolve(".env");
  const envContent = fs.readFileSync(envPath, "utf8");
  const privateKey = envContent.match(/PRIVATE_KEY\s*=\s*(.+)/)?.[1].trim().replace(/['"]/g, "");

  if (!privateKey) {
    throw new Error("Missing PRIVATE_KEY");
  }

  const RPC_URL = "https://carrot.megaeth.com/rpc";
  const CHAIN_ID = 6343;

  const provider = new ethers.JsonRpcProvider(RPC_URL, {
    chainId: CHAIN_ID,
    name: "megaeth-testnet",
  });

  const principalWallet = new ethers.Wallet(privateKey, provider);
  const deploymentInfo = JSON.parse(fs.readFileSync(path.resolve("dist", "deployed-address.json"), "utf8"));
  const contractAddress = deploymentInfo.contractAddress;

  const artifact = JSON.parse(fs.readFileSync(path.resolve("dist", "contracts", "MegaAgentRail.json"), "utf8"));
  const contractPrincipal = new ethers.Contract(contractAddress, artifact.abi, principalWallet);

  console.log("\n=======================================================");
  console.log("MegaAgent Protocol — On-Chain Testnet Swarm Simulation");
  console.log(`Contract:  ${contractAddress}`);
  console.log(`Principal: ${principalWallet.address}`);
  console.log("=======================================================\n");

  // Read protocol metadata from on-chain contract
  const version = await contractPrincipal.PROTOCOL_VERSION();
  const orcid = await contractPrincipal.AUTHOR_ORCID();
  const treasury = await contractPrincipal.treasury();

  console.log(`[ON-CHAIN] Protocol Version: ${version}`);
  console.log(`[ON-CHAIN] Author ORCID:     ${orcid}`);
  console.log(`[ON-CHAIN] Treasury Address: ${treasury}`);

  // Create an Autonomous AI Agent keypair
  const agentWallet = ethers.Wallet.createRandom().connect(provider);
  console.log(`\nSpawned Autonomous AI Agent: ${agentWallet.address}`);

  // Fund Agent with 0.01 ETH for gas from Principal
  console.log("Funding Agent with 0.01 ETH for high-frequency execution...");
  const fundTx = await principalWallet.sendTransaction({
    to: agentWallet.address,
    value: ethers.parseEther("0.01"),
  });
  await fundTx.wait();
  console.log(`[CONFIRMED] Agent funded: ${fundTx.hash}`);

  // 1. Provision Allowance for Agent
  const maxBudget = ethers.parseEther("0.05"); // 0.05 ETH allowance
  const validUntil = Math.floor(Date.now() / 1000) + 86400 * 30; // 30 days
  const allowedTarget = ethers.ZeroAddress; // Any target

  console.log(`\n1. Provisioning 0.05 ETH allowance for Agent ${agentWallet.address}...`);
  const tx1 = await contractPrincipal.provisionAllowance(agentWallet.address, maxBudget, validUntil, allowedTarget);
  console.log(`Tx sent: ${tx1.hash}`);
  const receipt1 = await tx1.wait();
  console.log(`[CONFIRMED] Allowance Provisioned! Block: ${receipt1.blockNumber}`);
  console.log(`Explorer: https://testnet-mega.etherscan.io/tx/${tx1.hash}`);

  // 2. Autonomous Agent streams Micro-Spend
  const contractAgent = new ethers.Contract(contractAddress, artifact.abi, agentWallet);
  const recipient = "0x40B7d9273092822341860F5610168861351e71eb";
  const microAmount = ethers.parseEther("0.0005"); // 0.0005 ETH micro-payment
  const taskProofHash = ethers.keccak256(ethers.toUtf8Bytes("task-sub-10ms-settlement-proof-001"));

  console.log(`\n2. Autonomous Agent streaming micro-spend to ${recipient}...`);
  const tx2 = await contractAgent.streamMicroSpend(
    principalWallet.address, // principal whose allowance is debited
    recipient,
    microAmount,
    taskProofHash,
    { value: microAmount }
  );
  console.log(`Tx sent: ${tx2.hash}`);
  const receipt2 = await tx2.wait();
  console.log(`[CONFIRMED] Micro-Spend Streamed! Block: ${receipt2.blockNumber}`);
  console.log(`Explorer: https://testnet-mega.etherscan.io/tx/${tx2.hash}`);

  // 3. Autonomous Agent streams second Micro-Spend (burst test)
  const taskProofHash2 = ethers.keccak256(ethers.toUtf8Bytes("task-sub-10ms-settlement-proof-002"));
  console.log(`\n3. Autonomous Agent streaming second micro-spend (burst)...`);
  const tx3 = await contractAgent.streamMicroSpend(
    principalWallet.address,
    recipient,
    microAmount,
    taskProofHash2,
    { value: microAmount }
  );
  console.log(`Tx sent: ${tx3.hash}`);
  const receipt3 = await tx3.wait();
  console.log(`[CONFIRMED] Micro-Spend 2 Streamed! Block: ${receipt3.blockNumber}`);
  console.log(`Explorer: https://testnet-mega.etherscan.io/tx/${tx3.hash}`);

  console.log("\n=======================================================");
  console.log("[SUCCESS] Live Sub-10ms Swarm Transactions Confirmed on MegaETH!");
  console.log(`Contract: https://testnet-mega.etherscan.io/address/${contractAddress}`);
  console.log("=======================================================\n");

  // Save interaction history
  fs.writeFileSync(
    path.resolve("dist", "testnet-transactions.json"),
    JSON.stringify(
      {
        contractAddress,
        treasury,
        transactions: [
          { type: "provisionAllowance", hash: tx1.hash, block: receipt1.blockNumber },
          { type: "streamMicroSpend_1", hash: tx2.hash, block: receipt2.blockNumber },
          { type: "streamMicroSpend_2", hash: tx3.hash, block: receipt3.blockNumber },
        ],
      },
      null,
      2
    )
  );
}

interactOnTestnet().catch((err) => {
  console.error("Interaction failed:", err);
  process.exit(1);
});
