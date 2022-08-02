import { ethers } from 'hardhat'
import { Distributor } from '../../types/typechain/Distributor'

import 'dotenv/config'
import {
  DISTRIBUTOR_ADDRESS,
  CONTINGENT,
  CONTINGENT_RECEIVER,
  deployer,
  PRESALE_ADDRESS
} from '../config/config'
import { PreSale } from '../../types/typechain/PreSale'

async function main() {
  let pre: PreSale
  const preFactory = await ethers.getContractFactory('PreSale', deployer)
  pre = preFactory.attach(PRESALE_ADDRESS) as PreSale
  console.log('# # # Issue Contingent ')
  console.log(`# ... issuing ${CONTINGENT} NFT to ${CONTINGENT_RECEIVER}`)
  const tx = await pre.issueContingent(CONTINGENT_RECEIVER, CONTINGENT, {
    gasLimit: 10_000_000
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
