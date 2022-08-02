import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { ethers } from 'hardhat'
import chai from '../scripts/config/chaisetup'
import { NFT_ADDRESS } from '../scripts/config/config'
import { FreeMint } from '../types/typechain/FreeMint'

const { expect } = chai
const { utils } = ethers

describe('FreeMint', async () => {
  let deployer: SignerWithAddress
  let free: FreeMint

  beforeEach(async () => {
    ;[deployer] = await ethers.getSigners()

    //* SETUP Presale
    const freeFactory = await ethers.getContractFactory('FreeMint', deployer)
    free = (await freeFactory.deploy(NFT_ADDRESS, 9000)) as FreeMint
    await free.deployed()
  })

  describe('Release Tests', () => {
    it('runs', async () => {
      expect(true).to.be.equal(true)
    })
  })
})
