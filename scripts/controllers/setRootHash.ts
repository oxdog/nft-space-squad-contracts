import 'dotenv/config'
import { ethers } from 'hardhat'
import keccak256 from 'keccak256'
import MerkleTree from 'merkletreejs'
import { Distributor } from '../../types/typechain/Distributor'
import { Whitelist } from '../../types/Whitelist'
import { loadDataFromFile } from '../../utils/files/loadDataFromFile'
import { hashToken } from '../../utils/hashToken'
import { deployer, DISTRIBUTOR_ADDRESS } from '../config/config'

async function main() {
  let dist: Distributor

  const whitelist = loadDataFromFile('whitelist.json') as Whitelist
  const merkleTree = new MerkleTree(
    Object.entries(whitelist).map((entry) =>
      hashToken(entry[0], entry[1].whitelist, entry[1].freeMint)
    ),
    keccak256,
    { sortPairs: true }
  )

  const distFactory = await ethers.getContractFactory('Distributor', deployer)

  dist = distFactory.attach(DISTRIBUTOR_ADDRESS) as Distributor

  console.log('# # # Whitelisting ')
  console.log(`# ... setting root hash`)

  const tx = await dist.setRootHash(merkleTree.getHexRoot())
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
