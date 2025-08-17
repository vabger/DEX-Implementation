import { deploy } from './web3-lib'

;(async () => {
    try {
        console.log('Deploying TokenA...')
        const tokenA = await deploy(
            'Token',
            ['TokenA', 'TKA'],
            undefined,
            5000000,
        )
        console.log(`TokenA deployed at: ${tokenA.address}`)

        console.log('Deploying TokenB...')
        const tokenB = await deploy(
            'Token',
            ['TokenB', 'TKB'],
            undefined,
            5000000,
        )
        console.log(`TokenB deployed at: ${tokenB.address}`)

        console.log('Deploying DEX 1...')
        const dex1 = await deploy(
            'DEX',
            [tokenA.address, tokenB.address],
            undefined,
            5000000,
        )
        console.log(`DEX 1 deployed at: ${dex1.address}`)

        console.log('Deploying DEX 2...')
        const dex2 = await deploy(
            'DEX',
            [tokenA.address, tokenB.address],
            undefined,
            5000000,
        )
        console.log(`DEX deployed at: ${dex2.address}`)

        console.log('Deploying Arbitrage Contract..')
        const arbitrage = await deploy(
            'Arbitrage',
            [dex1.address, dex2.address],
            undefined,
            5000000,
        )
        console.log(`Arbitrage Contract deployed at: ${arbitrage.address}`)

        console.log('Deployment complete.')
        const deployedAddresses = {
            tokenA: tokenA.address,
            tokenB: tokenB.address,
            dex1: dex1.address,
            dex2: dex2.address,
            arbitrage: arbitrage.address,
        }

        const filePath = 'browser/deployedAddressesArbitrage.json'
        await remix.call(
            'fileManager',
            'writeFile',
            filePath,
            JSON.stringify(deployedAddresses, null, 2),
        )
        console.log('Contract addresses stored in', filePath)
    } catch (e: any) {
        console.error('Deployment error:', e.message)
    }
})()
