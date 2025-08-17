# DEX & Arbitrage Simulation

This project contains smart contracts and simulation scripts for a decentralized exchange (DEX) and arbitrage contracts.

## Files Overview

- **contracts/DEX.sol**: AMM-based decentralized exchange contract.
- **contracts/arbitrage.sol**: Contract implementing arbitrage across two DEX instances.
- **contracts/LPToken.sol**: ERC20-based liquidity provider token for representing pool shares.
- **deploy_dex_contracts.ts**: TypeScript script that deploys the DEX contracts and saves addresses in `deployedAddresses.json`.
- **deploy_arbitrage_contracts.ts**: TypeScript script that deploys the arbitrage contracts and saves addresses in `deployedAddressesArbitrage.json`.
- **simulate_dex.js**: script that simulates DEX activities and saves metrics in `dex-simulation-data.json` and swap slippage data in `dex-swap-slippages.json`.
- **simulate_arbitrage.js**: cript that runs arbitrage scenarios using deployed contracts.
- **deployedAddresses.json**: JSON file storing deployed DEX contract addresses.
- **deployedAddressesArbitrage.json**: JSON file storing deployed arbitrage contract addresses.
- **dex-simulation-data.json**: JSON file logging DEX simulation metrics.
- **dex-swap-slippages.json**: JSON file logging DEX swap slippage data.

## Deployment & Simulation Instructions

### Using Remix IDE

1. **Compile Contracts** 
   - Open Remix IDE and import the project.
   - In the **Solidity Compiler** tab, compile `DEX.sol`, `arbitrage.sol`, `Token.sol` and `LPToken.sol`.

2. **Deploy Contracts** 
   - For DEX simulation: Run `deploy-dex-contracts.ts`
   - For Arbitrage simulation: Run `deploy-arbitrage-contracts.ts`

3. **Run Simulation Scripts** 
   - For DEX simulation: Run `simulate_dex.js`.
   - For Arbitrage simulation: Run `simulate_arbitrage.js`

