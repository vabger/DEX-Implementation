/****************  CONFIGURATION  ****************/
const N = 100;

const ART_TOKEN_PATH = "browser/contracts/artifacts/Token.json";
const ART_DEX_PATH = "browser/contracts/artifacts/DEX.json";
const ART_LPT_PATH = "browser/contracts/artifacts/LPToken.json";

/****************  GLOBAL VARIABLES  ****************/
let tokenA, tokenB, dex, lpt;
const precision = 4
let swapSlippages = [];


/****************  HELPER FUNCTIONS  ****************/
const toWei = (n) => web3.utils.toWei(n.toString(), "ether");
const fromWei = (x) => parseFloat(web3.utils.fromWei(x));

async function loadArtifact(path) {
    const json = await remix.call('fileManager', 'getFile', path);
    if (!json) throw new Error(`Artifact not found`);
    return JSON.parse(json);
}

function randomFloat(min, max) {
    return Math.random() * (max - min) + min;
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


/****************  MAIN SIMULATION  ****************/

async function getStoredAddresses() {
    const filePath = "browser/deployedAddresses.json";
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
    const dexAddress = contractAddresses.dex

    const artToken = await loadArtifact(ART_TOKEN_PATH);
    const artDEX = await loadArtifact(ART_DEX_PATH);
    const artLPT = await loadArtifact(ART_LPT_PATH);

    tokenA = new web3.eth.Contract(artToken.abi, tokenAAddress);
    tokenB = new web3.eth.Contract(artToken.abi, tokenBAddress);
    dex = new web3.eth.Contract(artDEX.abi, dexAddress);

    const lptAddress = await dex.methods.LPT().call();

    lpt = new web3.eth.Contract(artLPT.abi, lptAddress);
}


async function setup() {
    const accounts = await web3.eth.getAccounts();
    if (accounts.length < 13) throw new Error("Need at least 13 accounts for simulation");

    lpUsers = accounts.slice(0, 5);
    traders = accounts.slice(5, 13);

    for (const user of accounts) {
        await tokenA.methods.mint(user, toWei(5000)).send({ from: lpUsers[0] });
        await tokenB.methods.mint(user, toWei(5000)).send({ from: lpUsers[0] });
    }

}


async function getMetrics() {
    const reserveA = fromWei(await dex.methods.reserveA().call())
    const reserveB = fromWei(await dex.methods.reserveB().call())

    let lptDist = []
    for (const user of lpUsers) {
        const balance = await lpt.methods.balanceOf(user).call()
        lptDist.push(fromWei(balance).toFixed(precision))
    }

    let reserveRatio = reserveB > 0 ? (reserveA / reserveB).toFixed(precision) : "N/A";

    const swapEvents = await dex.getPastEvents('SwapPerformed', { fromBlock: 0, toBlock: 'latest' });
    let totalSwapVolumeAtoB = 0;
    let totalSwapVolumeBtoA = 0;
    let totalSwapFeeA = 0;
    let totalSwapFeeB = 0;

    for (const event of swapEvents) {
        const amountIn = parseFloat(fromWei(event.returnValues.amountIn));
        const swapFee = parseFloat(fromWei(event.returnValues.swapFee));
        if (event.returnValues.isAtoB === true) {
            totalSwapVolumeAtoB += amountIn;
            totalSwapFeeA += swapFee;
        } else {
            totalSwapVolumeBtoA += amountIn;
            totalSwapFeeB += swapFee;
        }

    }

    let avgSlippage = swapSlippages.length > 0 ? (swapSlippages.reduce((acc, val) => acc + val, 0) / swapSlippages.length).toFixed(precision) : "N/A";

    return {
        "Token A": reserveA.toFixed(precision),
        "Token B": reserveB.toFixed(precision),
        "Total Value Locked": (2 * reserveA).toFixed(precision),
        "Reserve Ratio (TokenA/TokenB)": reserveRatio,
        "LPT Distribution": lptDist,
        "Swap Volume A->B": totalSwapVolumeAtoB.toFixed(precision),
        "Swap Volume B->A": totalSwapVolumeBtoA.toFixed(precision),
        "Total Swap Fee A": totalSwapFeeA.toFixed(precision),
        "Total Swap Fee B": totalSwapFeeB.toFixed(precision),
        "Average Slippage": avgSlippage
    }
}

function randomDeposit(balance) {
    if (balance <= 0n) return 0n;

    // Calculate required bit length and byte length
    const bits = balance.toString(2).length;
    const byteLength = Math.ceil(bits / 8);

    let result;
    do {
        const array = new Uint8Array(byteLength);
        window.crypto.getRandomValues(array);

        result = array.reduce((acc, byte) =>
            (acc << 8n) | BigInt(byte), 0n);

        const bitMask = (1n << BigInt(bits)) - 1n;
        result &= bitMask;

    } while (result === 0n || result > balance);

    return result;
}
async function deposit() {
    const user = lpUsers[randomInt(0, lpUsers.length - 1)];

    const balanceA = BigInt(await tokenA.methods.balanceOf(user).call());
    const balanceB = BigInt(await tokenB.methods.balanceOf(user).call());

    const rA = BigInt(await dex.methods.reserveA().call());
    const rB = BigInt(await dex.methods.reserveB().call());

    let depositA = randomDeposit(balanceA);

    let depositB;

    if (rA > 0n && rB > 0n) {
        depositB = (depositA * rB) / rA;

        if (depositB > balanceB) {
            return {
                "user": user.slice(0, 6),
                "depositA": 0,
                "depositB": 0,
                "success": false
            };
        }

    } else {
        depositB = randomDeposit(balanceB)
    }

    await tokenA.methods.approve(dex.options.address, depositA).send({ from: user });
    await tokenB.methods.approve(dex.options.address, depositB).send({ from: user });

    await dex.methods.addLiquidity(depositA, depositB).send({ from: user });

    return {
        "user": user.slice(0, 6),
        "depositA": fromWei(depositA.toString()).toFixed(precision),
        "depositB": fromWei(depositB.toString()).toFixed(precision),
        "success": true
    };
}


async function withdraw() {
    const user = lpUsers[randomInt(0, lpUsers.length - 1)];
    const lpBalance = BigInt(await lpt.methods.balanceOf(user).call());

    if (lpBalance === 0n) {
        return {
            "user": user.slice(0, 6),
            "lpt": "0.00",
            "success": false
        };
    }

    const withdrawAmount = randomDeposit(lpBalance);

    await dex.methods.removeLiquidity(withdrawAmount.toString()).send({ from: user });

    return {
        "user": user.slice(0, 6),
        "lpt": fromWei(withdrawAmount.toString()).toFixed(precision),
        "success": true
    };

}

async function swap() {

    const user = traders[randomInt(0, traders.length - 1)];

    // 1 means A->B; 0 means B->A.
    const direction = randomInt(0, 1);
    const directionString = direction === 1 ? "A->B" : "B->A";

    let inputToken;
    let preReserveIn, preReserveOut;
    if (direction === 1) {
        inputToken = tokenA;
        preReserveIn = BigInt(await dex.methods.reserveA().call());
        preReserveOut = BigInt(await dex.methods.reserveB().call());
    } else {
        inputToken = tokenB;
        preReserveIn = BigInt(await dex.methods.reserveB().call());
        preReserveOut = BigInt(await dex.methods.reserveA().call());
    }

    const userBalance = BigInt(await inputToken.methods.balanceOf(user).call());
    let maxSwapAmount = userBalance < (preReserveIn / 10n) ? userBalance : preReserveIn / 10n;
    if (maxSwapAmount === 0n) {
        return {
            "user": user.slice(0, 6),
            "swapped": "0.00",
            "direction": directionString,
            "success": false
        };
    }

    let swapAmount = randomDeposit(maxSwapAmount);

    await inputToken.methods.approve(dex.options.address, swapAmount.toString()).send({ from: user });

    const receipt = await dex.methods.swap(swapAmount.toString(), direction).send({ from: user });

    const event = receipt.events.SwapPerformed;
    const amountOut = BigInt(event.returnValues.amountOut);

    const expectedPrice = fromWei(preReserveOut.toString()) / fromWei(preReserveIn.toString());
    const actualPrice = fromWei(amountOut.toString()) / fromWei(swapAmount.toString());
    let slippage = ((expectedPrice - actualPrice) / expectedPrice) * 100;

    swapSlippages.push(slippage);

    return {
        "user": user.slice(0, 6),
        "swapped": fromWei(swapAmount.toString()).toFixed(precision),
        "direction": directionString,
        "slippage": slippage.toFixed(precision) + " %",
        "success": true
    };

}

async function main() {
    await fetchContractObjects()

    await setup()

    console.log("LP Users:", lpUsers);
    console.log("Trader Users:", traders);

    let simulationData = [];

    for (let i = 0; i < N; i++) {
        // 0 -> LP deposit
        // 1 -> LP withdrawal
        // 2 -> Swap
        const txType = randomInt(0, 2);

        if (txType === 0) {
            const { user, depositA, depositB, success } = await deposit();

            if (!success) {
                i--;
                continue;
            }

            console.log(`Txn ${i}: LP Deposit by ${user} - ${depositA} TKA and ${depositB} TKB`);
        } else if (txType === 1) {
            const { user, lpt, success } = await withdraw();

            if (!success) {
                i--;
                continue;
            }

            console.log(`Txn ${i}: LP Withdraw by ${user} - ${lpt} LPT`);
        } else if (txType === 2) {
            const { user, swapped, direction, success } = await swap();

            if (!success) {
                i--;
                continue;
            }

            console.log(`Txn ${i}: Trader ${user} performed swap - For ${swapped} amount (${direction})`);

        }
        await sleep(200)
        const metrics = await getMetrics()
        simulationData.push({ "Transaction Type": txType, ...metrics })

    }

    console.log("Simulation complete. Metrics over time:");
    console.log(simulationData);
    console.log(swapSlippages);

    let filePath = "browser/dex-simulation-data.json";
    await remix.call("fileManager", "writeFile", filePath, JSON.stringify(simulationData, null, 2));
    console.log("Simulation data stored in", filePath);

    filePath = "browser/dex-swap-slippages.json";
    await remix.call("fileManager", "writeFile", filePath, JSON.stringify(swapSlippages, null, 2));
    console.log("Slippage data stored in", filePath);
}


main().catch(console.error);
