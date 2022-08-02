import { ethers } from 'hardhat'
import chai from '../scripts/config/chaisetup'
import { NFTEnlargeningPill } from '../types/typechain/NFTEnlargeningPill'
import { NFT } from '../types/typechain/NFT'
import { Distributor } from '../types/typechain/Distributor'
import { Pharmacy } from '../types/typechain/Pharmacy'

const { expect } = chai
const { utils } = ethers

describe('Enlargement Pill', () => {
  const CUSTOMER_INITIAL_BALANCE = ethers.utils.parseEther('10')

  const ENLARGEMENT_ROLE = utils.keccak256(
    utils.toUtf8Bytes('ENLARGEMENT_ROLE')
  )
  const MINTER_ROLE = utils.keccak256(utils.toUtf8Bytes('MINTER_ROLE'))
  const PHARMACY_ROLE = utils.keccak256(utils.toUtf8Bytes('PHARMACY_ROLE'))
  const DEFAULT_ADMIN_ROLE = ethers.constants.HashZero

  const BASE_URI = 'ipfs://abcdefg/'
  const UNREVEALED_URI = 'ipfs://unrevealed'
  const NFT_NAME = 'NFT'
  const NFT_SYMBOL = 'DMC'
  const MAX_NFT_SIZE = 5
  const ITEM_PRICE = utils.parseEther('0.08')

  const _INTERFACE_ID_ERC2981 = '0x2a55205a'
  const _INTERFACE_ID_ROYALTIES = '0xcad96cca'
  const DEFAULT_ROYALTY = 300 // 3%

  const COLLECTION_SIZE = 1000

  const PILL_NAME = 'NFT Enlargening Pill'
  const PILL_SYMBOL = 'DEP'
  const PILL_METADATA = 'ipfs://abcdefg/metadata.json'
  const PILL_INITIAL_PRICE = utils.parseEther('1')

  const DEFAULT_PILL_ID = 0
  const DEFAULT_NFT_ID = 0

  let deployer: any
  let user: any
  let noAccess: any
  let royRec_1: any
  let royRec_2: any

  let nft: NFT
  let pill: NFTEnlargeningPill
  let pharmacy: Pharmacy
  let dist: Distributor

  beforeEach(async () => {
    ;[deployer, user, noAccess, royRec_1, royRec_2] = await ethers.getSigners()

    //* Setup NFT
    const nftFactory = await ethers.getContractFactory('NFT', deployer)
    nft = (await nftFactory.deploy(
      NFT_NAME,
      NFT_SYMBOL,
      UNREVEALED_URI,
      royRec_1.address,
      DEFAULT_ROYALTY
    )) as NFT
    expect(await nft.name()).to.equal(NFT_NAME)
    expect(await nft.symbol()).to.equal(NFT_SYMBOL)
    await nft.updateURI(BASE_URI, '', true)

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
      royRec_1.address,
      DEFAULT_ROYALTY
    )) as NFTEnlargeningPill
    await nft.grantRole(ENLARGEMENT_ROLE, pill.address)
    await nft.hasRole(ENLARGEMENT_ROLE, pill.address)

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

    expect(
      await pill.hasRole(
        utils.keccak256(utils.toUtf8Bytes('PHARMACY_ROLE')),
        pharmacy.address
      )
    ).to.be.true

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

    //* SETUP USER
    await ethers.provider.send('hardhat_setBalance', [
      user.address,
      CUSTOMER_INITIAL_BALANCE.toHexString()
    ])

    expect(await ethers.provider.getBalance(user.address)).to.be.equal(
      CUSTOMER_INITIAL_BALANCE
    )

    await pharmacy.connect(user).purchasePills(1, { value: PILL_INITIAL_PRICE })
    await nft.mint(user.address)
    expect(await nft.balanceOf(user.address)).to.be.equal(1)
    expect(await pill.balanceOf(user.address)).to.be.equal(1)
  })

  describe('TokenURI Tests', () => {
    it('is correct tokenURI', async () => {
      expect(await pill.tokenURI(DEFAULT_PILL_ID)).to.be.equal(PILL_METADATA)
    })

    it('reverts on asking for non-existing tokenId', async () => {
      await expect(pill.tokenURI(99)).to.be.reverted
    })

    it('updates tokenURI to new metadata', async () => {
      const newMetaURI = 'NEW_META_URI'
      expect(await pill.tokenURI(DEFAULT_PILL_ID)).to.be.equal(PILL_METADATA)

      await pill.updateURI(newMetaURI)

      expect(await pill.tokenURI(DEFAULT_PILL_ID)).to.be.equal(newMetaURI)
    })

    it('reverts update URI without DEFAULT_ADMIN_ROLE', async () => {
      const newMetaURI = 'NEW_META_URI'
      await expect(pill.connect(noAccess).updateURI(newMetaURI)).to.be.reverted
    })
  })

  describe('Enlargement Tests', () => {
    it('changes size on grow', async () => {
      const sizeBefore = await nft.getSize(DEFAULT_NFT_ID)

      await pill.connect(user).use(DEFAULT_PILL_ID, DEFAULT_NFT_ID)

      const sizeAfter = await nft.getSize(DEFAULT_NFT_ID)
      expect(sizeAfter).to.be.equal(sizeBefore.add(1))
    })

    it('burns pill after use', async () => {
      expect(await pill.ownerOf(DEFAULT_PILL_ID)).to.be.equal(user.address)
      expect(await pill.balanceOf(user.address)).to.be.equal(1)

      await pill.connect(user).use(DEFAULT_PILL_ID, DEFAULT_NFT_ID)

      await expect(pill.ownerOf(DEFAULT_PILL_ID)).to.be.reverted
      expect(await pill.balanceOf(user.address)).to.be.equal(0)
    })

    it('changes tokenURI on grow', async () => {
      const sizeBefore = await nft.getSize(DEFAULT_NFT_ID)

      expect(await nft.tokenURI(DEFAULT_NFT_ID)).to.be.equal(
        BASE_URI + `${sizeBefore.toNumber()}/` + DEFAULT_NFT_ID + '.json'
      )

      await pill.connect(user).use(DEFAULT_PILL_ID, DEFAULT_NFT_ID)

      expect(await nft.tokenURI(DEFAULT_NFT_ID)).to.be.equal(
        BASE_URI + `${sizeBefore.add(1).toNumber()}/` + DEFAULT_NFT_ID + '.json'
      )
    })

    it('reverts trying to grow non-exisiting nft', async () => {
      await expect(pill.connect(user).use(DEFAULT_PILL_ID, 99)).to.be.reverted
    })

    it('reverts trying to use non-exisiting pill', async () => {
      await expect(pill.connect(user).use(99, DEFAULT_NFT_ID)).to.be.reverted
    })

    it('reverts trying to grow nft not owned by user', async () => {
      await pharmacy
        .connect(noAccess)
        .purchasePills(1, { value: PILL_INITIAL_PRICE })
      expect(await pill.ownerOf(1)).to.be.equal(noAccess.address)
      await expect(pill.connect(noAccess).use(1, DEFAULT_NFT_ID)).to.be.reverted
    })

    it('reverts trying to grow above max size', async () => {
      let size = await nft.getSize(DEFAULT_NFT_ID)
      let pillsUntilMax = MAX_NFT_SIZE - size.toNumber()

      await pharmacy.connect(user).purchasePills(pillsUntilMax, {
        value: PILL_INITIAL_PRICE.mul(pillsUntilMax)
      })

      for (let pillID = DEFAULT_PILL_ID; pillID < pillsUntilMax; pillID++) {
        await pill.connect(user).use(pillID, DEFAULT_NFT_ID)
      }

      expect(await pill.balanceOf(user.address)).to.be.gte(1)
      expect(await nft.getSize(DEFAULT_NFT_ID)).to.be.equal(MAX_NFT_SIZE)
      await expect(pill.connect(user).use(DEFAULT_PILL_ID, DEFAULT_NFT_ID)).to
        .be.reverted
    })
  })

  describe('AccessControl Tests', () => {
    it('deployer has all roles on enlargement pill', async () => {
      expect(await pill.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.be
        .true
      expect(await pill.hasRole(PHARMACY_ROLE, deployer.address)).to.be.true
    })

    it('reverts mint without PHARMACY_ROLE', async () => {
      await expect(pill.connect(noAccess).mint(noAccess.address)).to.be.reverted
    })

    it('grants PHARMACY_ROLE', async () => {
      expect(await pill.hasRole(PHARMACY_ROLE, noAccess.address)).to.be.false
      await pill.grantRole(PHARMACY_ROLE, noAccess.address)
      expect(await pill.hasRole(PHARMACY_ROLE, noAccess.address)).to.be.true
    })

    it('revokes PHARMACY_ROLE', async () => {
      expect(await pill.hasRole(PHARMACY_ROLE, noAccess.address)).to.be.false
      await pill.grantRole(PHARMACY_ROLE, noAccess.address)
      await pill.revokeRole(PHARMACY_ROLE, noAccess.address)
      expect(await pill.hasRole(PHARMACY_ROLE, noAccess.address)).to.be.false
    })
  })

  describe('Royalties Tests', () => {
    describe('Rarible', () => {
      it('return rarible royalties', async () => {
        const royalties = await pill.getRaribleV2Royalties(0)

        expect(royalties.length).to.be.equal(1)
        expect(royalties[0].value).to.be.equal(DEFAULT_ROYALTY)
        expect(royalties[0].account).to.be.equal(royRec_1.address)
      })

      it('return same rarible royalties for all', async () => {
        await pill.mint(user.address)

        const royalties_1 = await pill.getRaribleV2Royalties(0)
        const royalties_2 = await pill.getRaribleV2Royalties(1)

        expect(royalties_1.length).to.be.equal(royalties_2.length)
        expect(royalties_1[0].value).to.be.equal(royalties_2[0].value)
        expect(royalties_1[0].account).to.be.equal(royalties_2[0].account)
      })

      it('does not break on 0% royalty', async () => {
        const NEW_ROYALTY = 0

        await pill.updateRoyalty(royRec_2.address, NEW_ROYALTY)

        const royalties = await pill.getRaribleV2Royalties(0)

        expect(royalties.length).to.be.equal(1)
        expect(royalties[0].value).to.be.equal(NEW_ROYALTY)
        expect(royalties[0].account).to.be.equal(royRec_2.address)
      })

      it('reverts requesting royalties of non-existing tokenId', async () => {
        await expect(pill.getRaribleV2Royalties(99)).to.be.reverted
      })

      it('updates royalties', async () => {
        const NEW_ROYALTY = 1000

        await pill.updateRoyalty(royRec_2.address, NEW_ROYALTY)

        const royalties = await pill.getRaribleV2Royalties(0)

        expect(royalties.length).to.be.equal(1)
        expect(royalties[0].value).to.be.equal(NEW_ROYALTY)
        expect(royalties[0].account).to.be.equal(royRec_2.address)
      })

      it('supports rarible _INTERFACE_ID_ROYALTIES', async () => {
        expect(await pill.supportsInterface(_INTERFACE_ID_ROYALTIES)).to.be.true
      })
    })

    describe('ERC2981 Standart', () => {
      it('return royalty info', async () => {
        const SALE_PRICE = 100
        const EXPECTED_ROY_AMOUNT = (SALE_PRICE * DEFAULT_ROYALTY) / 10000

        const royInfo = await pill.royaltyInfo(0, SALE_PRICE)
        const [receiver, royAmount] = royInfo

        expect(royAmount).to.be.equal(EXPECTED_ROY_AMOUNT)
        expect(receiver).to.be.equal(royRec_1.address)
      })

      it('return same royalty info for all', async () => {
        const SALE_PRICE = 100
        const EXPECTED_ROY_AMOUNT = (SALE_PRICE * DEFAULT_ROYALTY) / 10000

        await pill.mint(user.address)

        const royInfo_1 = await pill.royaltyInfo(0, SALE_PRICE)
        const royInfo_2 = await pill.royaltyInfo(0, SALE_PRICE)

        const [receiver_1, royAmount_1] = royInfo_1
        const [receiver_2, royAmount_2] = royInfo_2

        expect(receiver_1).to.be.equal(royRec_1.address)
        expect(receiver_2).to.be.equal(royRec_1.address)
        expect(royAmount_1).to.be.equal(EXPECTED_ROY_AMOUNT)
        expect(royAmount_2).to.be.equal(EXPECTED_ROY_AMOUNT)
      })

      it('does not break on 0% royalty', async () => {
        const NEW_ROYALTY = 0
        const SALE_PRICE = 100
        const EXPECTED_ROY_AMOUNT = 0

        await pill.updateRoyalty(royRec_2.address, NEW_ROYALTY)

        const royInfo = await pill.royaltyInfo(0, SALE_PRICE)
        const [receiver, royAmount] = royInfo

        expect(royAmount).to.be.equal(EXPECTED_ROY_AMOUNT)
        expect(receiver).to.be.equal(
          '0x0000000000000000000000000000000000000000'
        )
      })

      it('does not break on 0 sales price', async () => {
        const SALE_PRICE = 0
        const EXPECTED_ROY_AMOUNT = 0

        const royInfo = await pill.royaltyInfo(0, SALE_PRICE)
        const [, royAmount] = royInfo

        expect(royAmount).to.be.equal(EXPECTED_ROY_AMOUNT)
      })

      it('reverts requesting royalties of non-existing tokenId', async () => {
        const SALE_PRICE = 100
        await expect(pill.royaltyInfo(99, SALE_PRICE)).to.be.reverted
      })

      it('updates royalties', async () => {
        const NEW_ROYALTY = 400
        const SALE_PRICE = 100
        const EXPECTED_ROY_AMOUNT = (SALE_PRICE * NEW_ROYALTY) / 10000

        await pill.updateRoyalty(royRec_2.address, NEW_ROYALTY)

        const royInfo = await pill.royaltyInfo(0, SALE_PRICE)
        const [receiver, royAmount] = royInfo

        expect(receiver).to.be.equal(royRec_2.address)
        expect(royAmount).to.be.equal(EXPECTED_ROY_AMOUNT)
      })

      it('supports rarible _INTERFACE_ID_ERC2981', async () => {
        expect(await pill.supportsInterface(_INTERFACE_ID_ERC2981)).to.be.true
      })
    })

    it('reverts update royalties above 10%', async () => {
      await expect(pill.updateRoyalty(royRec_2.address, 2000)).to.be.reverted
    })

    it('reverts update royalties without DEFAULT_ADMIN_ROLE', async () => {
      await expect(pill.connect(noAccess).updateRoyalty(royRec_2.address, 1000))
        .to.be.reverted
    })
  })
})
