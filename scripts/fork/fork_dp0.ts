import 'dotenv/config'
import { ethers } from 'hardhat'
import { NFT } from '../../types/typechain/NFT'
import { companyCard } from '../../types/typechain/companyCard'
import { PreSale } from '../../types/typechain/PreSale'
import {
  NFT_PRICE_PRESALE,
  PRESALE_ADDRESS,
  PRESALE_SIZE,
  PRE_RELEASE_DATE_UTC
} from '../config/config'

const { utils } = ethers

const FORK_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'

async function main() {
  let nft: NFT
  let pre: PreSale
  let emc: companyCard

  const MINTER_ROLE = utils.keccak256(utils.toUtf8Bytes('MINTER_ROLE'))
  const AUTH_MINTER = utils.keccak256(utils.toUtf8Bytes('AUTH_MINTER'))

  const provider = new ethers.providers.JsonRpcProvider(
    'http://localhost:8545',
    {
      chainId: 31337,
      name: 'fork'
    }
  )
  const funds = new ethers.Wallet(FORK_KEY, provider)
  const deployer = new ethers.Wallet(process.env.DEV_WALLET as string, provider)
  if ((await deployer.getBalance()).lt(utils.parseEther('100'))) {
    console.log('Loading funds')
    await funds.sendTransaction({
      to: deployer.address,
      value: utils.parseEther('100')
    })
  }

  console.log('# Deployment Phase 0')

  // * SETUP NFT
  const nftFactory = await ethers.getContractFactory('NFT', deployer)
  const emcFactory = await ethers.getContractFactory('companyCard', deployer)
  nft = nftFactory.attach('0x327923c061E94476560B831d8E5bC63CFb2534F6') as NFT
  emc = emcFactory.attach(
    '0x1bB2Eecc657013C2bBAEF66cf3F84de823DF0b12'
  ) as companyCard

  // * Setup PreSale
  console.log('... Deploying Presale')
  const preFactory = await ethers.getContractFactory('PreSale', deployer)
  // pre = (await preFactory.deploy(
  //   nft.address,
  //   emc.address,
  //   PRESALE_SIZE,
  //   PRE_RELEASE_DATE_UTC,
  //   NFT_PRICE_PRESALE
  // )) as PreSale
  // await pre.deployed()
  pre = preFactory.attach(PRESALE_ADDRESS) as PreSale

  console.log('... Setting up roles')
  const rTX = await nft.grantRole(MINTER_ROLE, pre.address)
  await rTX.wait()
  const eTX = await emc.grantRole(AUTH_MINTER, pre.address)
  await eTX.wait()

  console.log('# ', pre.address, ' Presale')

  // console.log('pre call ', await funds.getBalance())
  await pre.mintNewNFTs(1, { value: utils.parseEther('0.06') })
  // const amount = await provider.getBalance(pre.address)
  // await pre.call(funds.address, amount, '0x')
  // console.log('post call', await funds.getBalance())
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
