import { ethers } from 'hardhat'
import chai from '../scripts/config/chaisetup'
import { NFTEnlargeningPill } from '../types/typechain/NFTEnlargeningPill'
import { Pharmacy } from '../types/typechain/Pharmacy'
import { NFT } from '../types/typechain/NFT'

const { expect } = chai
const { utils, BigNumber } = ethers

describe('Pharmacy', () => {
  const BUYER_INITIAL_BALANCE = ethers.utils.parseEther('10')

  const PHARMACY_ROLE = utils.keccak256(utils.toUtf8Bytes('PHARMACY_ROLE'))
  const PAUSER_ROLE = utils.keccak256(utils.toUtf8Bytes('PAUSER_ROLE'))
  const DEFAULT_ADMIN_ROLE = ethers.constants.HashZero

  const BASE_URI = 'ipfs://abcdefg/meta/'
  const UNREVEALED_URI = 'ipfs://unrevealed'
  const NFT_NAME = 'NFT'
  const NFT_SYMBOL = 'DMC'
  const DEFAULT_ROYALTY = 300 // 3%

  const PILL_NAME = 'Enlargement Pill'
  const PILL_SYMBOL = 'ELP'
  const PILL_METADATA = 'ipfs://abcdefg/metadata.json'
  const PILL_INITIAL_PRICE = ethers.utils.parseEther('0.1')
  const PILL_SUPPLY = 25
  const MAX_PILLS_PER_TX = 20

  let deployer: any
  let buyer: any
  let noAccess: any
  let royRec: any

  let nft: NFT
  let pill: NFTEnlargeningPill
  let pharmacy: Pharmacy

  beforeEach(async () => {
    ;[deployer, buyer, noAccess, royRec] = await ethers.getSigners()

    //* Setup NFT
    const nftFactory = await ethers.getContractFactory('NFT', deployer)

    nft = (await nftFactory.deploy(
      NFT_NAME,
      NFT_SYMBOL,
      UNREVEALED_URI,
      royRec.address,
      DEFAULT_ROYALTY
    )) as NFT

    expect(await nft.name()).to.equal(NFT_NAME)
    expect(await nft.symbol()).to.equal(NFT_SYMBOL)
    await nft.updateURI(BASE_URI, '', true)
    await nft.setPcDeadline(BigNumber.from('9999999999999999999'))

    //* Setup Enlargement Pill
    const pillFactory = await ethers.getContractFactory(
      'NFTEnlargeningPill',
      deployer
    )

    pill = (await pillFactory.deploy(
      PILL_NAME,
      PILL_SYMBOL,
      PILL_METADATA,
      nft.address,
      royRec.address,
      DEFAULT_ROYALTY
    )) as NFTEnlargeningPill

    //* Setup Pharmacy
    const pharmacyFactory = await ethers.getContractFactory(
      'Pharmacy',
      deployer
    )

    pharmacy = (await pharmacyFactory.deploy(
      nft.address,
      pill.address,
      PILL_INITIAL_PRICE,
      PILL_SUPPLY
    )) as Pharmacy

    await pill.grantRole(PHARMACY_ROLE, pharmacy.address)
    expect(await pill.hasRole(PHARMACY_ROLE, pharmacy.address)).to.be.true

    //* SETUP CUSTOMER
    await ethers.provider.send('hardhat_setBalance', [
      buyer.address,
      BUYER_INITIAL_BALANCE.toHexString()
    ])

    expect(await ethers.provider.getBalance(buyer.address)).to.be.equal(
      BUYER_INITIAL_BALANCE
    )
  })

  describe('Payment Tests', () => {
    it('issues pill with PHARMACY_ROLE', async () => {
      const balanceBefore = await pill.balanceOf(buyer.address)

      await pharmacy.connect(buyer).purchasePills(1, {
        value: PILL_INITIAL_PRICE
      })

      const balanceAfter = await pill.balanceOf(buyer.address)

      expect(balanceAfter).to.be.equal(balanceBefore.add(1))
      expect(await ethers.provider.getBalance(buyer.address)).to.be.gte(
        BUYER_INITIAL_BALANCE.sub(PILL_INITIAL_PRICE).sub(
          utils.parseEther('0.001') // gasfees
        )
      )
    })

    it('issues multiple pills', async () => {
      const quantity = 5
      const balanceBefore = await pill.balanceOf(buyer.address)

      await pharmacy.connect(buyer).purchasePills(quantity, {
        value: PILL_INITIAL_PRICE.mul(quantity)
      })

      const balanceAfter = await pill.balanceOf(buyer.address)

      expect(balanceAfter).to.be.equal(balanceBefore.add(quantity))
      expect(await ethers.provider.getBalance(buyer.address)).to.be.gte(
        BUYER_INITIAL_BALANCE.sub(PILL_INITIAL_PRICE.mul(quantity)).sub(
          utils.parseEther('0.001') // gasfees
        )
      )
    })

    it('reverts trying to issue more than max per transaction', async () => {
      const quantity = MAX_PILLS_PER_TX + 1

      await expect(
        pharmacy.connect(buyer).purchasePills(quantity, {
          value: PILL_INITIAL_PRICE.mul(quantity)
        })
      ).to.be.reverted
    })

    it('mints exactly to supply cap', async () => {
      const cap = await pharmacy.supplyCap()
      const mint1 = MAX_PILLS_PER_TX
      const mint2 = cap.sub(MAX_PILLS_PER_TX)

      await pharmacy.connect(buyer).purchasePills(mint1, {
        value: PILL_INITIAL_PRICE.mul(mint1)
      })

      await pharmacy.connect(buyer).purchasePills(mint2, {
        value: PILL_INITIAL_PRICE.mul(mint2)
      })

      expect(await pill.balanceOf(buyer.address)).to.be.equal(cap)
    })

    it('reverts when supply cap is reached', async () => {
      const cap = await pharmacy.supplyCap()
      expect(MAX_PILLS_PER_TX * 2).to.be.greaterThan(cap.toNumber())

      await pharmacy.connect(buyer).purchasePills(MAX_PILLS_PER_TX, {
        value: PILL_INITIAL_PRICE.mul(MAX_PILLS_PER_TX)
      })

      await expect(
        pharmacy.connect(buyer).purchasePills(MAX_PILLS_PER_TX, {
          value: PILL_INITIAL_PRICE.mul(MAX_PILLS_PER_TX)
        })
      ).to.be.reverted
    })

    it('reverts when supply cap - claimReserve is reached', async () => {
      await pharmacy.setClaimDeadline(99999999999)
      for (let i = 0; i < 6; i++) {
        await nft.mint(buyer.address)
      }

      expect(await nft.pcCount()).to.be.equal(3)
      await pharmacy.togglePause()
      await pharmacy.togglePause()

      const cap = await pharmacy.supplyCap()
      const claimReserve = await pharmacy.claimReserve()
      const capReserve = cap.sub(claimReserve)
      expect(claimReserve).to.be.equal(3)

      const mint1 = MAX_PILLS_PER_TX
      const mint2 = cap.sub(MAX_PILLS_PER_TX).toNumber() - 1

      expect(mint1).to.be.lt(capReserve.toNumber())
      expect(mint1 + mint2).to.be.gt(capReserve.toNumber())
      expect(mint1 + mint2).to.be.lt(cap.toNumber())

      await pharmacy.connect(buyer).purchasePills(mint1, {
        value: PILL_INITIAL_PRICE.mul(mint1)
      })

      await expect(
        pharmacy.connect(buyer).purchasePills(mint2, {
          value: PILL_INITIAL_PRICE.mul(mint2)
        })
      ).to.be.reverted

      await pharmacy.setClaimDeadline(0)
      await pharmacy.connect(buyer).purchasePills(mint2, {
        value: PILL_INITIAL_PRICE.mul(mint2)
      })

      expect(await pill.balanceOf(buyer.address)).to.be.equal(mint1 + mint2)
    })

    it('refunds correct amount on single pill', async () => {
      await pharmacy.connect(buyer).purchasePills(1, {
        value: PILL_INITIAL_PRICE.mul(3)
      })

      expect(await ethers.provider.getBalance(buyer.address))
        .to.be.gte(
          BUYER_INITIAL_BALANCE.sub(PILL_INITIAL_PRICE).sub(
            utils.parseEther('0.01') // gasfees
          )
        )
        .lte(BUYER_INITIAL_BALANCE.sub(PILL_INITIAL_PRICE))
    })

    it('refunds correct amount on multiple pills', async () => {
      const quantity = 3

      await pharmacy.connect(buyer).purchasePills(quantity, {
        value: PILL_INITIAL_PRICE.mul(quantity).mul(2)
      })

      expect(await ethers.provider.getBalance(buyer.address))
        .to.be.gte(
          BUYER_INITIAL_BALANCE.sub(PILL_INITIAL_PRICE.mul(quantity)).sub(
            utils.parseEther('0.01') // gasfees
          )
        )
        .lte(BUYER_INITIAL_BALANCE.sub(PILL_INITIAL_PRICE.mul(quantity)))
    })

    it('reverts if amount is too low on single', async () => {
      await expect(
        pharmacy.connect(buyer).purchasePills(1, {
          value: PILL_INITIAL_PRICE.div(2)
        })
      ).to.be.reverted
    })

    it('reverts if amount is too low on multiple', async () => {
      await expect(
        pharmacy.connect(buyer).purchasePills(4, {
          value: PILL_INITIAL_PRICE.mul(3)
        })
      ).to.be.reverted
    })
  })

  describe('Pill Claim Tests', () => {
    beforeEach(async () => {
      await nft.mint(buyer.address)
      await nft.mint(buyer.address)
      expect(await nft.balanceOf(buyer.address)).to.be.equal(2)
    })

    it('issues correct claim contingent on single qualified', async () => {
      const CLAIM_CONTINGENT = await nft.pcEligible(buyer.address)
      expect(CLAIM_CONTINGENT).to.be.equal(1)
      expect(await pill.balanceOf(buyer.address)).to.be.equal(0)

      await pharmacy.connect(buyer).claimFreePills()

      expect(await pill.balanceOf(buyer.address)).to.be.equal(CLAIM_CONTINGENT)
    })

    it('issues correct claim contingent on multiple qualified', async () => {
      await nft.mint(buyer.address)
      await nft.mint(buyer.address)
      await nft.mint(buyer.address)
      await nft.mint(buyer.address)
      expect(await nft.balanceOf(buyer.address)).to.be.equal(6)

      const CLAIM_CONTINGENT = await nft.pcEligible(buyer.address)
      expect(CLAIM_CONTINGENT).to.be.equal(3)
      expect(await pill.balanceOf(buyer.address)).to.be.equal(0)

      await pharmacy.connect(buyer).claimFreePills()

      expect(await pill.balanceOf(buyer.address)).to.be.equal(CLAIM_CONTINGENT)
    })

    it('registers claim', async () => {
      expect(await pharmacy.claimRegistry(buyer.address)).to.be.false
      await pharmacy.connect(buyer).claimFreePills()
      expect(await pharmacy.claimRegistry(buyer.address)).to.be.true
    })

    it('reverts on claiming twice', async () => {
      expect(await pill.balanceOf(buyer.address)).to.be.equal(0)

      await pharmacy.connect(buyer).claimFreePills()
      expect(await pill.balanceOf(buyer.address)).to.be.equal(1)

      await expect(pharmacy.connect(buyer).claimFreePills()).to.be.reverted
    })

    it('reverts if not allowed to claim', async () => {
      await expect(pharmacy.connect(noAccess).claimFreePills()).to.be.reverted
    })

    it('reverts claim if supply cap is reached', async () => {
      expect(await pharmacy.claimDeadline()).to.be.equal(0)
      await nft.mint(buyer.address)
      await nft.mint(buyer.address)

      expect(await nft.balanceOf(buyer.address)).to.be.equal(4)
      expect(await nft.pcCount()).to.be.equal(2)
      await pharmacy.togglePause()
      await pharmacy.togglePause()

      const cap = await pharmacy.supplyCap()
      const mint1 = MAX_PILLS_PER_TX
      const mint2 = cap.sub(MAX_PILLS_PER_TX)

      await pharmacy.connect(buyer).purchasePills(mint1, {
        value: PILL_INITIAL_PRICE.mul(mint1)
      })

      await pharmacy.connect(buyer).purchasePills(mint2, {
        value: PILL_INITIAL_PRICE.mul(mint2)
      })

      expect(await pill.balanceOf(buyer.address)).to.be.equal(cap)
      expect(await nft.pcEligible(buyer.address)).to.be.equal(2)
      expect(pharmacy.connect(buyer.address).claimFreePills()).to.be.reverted
    })
  })

  describe('Adjustment Tests', () => {
    it('returns correct price', async () => {
      expect(await pharmacy.price()).to.be.equal(PILL_INITIAL_PRICE)
    })

    it('gets current drug', async () => {
      expect(await pharmacy.getCurrentDrug()).to.be.equal(pill.address)
    })

    it('updates claim contingent on unpause', async () => {
      await nft.mint(buyer.address)
      await nft.mint(buyer.address)
      await nft.mint(buyer.address)
      await nft.mint(buyer.address)

      expect(await nft.pcCount()).to.be.equal(2)
      expect(await pharmacy.claimReserve()).to.be.equal(0)

      await pharmacy.togglePause()
      await pharmacy.togglePause()

      expect(await pharmacy.claimReserve()).to.be.equal(2)
    })

    it('sets claim deadline', async () => {
      const deadlineBef = await pharmacy.claimDeadline()
      expect(deadlineBef).to.not.be.equal(777)
      await pharmacy.setClaimDeadline(777)
      expect(await pharmacy.claimDeadline()).to.be.equal(777)
    })

    it('reverts set claim deadline without DEFAULT_ADMIN_ROLE', async () => {
      await expect(pharmacy.connect(noAccess).setClaimDeadline(777)).to.be
        .reverted
    })
  })

  describe('Pause Tests', () => {
    it('pauses with PAUSER_ROLE', async () => {
      await pharmacy.connect(deployer).togglePause()
      expect(await pharmacy.paused()).to.equal(true)
    })

    it('reverts on pause without PAUSER_ROLE', async () => {
      await expect(pharmacy.connect(noAccess).togglePause()).to.be.reverted
    })

    it('reverts on unpause without PAUSER_ROLE', async () => {
      await pharmacy.connect(deployer).togglePause()
      expect(await pharmacy.paused()).to.equal(true)
      await expect(pharmacy.connect(noAccess).togglePause()).to.be.reverted
    })

    describe('when paused', () => {
      beforeEach(async () => {
        await pharmacy.connect(deployer).togglePause()
        expect(await pharmacy.paused()).to.equal(true)
      })

      it('unpauses with PAUSER_ROLE', async () => {
        await pharmacy.connect(deployer).togglePause()
        expect(await pharmacy.paused()).to.equal(false)
      })

      it('reverts on purchase when paused', async () => {
        await expect(
          pharmacy.connect(buyer).purchasePills(1, {
            value: PILL_INITIAL_PRICE
          })
        ).to.be.reverted
      })

      it('reverts on claim when paused', async () => {
        await expect(pharmacy.connect(buyer).claimFreePills()).to.be.reverted
      })
    })
  })

  describe('AccessControl Tests', () => {
    it('deployer is owner', async () => {
      expect(await pharmacy.owner()).to.be.equal(deployer.address)
    })
  })
})
