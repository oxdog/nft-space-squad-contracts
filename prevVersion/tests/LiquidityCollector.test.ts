import { BigNumber } from 'ethers'
import { ethers } from 'hardhat'
import chai from '../../scripts/config/chaisetup'
import { NFTEnlargeningPill } from '../../types/typechain/NFTEnlargeningPill'
import { NFT } from '../../types/typechain/NFT'
import { Distributor } from '../../types/typechain/Distributor'
import { DogeCoin } from '../../types/typechain/DogeCoin'
import { LiquidityCollector } from '../../types/typechain/LiquidityCollector'
import { Pharmacy } from '../../types/typechain/Pharmacy'

const { expect } = chai
const { utils } = ethers

describe('Liquidity Collector', () => {
  const COMMUNITY_PERCENT = 10 // 10%
  const DONATION_PERCENT = 10

  const INITIAL_WALLET_BALANCE = utils.parseEther('10')
  const COMMUNITY_WALLET_CAP = utils.parseEther('15')
  const INITIAL_ERC20_BALANCE = utils.parseEther('1')

  const MINTER_ROLE = utils.keccak256(utils.toUtf8Bytes('MINTER_ROLE'))
  const PHARMACY_ROLE = utils.keccak256(utils.toUtf8Bytes('PHARMACY_ROLE'))

  const BASE_URI = 'ipfs://abcdefg/'
  const UNREVEALED_URI = 'ipfs://unrevealed'
  const NFT_NAME = 'NFT'
  const NFT_SYMBOL = 'DMC'
  const ITEM_PRICE = utils.parseEther('0.08')
  const DEFAULT_ROYALTY = 300 // 3%

  const COLLECTION_SIZE = 20

  const PILL_NAME = 'Enlargement Pill'
  const PILL_SYMBOL = 'ELP'
  const PILL_METADATA = 'ipfs://abcdefg/metadata.json'
  const PILL_INITIAL_PRICE = utils.parseEther('0.1')

  let deployer: any
  let buyer: any
  let noAccess: any
  let royRec: any

  let communityWallet: any
  let donationWallet: any
  let beneficiary_1: any
  let beneficiary_2: any
  let beneficiary_3: any
  let beneficiary_4: any
  let beneficiaries: any[]

  let nft: NFT
  let pill: NFTEnlargeningPill
  let dist: Distributor
  let pharmacy: Pharmacy
  let liquidity: LiquidityCollector
  let liquidity_2: LiquidityCollector
  let dogeCoin: DogeCoin

  beforeEach(async () => {
    ;[
      deployer,
      noAccess,
      royRec,
      communityWallet,
      donationWallet,
      beneficiary_1,
      beneficiary_2,
      beneficiary_3,
      beneficiary_4,
      buyer
    ] = await ethers.getSigners()

    beneficiaries = [beneficiary_1, beneficiary_2, beneficiary_3, beneficiary_4]

    //* Setup NFT
    const nftFactory = await ethers.getContractFactory('NFT', deployer)
    nft = (await nftFactory.deploy(
      NFT_NAME,
      NFT_SYMBOL,
      UNREVEALED_URI,
      royRec.address,
      DEFAULT_ROYALTY
    )) as NFT
    await nft.updateURI(BASE_URI, '', true)

    //* SETUP LIQUIDITY COLLECTOR
    const liqFac = await ethers.getContractFactory(
      'LiquidityCollector',
      deployer
    )

    liquidity = (await liqFac.deploy(
      beneficiaries.map((b) => b.address),
      communityWallet.address,
      donationWallet.address,
      COMMUNITY_WALLET_CAP
    )) as LiquidityCollector

    liquidity_2 = (await liqFac.deploy(
      beneficiaries.map((b) => b.address),
      communityWallet.address,
      donationWallet.address,
      COMMUNITY_WALLET_CAP
    )) as LiquidityCollector

    //* SETUP DISTRIBUTOR
    const distFactory = await ethers.getContractFactory('Distributor', deployer)

    dist = (await distFactory.deploy(
      nft.address,
      COLLECTION_SIZE,
      1,
      0,
      ITEM_PRICE
    )) as Distributor

    await nft.grantRole(MINTER_ROLE, dist.address)

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
      1000
    )) as Pharmacy

    await pill.grantRole(PHARMACY_ROLE, pharmacy.address)

    //* Setup ERC20
    const dogeFactory = await ethers.getContractFactory('DogeCoin', deployer)

    dogeCoin = (await dogeFactory.deploy(
      'DogeCoin',
      'DC',
      INITIAL_ERC20_BALANCE
    )) as DogeCoin

    await dogeCoin.transfer(liquidity.address, INITIAL_ERC20_BALANCE)
  })

  describe('Liquidity Forwarding Tests', () => {
    it('forwards correct amount on nft purchase', async () => {
      const quantity = 5

      expect(await ethers.provider.getBalance(liquidity.address)).to.be.equal(0)

      await dist
        .connect(buyer)
        .mintNewNFTs(quantity, { whitelist: 0, freeMint: 0 }, [], {
          value: ITEM_PRICE.mul(quantity)
        })

      expect(await ethers.provider.getBalance(liquidity.address)).to.be.equal(
        ITEM_PRICE.mul(quantity)
      )
    })

    it('forwards correct amount on pill purchase', async () => {
      const quantity = 3

      expect(await ethers.provider.getBalance(liquidity.address)).to.be.equal(0)

      await pharmacy.connect(buyer).purchasePills(quantity, {
        value: PILL_INITIAL_PRICE.mul(quantity)
      })

      expect(await ethers.provider.getBalance(liquidity.address)).to.be.equal(
        PILL_INITIAL_PRICE.mul(quantity)
      )
    })
  })

  describe('Liquidity Distribution Tests', () => {
    beforeEach(async () => {
      beneficiaries.forEach(
        async (beneficiary) =>
          await ethers.provider.send('hardhat_setBalance', [
            beneficiary.address,
            INITIAL_WALLET_BALANCE.toHexString()
          ])
      )

      await ethers.provider.send('hardhat_setBalance', [
        liquidity.address,
        INITIAL_WALLET_BALANCE.toHexString()
      ])

      await ethers.provider.send('hardhat_setBalance', [
        donationWallet.address,
        INITIAL_WALLET_BALANCE.toHexString()
      ])

      await ethers.provider.send('hardhat_setBalance', [
        communityWallet.address,
        INITIAL_WALLET_BALANCE.toHexString()
      ])
    })

    const distributionTest = async (LIQUIDITY: BigNumber) => {
      const expCommunityBalance = LIQUIDITY.mul(COMMUNITY_PERCENT).div(100)
      const expDonationBalance = LIQUIDITY.mul(DONATION_PERCENT).div(100)
      const expBeneficiaryBalance = LIQUIDITY.sub(expCommunityBalance)
        .sub(expDonationBalance)
        .div(beneficiaries.length)

      await ethers.provider.send('hardhat_setBalance', [
        liquidity.address,
        LIQUIDITY.toHexString()
      ])

      // Pre Conditions
      expect(await ethers.provider.getBalance(liquidity.address)).to.be.equal(
        LIQUIDITY
      )

      // Execution
      await liquidity.distribute()

      // Post Conditions
      expect(await ethers.provider.getBalance(liquidity.address)).to.be.equal(0)

      expect(
        await ethers.provider.getBalance(communityWallet.address)
      ).to.be.equal(INITIAL_WALLET_BALANCE.add(expCommunityBalance))

      expect(
        await ethers.provider.getBalance(donationWallet.address)
      ).to.be.equal(INITIAL_WALLET_BALANCE.add(expDonationBalance))

      beneficiaries.forEach(async (beneficiary) =>
        expect(
          await ethers.provider.getBalance(beneficiary.address)
        ).to.be.equal(INITIAL_WALLET_BALANCE.add(expBeneficiaryBalance))
      )
    }

    it('Liquitidty distribution 3.33 Eth', async () => {
      const LIQUIDITY = ethers.utils.parseEther('3.33')
      await distributionTest(LIQUIDITY)
    })

    it('Liquitidty distribution 5 Eth', async () => {
      const LIQUIDITY = ethers.utils.parseEther('5')
      await distributionTest(LIQUIDITY)
    })

    it('Liquitidty distribution 10 Eth', async () => {
      const LIQUIDITY = ethers.utils.parseEther('10')
      await distributionTest(LIQUIDITY)
    })

    it('fills up left amount to reach community cap', async () => {
      await ethers.provider.send('hardhat_setBalance', [
        communityWallet.address,
        COMMUNITY_WALLET_CAP.sub(utils.parseEther('1')).toHexString()
      ])

      await ethers.provider.send('hardhat_setBalance', [
        liquidity.address,
        utils.parseEther('15').toHexString()
      ])

      expect(
        await ethers.provider.getBalance(communityWallet.address)
      ).to.be.equal(COMMUNITY_WALLET_CAP.sub(utils.parseEther('1')))

      await liquidity.distribute()

      expect(
        await ethers.provider.getBalance(communityWallet.address)
      ).to.be.equal(COMMUNITY_WALLET_CAP)
    })

    it('does not payout community wallet when limit is already reached', async () => {
      await ethers.provider.send('hardhat_setBalance', [
        communityWallet.address,
        COMMUNITY_WALLET_CAP.toHexString()
      ])

      await ethers.provider.send('hardhat_setBalance', [
        liquidity.address,
        utils.parseEther('15').toHexString()
      ])

      expect(
        await ethers.provider.getBalance(communityWallet.address)
      ).to.be.equal(COMMUNITY_WALLET_CAP)

      await liquidity.distribute()

      expect(
        await ethers.provider.getBalance(communityWallet.address)
      ).to.be.equal(COMMUNITY_WALLET_CAP)
    })

    it('distributes correctly to beneficiaries on reached community cap', async () => {
      await ethers.provider.send('hardhat_setBalance', [
        communityWallet.address,
        COMMUNITY_WALLET_CAP.toHexString()
      ])

      await ethers.provider.send('hardhat_setBalance', [
        liquidity.address,
        utils.parseEther('10').toHexString()
      ])

      const BENEFICIARY_AMOUNT = utils.parseEther('9').div(4)

      await liquidity.distribute()

      beneficiaries.forEach(async (beneficiary) =>
        expect(
          await ethers.provider.getBalance(beneficiary.address)
        ).to.be.equal(INITIAL_WALLET_BALANCE.add(BENEFICIARY_AMOUNT))
      )
    })

    it('reverts distribute if there is no liqudity left', async () => {
      await liquidity.distribute()
      expect(await ethers.provider.getBalance(liquidity.address)).to.be.equal(0)
      await expect(liquidity.distribute()).to.be.reverted
    })
  })

  describe('ERC20', () => {
    it('has ERC20 in balance', async () => {
      expect(await dogeCoin.balanceOf(liquidity.address)).to.be.equal(
        INITIAL_ERC20_BALANCE
      )
    })

    it('has no ERC20 in balance after distribution', async () => {
      await liquidity.distributeERC20(dogeCoin.address)
      expect(await dogeCoin.balanceOf(liquidity.address)).to.be.equal(0)
    })

    it('wallets have no ERC20 balance without distribution', async () => {
      expect(await dogeCoin.balanceOf(communityWallet.address)).to.be.equal(0)
      expect(await dogeCoin.balanceOf(donationWallet.address)).to.be.equal(0)

      beneficiaries.forEach(async (beneficiary) =>
        expect(await dogeCoin.balanceOf(beneficiary.address)).to.be.equal(0)
      )
    })

    it('distributes ERC20 correctly', async () => {
      const expCommunityBalance =
        INITIAL_ERC20_BALANCE.mul(COMMUNITY_PERCENT).div(100)
      const expDonationBalance =
        INITIAL_ERC20_BALANCE.mul(DONATION_PERCENT).div(100)
      const expBeneficiaryBalance = INITIAL_ERC20_BALANCE.sub(
        expCommunityBalance
      )
        .sub(expDonationBalance)
        .div(beneficiaries.length)

      await liquidity.distributeERC20(dogeCoin.address)

      expect(await dogeCoin.balanceOf(communityWallet.address)).to.be.equal(
        expCommunityBalance
      )
      expect(await dogeCoin.balanceOf(donationWallet.address)).to.be.equal(
        expDonationBalance
      )

      beneficiaries.forEach(async (beneficiary) =>
        expect(await dogeCoin.balanceOf(beneficiary.address)).to.be.equal(
          expBeneficiaryBalance
        )
      )
    })

    it('reverts on ERC20 distribute without balance', async () => {
      await liquidity.distributeERC20(dogeCoin.address)
      expect(await dogeCoin.balanceOf(liquidity.address)).to.be.equal(0)
      await expect(liquidity.distributeERC20(dogeCoin.address)).to.be.reverted
    })

    it('reverts on non-ERC20 address', async () => {
      await expect(liquidity.distributeERC20(liquidity_2.address)).to.be
        .reverted
      await expect(liquidity.distributeERC20(deployer.address)).to.be.reverted
    })

    it('reverts on ERC20 distribute without PAYPATROL_ROLE', async () => {
      await expect(
        liquidity.connect(noAccess).distributeERC20(dogeCoin.address)
      ).to.be.reverted
    })
  })

  describe('Update Tests', () => {
    it('updates community cap', async () => {
      const NEW_CAP = ethers.utils.parseEther('100')
      expect(await liquidity.communityCap()).to.be.equal(COMMUNITY_WALLET_CAP)
      await liquidity.updateCommunityCap(NEW_CAP)
      expect(await liquidity.communityCap()).to.be.equal(NEW_CAP)
    })

    it('updates beneficiaries', async () => {
      const maxID = beneficiaries.length - 1
      expect(await liquidity.beneficiaries(maxID)).to.satisfy
      await liquidity.updateBeneficiaries(
        beneficiaries.slice(0, 2).map((b) => b.address)
      )
      await expect(liquidity.beneficiaries(maxID)).to.be.reverted
    })

    it('updates community wallet', async () => {
      expect(await liquidity.communityWallet()).to.be.equal(
        communityWallet.address
      )
      await liquidity.updateCommunityWallet(noAccess.address)
      expect(await liquidity.communityWallet()).to.be.equal(noAccess.address)
    })

    it('updates donation wallet', async () => {
      expect(await liquidity.donationWallet()).to.be.equal(
        donationWallet.address
      )
      await liquidity.updateDonationWallet(noAccess.address)
      expect(await liquidity.donationWallet()).to.be.equal(noAccess.address)
    })

    it('reverts update community wallet without DEFAULT_ADMIN_ROLE', async () => {
      await expect(
        liquidity.connect(noAccess).updateCommunityWallet(noAccess.address)
      ).to.be.reverted
    })

    it('reverts update donation wallet without DEFAULT_ADMIN_ROLE', async () => {
      await expect(
        liquidity.connect(noAccess).updateDonationWallet(noAccess.address)
      ).to.be.reverted
    })

    it('reverts update community cap without DEFAULT_ADMIN_ROLE', async () => {
      const NEW_CAP = ethers.utils.parseEther('100')
      await expect(liquidity.connect(noAccess).updateCommunityCap(NEW_CAP)).to
        .be.reverted
    })

    it('reverts update beneficiaries without DEFAULT_ADMIN_ROLE', async () => {
      await expect(
        liquidity
          .connect(noAccess)
          .updateBeneficiaries(beneficiaries.slice(0, 2).map((b) => b.address))
      ).to.be.reverted
    })

    it('updates LC address on distributor', async () => {
      expect(await dist.liquidityCollector()).to.be.equal(liquidity.address)
      await dist.updateLiquidityCollector(liquidity_2.address)
      expect(await dist.liquidityCollector()).to.be.equal(liquidity_2.address)
    })

    it('updates LC address on pharmacy', async () => {
      expect(await pharmacy.liquidityCollector()).to.be.equal(liquidity.address)
      await pharmacy.updateLiquidityCollector(liquidity_2.address)
      expect(await pharmacy.liquidityCollector()).to.be.equal(
        liquidity_2.address
      )
    })

    it('reverts LC address on distributor without DEFAULT_ADMIN_ROLE', async () => {
      await expect(
        dist.connect(noAccess).updateLiquidityCollector(liquidity_2.address)
      ).to.be.reverted
    })

    it('reverts LC address on pharmacy without DEFAULT_ADMIN_ROLE', async () => {
      await expect(
        pharmacy.connect(noAccess).updateLiquidityCollector(liquidity_2.address)
      ).to.be.reverted
    })
  })
})
