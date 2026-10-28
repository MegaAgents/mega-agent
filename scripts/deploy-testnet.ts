import fs from "fs";
import path from "path";
import { ethers } from "ethers";

async function deployToMegaETH() {
  const envPath = path.resolve(".env");
  let privateKey = process.env.PRIVATE_KEY;

  if (!privateKey && fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    const match = envContent.match(/PRIVATE_KEY\s*=\s*(.+)/);
    if (match) {
      privateKey = match[1].trim().replace(/['"]/g, "");
    }
  }

  if (!privateKey) {
    console.error("[ERROR] Missing PRIVATE_KEY!");
    console.error("Please create a .env file with your testnet burner private key:");
    console.error("PRIVATE_KEY=0x...");
    process.exit(1);
  }

  // MegaETH Carrot Testnet Configuration
  const RPC_URL = "https://carrot.megaeth.com/rpc";
  const CHAIN_ID = 6343;
  const TREASURY = "0x40B7d9273092822341860F5610168861351e71eb";

  console.log("Connecting to MegaETH Carrot Testnet...");
  console.log(`RPC: ${RPC_URL} (Chain ID: ${CHAIN_ID})`);

  const provider = new ethers.JsonRpcProvider(RPC_URL, {
    chainId: CHAIN_ID,
    name: "megaeth-testnet",
  });

  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`Deployer Address: ${wallet.address}`);

  const balance = await provider.getBalance(wallet.address);
  console.log(`Deployer Balance: ${ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    console.error("[ERROR] Insufficient funds! Balance is 0 ETH.");
    console.error("Please claim free testnet ETH at: https://testnet.megaeth.com");
    console.error(`Target Address: ${wallet.address}`);
    process.exit(1);
  }

  // Load compiled artifact
  const artifactPath = path.resolve("dist", "contracts", "MegaAgentRail.json");
  if (!fs.existsSync(artifactPath)) {
    console.error("[ERROR] Contract artifact not found. Run compile first.");
    process.exit(1);
  }

  const { abi, bytecode } = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  console.log("\nDeploying MegaAgentRail to MegaETH Carrot Testnet...");
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const contract = await factory.deploy(TREASURY);

  console.log(`Transaction sent! Tx Hash: ${contract.deploymentTransaction()?.hash}`);
  console.log("Waiting for block confirmation on MegaETH (< 10ms block time)...");

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  console.log("\n=======================================================");
  console.log("[SUCCESS] MegaAgentRail Deployed Successfully!");
  console.log(`Contract Address: ${contractAddress}`);
  console.log(`Explorer: https://testnet-mega.etherscan.io/address/${contractAddress}`);
  console.log("=======================================================\n");

  fs.writeFileSync(
    path.resolve("dist", "deployed-address.json"),
    JSON.stringify(
      {
        network: "megaeth-carrot-testnet",
        chainId: CHAIN_ID,
        contractAddress,
        treasury: TREASURY,
        txHash: contract.deploymentTransaction()?.hash,
        deployedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );
}

deployToMegaETH().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
