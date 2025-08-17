let tokenA, tokenB, dex1, dex2, arbitrage, lpt1, lpt2;

const ART_TOKEN_PATH = "browser/contracts/artifacts/Token.json";
const ART_DEX_PATH = "browser/contracts/artifacts/DEX.json";
const ART_ARBITRAGE_PATH = "browser/contracts/artifacts/Arbitrage.json";
const ART_LPT_PATH = "browser/contracts/artifacts/LPToken.json"

const toWei = (n) => web3.utils.toWei(n.toString(), "ether");
const fromWei = (x) => parseFloat(web3.utils.fromWei(x));

async function loadArtifact(path) {
  const json = await remix.call('fileManager', 'getFile', path);
  if (!json) throw new Error(`Artifact not found`);
  return JSON.parse(json);
}

async function getStoredAddresses() {
  const filePath = "browser/deployedAddressesArbitrage.json";
  const content = await remix.call("fileManager", "getFile", filePath);
  if (!content) {
    throw new Error("File not Found!");
  }
  return JSON.parse(content);
}

async function fetchContractObjects() {
  const contractAddresses = await getStoredAddresses()

  const tokenAAddress = contractAddresses.tokenA
  const tokenBAddress = contractAddresses.tokenB
  const dex1Address = contractAddresses.dex1
  const dex2Address = contractAddresses.dex2
  const arbitrageAddress = contractAddresses.arbitrage

  const artToken = await loadArtifact(ART_TOKEN_PATH);
  const artDEX = await loadArtifact(ART_DEX_PATH);
  const artArbitrage = await loadArtifact(ART_ARBITRAGE_PATH);
  const artLPT = await loadArtifact(ART_LPT_PATH);

  tokenA = new web3.eth.Contract(artToken.abi, tokenAAddress);
  tokenB = new web3.eth.Contract(artToken.abi, tokenBAddress);
  dex1 = new web3.eth.Contract(artDEX.abi, dex1Address);
  dex2 = new web3.eth.Contract(artDEX.abi, dex2Address);
  arbitrage = new web3.eth.Contract(artArbitrage.abi, arbitrageAddress);

  const lptAddress1 = await dex1.methods.LPT().call();
  lpt1 = new web3.eth.Contract(artLPT.abi, lptAddress1);

  const lptAddress2 = await dex2.methods.LPT().call();
  lpt2 = new web3.eth.Contract(artLPT.abi, lptAddress2);
}

async function executeArbitrage(arbitrageAmount, trader) {
  const balanceBefore = await tokenA.methods.balanceOf(trader).call()
  console.log("Trader Token A balance before arbitrage:", fromWei(balanceBefore));

  await tokenA.methods.approve(arbitrage.options.address, toWei(arbitrageAmount)).send({ from: trader })
  await arbitrage.methods.executeArbitrage(toWei(arbitrageAmount)).send({ from: trader })
  console.log("Arbitrage executed successfully");

  const balanceAfter = await tokenA.methods.balanceOf(trader).call()
  console.log("Trader Token A balance after arbitrage:", fromWei(balanceAfter));
}

async function setDexConfiguration(reserveA1, reserveB1, reserveA2, reserveB2, deployer) {
  await tokenA.methods.approve(dex1.options.address, toWei(reserveA1)).send({ from: deployer })
  await tokenB.methods.approve(dex1.options.address, toWei(reserveB1)).send({ from: deployer })
  await dex1.methods.addLiquidity(toWei(reserveA1), toWei(reserveB1)).send({ from: deployer })

  await tokenA.methods.approve(dex2.options.address, toWei(reserveA2)).send({ from: deployer })
  await tokenB.methods.approve(dex2.options.address, toWei(reserveB2)).send({ from: deployer })
  await dex2.methods.addLiquidity(toWei(reserveA2), toWei(reserveB2)).send({ from: deployer })
}

async function simulateArbitrageScenarios() {
  const accounts = await web3.eth.getAccounts();

  const deployer = accounts[0];
  const trader = accounts[1];

  console.log("Deployer:", deployer);
  console.log("Trader:", trader);

  // ----------------------------------------------------------------
  // Scenario 1: Profitable Arbitrage
  // ----------------------------------------------------------------
  console.log("\n--- Scenario 1: Profitable Arbitrage Execution ---");

  // DEX configuration:
  //   DEX1: reserveA = 1000 TKA, reserveB = 2100 TKB
  //   DEX2: reserveA = 1000 TKA, reserveB = 2000 TKB

  const reserveA1_profit = 1000
  const reserveB1_profit = 1100
  const reserveA2_profit = 1000
  const reserveB2_profit = 1000
  const arbitrageAmount = 10

  await tokenA.methods.mint(deployer, toWei(reserveA1_profit + reserveA2_profit)).send({ from: deployer })
  await tokenB.methods.mint(deployer, toWei(reserveB1_profit + reserveB2_profit)).send({ from: deployer })
  await tokenA.methods.mint(trader, toWei(arbitrageAmount)).send({ from: deployer })

  await setDexConfiguration(reserveA1_profit, reserveB1_profit, reserveA2_profit, reserveB2_profit, deployer);

  // Execute arbitrage (expected to succeed)
  console.log("Executing profitable arbitrage...");
  try {
    await executeArbitrage(arbitrageAmount, trader)
  } catch (error) {
    console.error("Error during profitable arbitrage simulation:", error.message);
  }

  // Reset the Reserves
  await dex1.methods.removeLiquidity(await lpt1.methods.balanceOf(deployer).call()).send({ from: deployer });
  await dex2.methods.removeLiquidity(await lpt2.methods.balanceOf(deployer).call()).send({ from: deployer });

  // ----------------------------------------------------------------
  // Scenario 2: Failed Arbitrage (Insufficient Profit) for same input amount
  // ----------------------------------------------------------------
  console.log("\n--- Scenario 2: Failed Arbitrage Execution (Insufficient Profit) ---");

  // Ratio of the reserves is same so the arbitrage will not be possible
  const reserveA1_insuff = 1000
  const reserveB1_insuff = 1000
  const reserveA2_insuff = 1000
  const reserveB2_insuff = 1000

  await tokenA.methods.mint(deployer, toWei(reserveA1_profit + reserveA2_profit)).send({ from: deployer })
  await tokenB.methods.mint(deployer, toWei(reserveB1_profit + reserveB2_profit)).send({ from: deployer })

  await setDexConfiguration(reserveA1_insuff, reserveB1_insuff, reserveA2_insuff, reserveB2_insuff, deployer);

  console.log("Executing insufficient profit arbitrage...");
  try {
    await executeArbitrage(arbitrageAmount, trader)
  } catch (error) {
    console.error("Arbitrage failed due to insufficient profit!", error.message);
  }

  // Reset the Reserves
  await dex1.methods.removeLiquidity(await lpt1.methods.balanceOf(deployer).call()).send({ from: deployer });
  await dex2.methods.removeLiquidity(await lpt2.methods.balanceOf(deployer).call()).send({ from: deployer });

}

async function main() {
  await fetchContractObjects()
  await simulateArbitrageScenarios()
}

main()
  .then(() => console.log("Simulation completed"))
  .catch(err => console.error("Simulation encountered an error:", err));
