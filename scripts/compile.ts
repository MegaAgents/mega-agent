import fs from "fs";
import path from "path";
import solc from "solc";

export function compileContract() {
  const contractPath = path.resolve("contracts", "MegaAgentRail.sol");
  const source = fs.readFileSync(contractPath, "utf8");

  const input = {
    language: "Solidity",
    sources: {
      "MegaAgentRail.sol": {
        content: source,
      },
    },
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode"],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors) {
    for (const error of output.errors) {
      if (error.severity === "error") {
        console.error("Compilation error:", error.formattedMessage);
        throw new Error(error.formattedMessage);
      } else {
        console.warn("Compilation warning:", error.formattedMessage);
      }
    }
  }

  const contract = output.contracts["MegaAgentRail.sol"]["MegaAgentRail"];
  const abi = contract.abi;
  const bytecode = contract.evm.bytecode.object;

  fs.mkdirSync(path.resolve("dist", "contracts"), { recursive: true });
  fs.writeFileSync(
    path.resolve("dist", "contracts", "MegaAgentRail.json"),
    JSON.stringify({ abi, bytecode }, null, 2)
  );

  console.log("[SUCCESS] MegaAgentRail.sol compiled successfully!");
  console.log(`Bytecode size: ${bytecode.length / 2} bytes`);
  return { abi, bytecode };
}

compileContract();
