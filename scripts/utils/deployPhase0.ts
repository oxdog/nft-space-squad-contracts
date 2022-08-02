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

  const newGas = {
    gasLimit: 2_000_000,
    gasPrice: BigNumber.from('19000000000') // 16 Gwei
  }

  console.log('\n############################')
  console.log('# Deployment Phase 0')
  console.log('... Deploying NFT ')

  // * SETUP NFT
  const nftFactory = await ethers.getContractFactory('NFT', deployer)
  // nft = (await nftFactory.deploy(
  //   NFT_NAME,
  //   NFT_SYMBOL,
  //   NFT_UNREVEALED_URI,
  //   ROYALTY_BASISPOINTS,
  //   newGas
  // )) as NFT
  // await nft.deployed()
  nft = nftFactory.attach(NFT_ADDRESS) as NFT

  // * Setup EMC
  console.log('... Deploying EMC')
  const emcFactory = await ethers.getContractFactory('companyCard', deployer)
  // emc = (await emcFactory.deploy(
  //   EMC_NFT_NAME,
  //   EMC_NFT_SYMBOL,
  //   EMC_NFT_BASE_URI,
  //   newGas
  // )) as companyCard
  // await emc.deployed()
  emc = emcFactory.attach(company_MEMBERSHIP_CARD_ADDRESS) as companyCard

  // * Setup PreSale
  console.log('... Deploying Presale')
  const preFactory = await ethers.getContractFactory('PreSale', deployer)
  pre = (await preFactory.deploy(
    nft.address,
    emc.address,
    PRESALE_SIZE,
    PRE_RELEASE_DATE_UTC,
    NFT_PRICE_PRESALE,
    newGas
  )) as PreSale
  await pre.deployed()
  // pre = preFactory.attach(
  //   '0xb63b19Ba034738a525CAa0B7A9eE4FfD2573179a'
  // ) as PreSale

  console.log('... Waiting for Deployment to finish')
  // await Promise.all(deploymentPromises)

  // console.log('... Setting up PILL_QUALIFY_DEADLINE_UTC')
  // const pcTX = await nft.setPcDeadline(PILL_QUALIFY_DEADLINE_UTC, newGas)
  // const pcTXRecipe = await pcTX.wait()

  console.log('... Setting up roles')
  const rTX = await nft.grantRole(MINTER_ROLE, pre.address, newGas)
  const rTXRecipe = await rTX.wait()
  const eTX = await emc.grantRole(AUTH_MINTER, pre.address, newGas)
  const eTXRecipe = await eTX.wait()

  // console.log('... Configuring Provenance')
  // const pTX = await nft.setProvenanceHash(NFT_DMSS_PROVENANCE, newGas)
  // const pTXRecipe = await pTX.wait()

  console.log('\n############################')
  console.log('# Contract addresses')
  console.log('############################')
  console.log('# ', nft.address, ' NFT ')
  console.log('# ', pre.address, ' Presale')
  console.log('# ', emc.address, ' company Membership Card')

  // const recipes = await Promise.all([
  // await ethers.provider.getTransactionReceipt(nft.deployTransaction.hash)
  // await ethers.provider.getTransactionReceipt(emc.deployTransaction.hash)
  // await ethers.provider.getTransactionReceipt(pre.deployTransaction.hash)
  // ])
  // const recipes = []

  // const totalGasUsed = recipes
  //   .map((recipe) => recipe.gasUsed)
  //   .reduce((a, b) => a.add(b))
  //   .add(pTXRecipe.gasUsed)
  //   .add(rTXRecipe.gasUsed)
  //   .add(eTXRecipe.gasUsed)

  // console.log('\n# Gas Used')
  // console.log('# --------')
  // console.log('# ', recipes[0].gasUsed.toString(), 'NFT ')
  // console.log('# ', recipes[1].gasUsed.toString(), 'company Membership Card')
  // console.log('# ', recipes[2].gasUsed.toString(), 'Presale')
  // console.log(
  //   '# ',
  //   pcTXRecipe.gasUsed.toString(),
  //   'pill_qualify_deadline Setup'
  // )
  // console.log('# ', rTXRecipe.gasUsed.toString(), 'Minter Role Setup')
  // console.log('# ', eTXRecipe.gasUsed.toString(), 'Auth ECM Role Setup')
  // console.log('# ', pTXRecipe.gasUsed.toString(), 'Provenance Setup')
  console.log('# --------')
  // console.log('# ', totalGasUsed.toString(), ' Total Gas Used')

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
