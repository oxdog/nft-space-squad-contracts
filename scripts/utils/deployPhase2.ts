import 'dotenv/config'
import { ethers, network } from 'hardhat'
import { NFTEnlargeningPill } from '../../types/typechain/NFTEnlargeningPill'
import { NFT } from '../../types/typechain/NFT'
import { Pharmacy } from '../../types/typechain/Pharmacy'
import { getDeployer } from '../../utils/getDeployer'
import {
  NFT_ADDRESS,
  PILL_CLAIM_DEALDINE_UTC,
  PILL_METADATA,
  PILL_NAME,
  PILL_PRICE,
  PILL_SUPPLY,
  PILL_SYMBOL,
  ROYALTY_BASISPOINTS
} from '../config/config'
const { utils } = ethers

async function main() {
  let nft: NFT
  let pill: NFTEnlargeningPill
  let pharmacy: Pharmacy
  let deployer = getDeployer()

  const ENLARGEMENT_ROLE = utils.keccak256(
    utils.toUtf8Bytes('ENLARGEMENT_ROLE')
  )
  const PHARMACY_ROLE = utils.keccak256(utils.toUtf8Bytes('PHARMACY_ROLE'))

  console.log('\n############################')
  console.log('# Deployment Phase 2')

  //* SETUP NFT
  console.log('... Attaching NFT ')
  const nftFactory = await ethers.getContractFactory('NFT', deployer)
  nft = nftFactory.attach(NFT_ADDRESS) as NFT

  //* SETUP ENLARGEMENT PILL
  console.log('... Deploying DEP')
  const pillFactory = await ethers.getContractFactory(
    'NFTEnlargeningPill',
    deployer
  )
  pill = (await pillFactory.deploy(
    PILL_NAME,
    PILL_SYMBOL,
    PILL_METADATA,
    nft.address,
    ROYALTY_BASISPOINTS
  )) as NFTEnlargeningPill
  console.log('... Waiting for Pill deployment to finish')
  await pill.deployed()

  //* SETUP PHARMACY
  console.log('... Deploying Pharmacy')
  const pharmacyFactory = await ethers.getContractFactory('Pharmacy', deployer)
  pharmacy = (await pharmacyFactory.deploy(
    nft.address,
    pill.address,
    PILL_PRICE,
    PILL_SUPPLY
  )) as Pharmacy
  console.log('... Waiting for Pharmacy deployment to finish')
  await pharmacy.deployed()

  console.log('... Setting up roles')
  const rTX1 = await nft.grantRole(ENLARGEMENT_ROLE, pill.address)
  const rTX1Recipe = await rTX1.wait()
  const rTX2 = await pill.grantRole(PHARMACY_ROLE, pharmacy.address)
  const rTX2Recipe = await rTX2.wait()
  console.log('... Pausing pharmacy')
  const pharTX = await pharmacy.togglePause()
  const pharTXRecipe = await pharTX.wait()
  console.log('... Setting claim deadline')
  const cdTX = await pharmacy.setClaimDeadline(PILL_CLAIM_DEALDINE_UTC)
  const cdTXRecipe = await cdTX.wait()

  console.log('\n############################')
  console.log('# Contract addresses')
  console.log('############################')
  console.log('# ', pill.address, ' DEP')
  console.log('# ', pharmacy.address, ' Pharmacy')

  const recipes = await Promise.all([
    await ethers.provider.getTransactionReceipt(pill.deployTransaction.hash),
    await ethers.provider.getTransactionReceipt(pharmacy.deployTransaction.hash)
  ])

  const totalGasUsed = recipes
    .map((recipe) => recipe.gasUsed)
    .reduce((a, b) => a.add(b))
    .add(rTX1Recipe.gasUsed)
    .add(rTX2Recipe.gasUsed)
    .add(pharTXRecipe.gasUsed)

  console.log('\n# Gas Used')
  console.log('# --------')
  console.log('# ', recipes[0].gasUsed.toString(), 'NFT Enlargening Pill')
  console.log('# ', recipes[1].gasUsed.toString(), 'Pharmacy')
  console.log('# ', cdTXRecipe.gasUsed.toString(), 'Claim Deadline Setup')
  console.log('# ', rTX1Recipe.gasUsed.toString(), 'Enlargement Role Setup')
  console.log('# ', rTX2Recipe.gasUsed.toString(), 'Pharmacy Role Setup')
  console.log('# ', pharTXRecipe.gasUsed.toString(), 'Pausing Pharmacy')
  console.log('# --------')
  console.log('# ', totalGasUsed.toString(), ' Total Gas Used')

  console.log('\n# Verify commands')
  console.log('# --------')
  console.log(
    '# NFT Enlargening Pill \n',
    `npx hardhat verify --network ${network.name} ${pill.address} "${PILL_NAME}" "${PILL_SYMBOL}" "${PILL_METADATA}" "${nft.address}" "${ROYALTY_BASISPOINTS}"`,
    '\n'
  )
  console.log(
    '# Pharmacy \n',
    `npx hardhat verify --network ${network.name} ${pharmacy.address} "${nft.address}" "${pill.address}" "${PILL_PRICE}" "${PILL_SUPPLY}"`,
    '\n'
  )
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
