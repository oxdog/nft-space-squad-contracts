import 'dotenv/config'
import { ethers, network } from 'hardhat'
import { NFT } from '../../types/typechain/NFT'
import { Distributor } from '../../types/typechain/Distributor'
import { getDeployer } from '../../utils/getDeployer'
import {
  COLLECTION_SIZE,
  NFT_ADDRESS,
  INITIAL_FREE_MINT_CONTINGENT,
  NFT_PRICE,
  RELEASE_DATE_UTC,
  WL_RELEASE_DATE_UTC
} from '../config/config'

const { utils } = ethers

async function main() {
  let nft: NFT
  let dist: Distributor
  let deployer = getDeployer()

  const MINTER_ROLE = utils.keccak256(utils.toUtf8Bytes('MINTER_ROLE'))

  console.log('\n############################')
  console.log('# Deployment Phase 1')

  //* SETUP NFT
  console.log('... Attaching NFT ')
  const nftFactory = await ethers.getContractFactory('NFT', deployer)
  nft = nftFactory.attach(NFT_ADDRESS) as NFT

  //* SETUP DISTRIBUTOR
  console.log('... Deploying Distributor')
  const distFactory = await ethers.getContractFactory('Distributor', deployer)
  dist = (await distFactory.deploy(
    nft.address,
    COLLECTION_SIZE,
    RELEASE_DATE_UTC,
    WL_RELEASE_DATE_UTC,
    NFT_PRICE
  )) as Distributor

  console.log('... Waiting for Deployment to finish')
  await dist.deployed()

  console.log('... Setting up roles')
  const rTX = await nft.grantRole(MINTER_ROLE, dist.address)
  const rTXRecipe = await rTX.wait()

  console.log('... Setting up INITIAL_FREE_MINT_CONTINGENT')
  const fTX = await dist.updateFreeMintContingent(INITIAL_FREE_MINT_CONTINGENT)
  const fTXRecipe = await fTX.wait()

  console.log('\n############################')
  console.log('# Contract addresses')
  console.log('############################')
  console.log('# ', dist.address, ' NFT Distributor')

  const recipes = await Promise.all([
    await ethers.provider.getTransactionReceipt(dist.deployTransaction.hash)
  ])

  const totalGasUsed = recipes
    .map((recipe) => recipe.gasUsed)
    .reduce((a, b) => a.add(b))
    .add(rTXRecipe.gasUsed)
    .add(fTXRecipe.gasUsed)

  console.log('\n# Gas Used')
  console.log('# --------')
  console.log('# ', recipes[0].gasUsed.toString(), 'Distributor')
  console.log('# ', rTXRecipe.gasUsed.toString(), 'Minter Role Setup')
  console.log('# ', fTXRecipe.gasUsed.toString(), 'Free Mint Contingent Setup')
  console.log('# --------')
  console.log('# ', totalGasUsed.toString(), ' Total Gas Used')
  console.log('\n# Verify commands')
  console.log('# --------')
  console.log(
    '# Distributor \n',
    `npx hardhat verify --network ${network.name} ${dist.address} "${nft.address}" "${COLLECTION_SIZE}" "${RELEASE_DATE_UTC}" "${WL_RELEASE_DATE_UTC}" "${NFT_PRICE}"`,
    '\n'
  )
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
