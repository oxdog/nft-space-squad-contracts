import 'dotenv/config'
import { utils } from 'ethers'
import { ethers } from 'hardhat'
import { PreSale } from '../../types/typechain/PreSale'

async function main() {
  let pre: PreSale
  const provider = new ethers.providers.JsonRpcProvider(
    'http://localhost:8545',
    {
      chainId: 1,
      name: 'fork'
    }
  )
  const deployer = new ethers.Wallet(
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    provider
  )

  const PRESALE_ADDRESS = '0xb63b19Ba034738a525CAa0B7A9eE4FfD2573179a'
  const preFactory = await ethers.getContractFactory('PreSale', deployer)
  pre = preFactory.attach(PRESALE_ADDRESS) as PreSale

  const tx = await pre.mintNewNFTs(1, {
    value: utils.parseEther('0.06'),
    gasLimit: 300_000
  })
  // await tx.wait()
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
