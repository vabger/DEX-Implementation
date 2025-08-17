import { deploy } from './web3-lib'

(async () => {
  try {

    console.log("Deploying TokenA...");
    const tokenA = await deploy("Token", ["TokenA", "TKA"], undefined, 5000000);
    console.log(`TokenA deployed at: ${tokenA.address}`);

    console.log("Deploying TokenB...");
    const tokenB = await deploy("Token", ["TokenB", "TKB"], undefined, 5000000);
    console.log(`TokenB deployed at: ${tokenB.address}`);

    console.log("Deploying DEX...");
    const dex = await deploy("DEX", [tokenA.address, tokenB.address], undefined, 5000000);
    console.log(`DEX deployed at: ${dex.address}`);

    console.log("Deployment complete.");
    const deployedAddresses = {
      tokenA: tokenA.address,
      tokenB: tokenB.address,
      dex: dex.address
    };

    const filePath = "browser/deployedAddresses.json";
    await remix.call("fileManager", "writeFile", filePath, JSON.stringify(deployedAddresses, null, 2));
    console.log("Contract addresses stored in", filePath);
  } catch (e: any) {
    console.error("Deployment error:", e.message);
  }
})();
