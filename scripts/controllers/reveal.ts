import 'dotenv/config'
import { ethers } from 'hardhat'
import { NFT } from '../../types/typechain/NFT'
import { deployer, NFT_ADDRESS, NFT_BASE_URI } from '../config/config'

async function main() {
  let NFT: NFT

  console.log('############################')
  console.log('# Reveal initiated')
  console.log('# ------------------')

  console.log(`# ... attaching NFT instance to ${NFT_ADDRESS}`)

  const NFTFactory = await ethers.getContractFactory('NFT', deployer)

  NFT = NFTFactory.attach(NFT_ADDRESS) as NFT

  console.log(`# ... revealing NFT`)

  const tx = await NFT.updateURI(NFT_BASE_URI, '', true, {
    gasLimit: 10000000
  })

  console.log(`# ... waiting for TX to complete ${tx.hash}`)
  const recipe = await tx.wait()

  console.log('# ------------------')
  console.log(recipe.status == 1 ? '# Successfull Reveal!' : '# FAILURE!')
  console.log('############################')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
