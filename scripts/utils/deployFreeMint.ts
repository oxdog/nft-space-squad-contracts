import 'dotenv/config'
import { BigNumber } from 'ethers'
import { ethers, network } from 'hardhat'
import { NFT } from '../../types/typechain/NFT'
import { FreeMint } from '../../types/typechain/FreeMint'
import { getDeployer } from '../../utils/getDeployer'
import { NFT_ADDRESS, FREEMINT_SIZE } from '../config/config'

const { utils } = ethers

async function main() {
  let nft: NFT
  let free: FreeMint

  const deployer = getDeployer()
  const MINTER_ROLE = utils.keccak256(utils.toUtf8Bytes('MINTER_ROLE'))

  // const newGas = {
  //   gasLimit: 2_000_000,
  //   gasPrice: BigNumber.from('50000000000') // 16 Gwei
  // }

  console.log('\n############################')

  // * SETUP NFT
  const nftFactory = await ethers.getContractFactory('NFT', deployer)
  nft = nftFactory.attach(NFT_ADDRESS) as NFT

  // * Setup FreeMint
  console.log('... Deploying FreeMint')
  const freeFactory = await ethers.getContractFactory('FreeMint', deployer)
  free = (await freeFactory.deploy(NFT_ADDRESS, FREEMINT_SIZE)) as FreeMint
  await free.deployed()

  console.log('... Waiting for Deployment to finish')

  // console.log('... Setting up roles')
  // await nft.grantRole(MINTER_ROLE, free.address, newGas)

  console.log('\n############################')
  console.log('# Contract addresses')
  console.log('############################')
  console.log('# ', free.address, ' Presale')

  console.log('\n# Verify commands')
  console.log('# --------')

  console.log(
    '# FreeMint \n',
    `npx hardhat verify --network ${network.name} ${free.address} "${nft.address}" "${FREEMINT_SIZE}"`,
    '\n'
  )
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
