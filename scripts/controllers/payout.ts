import { ethers } from 'hardhat'
import { LiquidityCollector } from '../../types/typechain/LiquidityCollector'
import { deployer } from '../config/config'

async function main() {
  let liquidity: LiquidityCollector

  const LIQUIDITY_ADDRESS = '0x6c217734468BD960404331c1116A14077052cC66'

  const liqFac = await ethers.getContractFactory('LiquidityCollector', deployer)

  liquidity = liqFac.attach(LIQUIDITY_ADDRESS) as LiquidityCollector

  console.log('# # # Payout ')
  console.log(`# ... paying out`)
  const tx = await liquidity.distribute({
    gasLimit: 800000
  })
  await tx.wait()
  console.log(`# ... waiting for TX to complete ${tx.hash}`)
  console.log(`# Done!`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
