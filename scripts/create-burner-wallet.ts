import fs from "fs";
import path from "path";
import { ethers } from "ethers";

function createBurnerWallet() {
  const wallet = ethers.Wallet.createRandom();
  const envPath = path.resolve(".env");

  const envContent = `PRIVATE_KEY=${wallet.privateKey}\nDEPLOYER_ADDRESS=${wallet.address}\n`;
  fs.writeFileSync(envPath, envContent, { flag: "w" });

  console.log("\n=======================================================");
  console.log("[SUCCESS] Fresh MegaETH Burner Testnet Wallet Created!");
  console.log(`Address:     ${wallet.address}`);
  console.log(`Private Key: (Saved securely to local .env - never commit to git)`);
  console.log("=======================================================\n");
  console.log("Next Step:");
  console.log(`1. Open https://testnet.megaeth.com in your browser`);
  console.log(`2. Paste this address: ${wallet.address}`);
  console.log("3. Complete Cloudflare captcha & click 'GET TESTNET TOKENS'");
  console.log("4. Run: npm run deploy:testnet");
  console.log("=======================================================\n");

  return wallet.address;
}

createBurnerWallet();
