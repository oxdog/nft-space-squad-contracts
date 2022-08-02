import 'dotenv/config'
import { BigNumber } from 'ethers'
import { ethers, network } from 'hardhat'
import { NFT } from '../../types/typechain/NFT'
import { companyCard } from '../../types/typechain/companyCard'
import { PreSale } from '../../types/typechain/PreSale'
import { getDeployer } from '../../utils/getDeployer'
import {
  NFT_ADDRESS,
  company_MEMBERSHIP_CARD_ADDRESS,
  EMC_NFT_BASE_URI,
  EMC_NFT_NAME,
  EMC_NFT_SYMBOL,
  NFT_DMSS_PROVENANCE,
  NFT_NAME,
  NFT_PRICE,
  NFT_PRICE_PRESALE,
  NFT_SYMBOL,
  NFT_UNREVEALED_URI,
  PILL_QUALIFY_DEADLINE_UTC,
  PRESALE_SIZE,
  PRE_RELEASE_DATE_UTC,
  ROYALTY_BASISPOINTS
} from '../config/config'

const { utils } = ethers

async function main() {
  let nft: NFT
  let pre: PreSale
  let emc: companyCard

  const deployer = getDeployer()
  const MINTER_ROLE = utils.keccak256(utils.toUtf8Bytes('MINTER_ROLE'))
  const AUTH_MINTER = utils.keccak256(utils.toUtf8Bytes('AUTH_MINTER'))

  console.log('\n############################')
  console.log('# Deployment Phase 0')
  console.log('... Deploying NFT ')

  // * SETUP NFT
  const nftFactory = await ethers.getContractFactory('NFT', deployer)
  nft = (await nftFactory.deploy(
    NFT_NAME,
    NFT_SYMBOL,
    NFT_UNREVEALED_URI,
    ROYALTY_BASISPOINTS
  )) as NFT
  await nft.deployed()

  // * Setup EMC
  console.log('... Deploying EMC')
  const emcFactory = await ethers.getContractFactory('companyCard', deployer)
  emc = (await emcFactory.deploy(
    EMC_NFT_NAME,
    EMC_NFT_SYMBOL,
    EMC_NFT_BASE_URI,
    deployer.address
  )) as companyCard
  await emc.deployed()

  // * Setup PreSale
  console.log('... Deploying Presale')
  const preFactory = await ethers.getContractFactory('PreSale', deployer)
  pre = (await preFactory.deploy(
    nft.address,
    emc.address,
    PRESALE_SIZE,
    PRE_RELEASE_DATE_UTC,
    NFT_PRICE_PRESALE
  )) as PreSale
  await pre.deployed()

  console.log('... Setting up PILL_QUALIFY_DEADLINE_UTC')
  const pcTX = await nft.setPcDeadline(PILL_QUALIFY_DEADLINE_UTC)
  const pcTXRecipe = await pcTX.wait()

  console.log('... Setting up roles')
  const rTX = await nft.grantRole(MINTER_ROLE, pre.address)
  await rTX.wait()
  const eTX = await emc.grantRole(AUTH_MINTER, pre.address)
  await eTX.wait()

  console.log('\n############################')
  console.log('# Contract addresses')
  console.log('############################')
  console.log('# ', nft.address, ' NFT ')
  console.log('# ', pre.address, ' Presale')
  console.log('# ', emc.address, ' company Membership Card')

  console.log('\n# Verify commands')
  console.log('# --------')
  console.log(
    '# NFT  \n',
    `npx hardhat verify --network ${network.name} ${nft.address} "${NFT_NAME}" "${NFT_SYMBOL}" "${NFT_UNREVEALED_URI}" "${ROYALTY_BASISPOINTS}"`,
    '\n'
  )
  console.log(
    '# Presale \n',
    `npx hardhat verify --network ${network.name} ${pre.address} "${nft.address}" "${emc.address}" "${PRESALE_SIZE}" "${PRE_RELEASE_DATE_UTC}" "${NFT_PRICE_PRESALE}"`,
    '\n'
  )
  console.log(
    '# company Membership Card \n',
    `npx hardhat verify --network ${network.name} ${emc.address} "${EMC_NFT_NAME}" "${EMC_NFT_SYMBOL}" "${EMC_NFT_BASE_URI}"`,
    '\n'
  )
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
