import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { ethers } from 'hardhat'
import chai from '../scripts/config/chaisetup'
import { NFT } from '../types/typechain/NFT'

const { expect } = chai
const { utils, BigNumber } = ethers

describe('NFT', () => {
  const MINTER_ROLE = utils.keccak256(utils.toUtf8Bytes('MINTER_ROLE'))
  const ENLARGEMENT_ROLE = utils.keccak256(
    utils.toUtf8Bytes('ENLARGEMENT_ROLE')
  )
  const DEFAULT_ADMIN_ROLE = ethers.constants.HashZero

  const _INTERFACE_ID_ERC2981 = '0x2a55205a'
  const _INTERFACE_ID_ROYALTIES = '0xcad96cca'
  const DEFAULT_ROYALTY = 300 // 3%

  const BASE_URI = 'ipfs://QmQedNRZturmXv2fXa73v7nniw1YnF7175QGp2brHtoANM/'
  const UNREVEALED_URI =
    'ipfs://QmQedNRZturmX3asdsdasniw1YnF7175QGp2brHtoANM/unrev.json'
  const NFT_NAME = 'NFT'
  const NFT_SYMBOL = 'DMC'
  const MAX_NFT_SIZE = 5

  const DEFAULT_NFT_ID = 0

  let deployer: SignerWithAddress
  let nftOwner: SignerWithAddress
  let nftOwner2: SignerWithAddress
  let noAccess: SignerWithAddress
  let royRec_1: SignerWithAddress
  let royRec_2: SignerWithAddress

  let nft: NFT

  beforeEach(async () => {
    ;[deployer, nftOwner, nftOwner2, noAccess, royRec_1, royRec_2] =
      (await ethers.getSigners()) as SignerWithAddress[]

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

    //* Set PcDeadline
    await nft.setPcDeadline(BigNumber.from('9999999999999999999'))

    //* SETUP OWNER
    await nft.mint(nftOwner.address)
    await nft.mint(nftOwner.address)
    await nft.mint(nftOwner.address)
    expect(await nft.ownerOf(DEFAULT_NFT_ID)).to.be.equal(nftOwner.address)
  })

  describe('TokenURI Tests', () => {
    describe('Unrevealed', () => {
      it('returns unrevealedURI after deploy', async () => {
        expect(await nft.revealed()).to.be.equal(false)
        expect(await nft.tokenURI(0)).to.be.equal(UNREVEALED_URI)
        expect(await nft.tokenURI(1)).to.be.equal(UNREVEALED_URI)
      })

      it('changes URI after revealing', async () => {
        await nft.updateURI(BASE_URI, '', true)

        expect(await nft.revealed()).to.be.equal(true)

        const uri1 = await nft.tokenURI(0)
        const uri2 = await nft.tokenURI(1)

        expect(uri1).not.to.be.equal(uri2)
      })

      it('reverts revealing without DEFAULT_ADMIN_ROLE', async () => {
        await expect(nft.connect(noAccess).updateURI(BASE_URI, '', true)).to.be
          .reverted
      })
    })

    describe('Revealed', () => {
      beforeEach(async () => {
        await nft.updateURI(BASE_URI, '', true)
      })

      it('generates correct tokenURI', async () => {
        const size = await nft.getSize(DEFAULT_NFT_ID)

        expect(await nft.tokenURI(DEFAULT_NFT_ID)).to.be.equal(
          BASE_URI + `${size.toNumber()}/` + DEFAULT_NFT_ID + '.json'
        )
      })

      it('revokes getting tokenURI because it not exists', async () => {
        const tokenId = 738492
        await expect(nft.tokenURI(tokenId)).to.be.reverted
      })
    })
  })

  describe('Pill Claim Eligible Tests', () => {
    beforeEach(async () => {
      await nft.mint(nftOwner2.address)
      expect(await nft.balanceOf(nftOwner.address)).to.be.equal(3)
      expect(await nft.balanceOf(nftOwner2.address)).to.be.equal(1)
    })

    it('owner is NOT eligible if balance is < 2', async () => {
      expect(await nft.pcEligible(nftOwner2.address)).to.be.equal(0)
    })

    it('owner is eligible if balance is >= 2', async () => {
      expect(await nft.pcEligible(nftOwner.address)).to.be.equal(1)
    })

    it('eligible stacks', async () => {
      await nft.mint(nftOwner.address)

      expect(await nft.balanceOf(nftOwner.address)).to.be.equal(4)
      expect(await nft.pcEligible(nftOwner.address)).to.be.equal(2)
    })

    it('eligible status updates on transfer', async () => {
      expect(await nft.pcEligible(nftOwner.address)).to.be.equal(1)
      expect(await nft.pcEligible(nftOwner2.address)).to.be.equal(0)

      await nft
        .connect(nftOwner)
        .transferFrom(nftOwner.address, nftOwner2.address, 0)

      expect(await nft.pcEligible(nftOwner.address)).to.be.equal(1)
      expect(await nft.pcEligible(nftOwner2.address)).to.be.equal(1)

      await nft
        .connect(nftOwner)
        .transferFrom(nftOwner.address, nftOwner2.address, 1)

      expect(await nft.pcEligible(nftOwner.address)).to.be.equal(0)
      expect(await nft.pcEligible(nftOwner2.address)).to.be.equal(1)
    })

    it('pcCount updates on transfer', async () => {
      expect(await nft.balanceOf(nftOwner.address)).to.be.equal(3)
      expect(await nft.balanceOf(nftOwner2.address)).to.be.equal(1)
      expect(await nft.pcCount()).to.be.equal(1)

      await nft
        .connect(nftOwner)
        .transferFrom(nftOwner.address, nftOwner2.address, 0)

      expect(await nft.balanceOf(nftOwner.address)).to.be.equal(2)
      expect(await nft.balanceOf(nftOwner2.address)).to.be.equal(2)
      expect(await nft.pcCount()).to.be.equal(2)

      await nft.mint(nftOwner.address)
      await nft.mint(nftOwner.address)

      expect(await nft.balanceOf(nftOwner.address)).to.be.equal(4)
      expect(await nft.balanceOf(nftOwner2.address)).to.be.equal(2)
      expect(await nft.pcCount()).to.be.equal(3)

      await nft
        .connect(nftOwner)
        .transferFrom(nftOwner.address, nftOwner2.address, 1)

      expect(await nft.balanceOf(nftOwner.address)).to.be.equal(3)
      expect(await nft.balanceOf(nftOwner2.address)).to.be.equal(3)
      expect(await nft.pcCount()).to.be.equal(2)
    })

    it('sets deadline', async () => {
      expect(await nft.pcDeadline()).to.not.be.equal(777)
      await nft.setPcDeadline(777)
      expect(await nft.pcDeadline()).to.be.equal(777)
    })

    it('reverts set deadline without DEFAULT_ADMIN_ROLE', async () => {
      await expect(nft.connect(noAccess).setPcDeadline(777)).to.be.reverted
    })
  })

  describe('Minting Tests', () => {
    it('is possible to mint an nft with MINTER_ROLE', async () => {
      const balanceBefMint = await nft.balanceOf(nftOwner.address)
      await nft.connect(deployer).mint(nftOwner.address)
      const balanceAfterMint = await nft.balanceOf(nftOwner.address)
      expect(balanceAfterMint).to.equal(balanceBefMint.add(1))
    })

    it('increases tracker on mint', async () => {
      const trackerBefore = await nft.getCurrentTokenTracker()
      await nft.connect(deployer).mint(nftOwner.address)
      const trackerAfter = await nft.getCurrentTokenTracker()
      expect(trackerAfter).to.equal(trackerBefore.add(1))
    })
  })

  describe('General Tests', () => {
    it('gets size', async () => {
      expect(await nft.getSize(DEFAULT_NFT_ID))
        .to.be.gt(0)
        .lte(MAX_NFT_SIZE)
    })

    it('gets currentTracker with MINTER_ROLE', async () => {
      expect(await nft.getCurrentTokenTracker()).to.be.gt(DEFAULT_NFT_ID)
    })

    it('sets provenance hash', async () => {
      const newProv = 'adahsdohasdoahsd'
      expect(await nft.DMSS_PROVENANCE()).to.be.equal('')
      await nft.setProvenanceHash(newProv)
      expect(await nft.DMSS_PROVENANCE()).to.be.equal(newProv)
    })

    it('reverts setting provenance hash without DEFAULT_ADMIN_ROLE', async () => {
      await expect(nft.connect(noAccess).setProvenanceHash('abc')).to.be
        .reverted
    })

    it('reverts getting currentTracker without MINTER_ROLE', async () => {
      await expect(nft.connect(noAccess).getCurrentTokenTracker()).to.be
        .reverted
    })
  })

  describe('AccessControl Tests', () => {
    it('deployer has all roles on distributor', async () => {
      expect(await nft.hasRole(MINTER_ROLE, deployer.address)).to.be.true
      expect(await nft.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.be.true
    })

    it('reverts on mint without MINTER_ROLE', async () => {
      await expect(nft.connect(noAccess).mint(nftOwner.address)).to.be.reverted
    })

    it('reverts grow without ENLARGEMENT_ROLE', async () => {
      await expect(nft.connect(noAccess).grow(DEFAULT_NFT_ID)).to.be.reverted
    })

    it('grants MINTER_ROLE', async () => {
      expect(await nft.hasRole(MINTER_ROLE, noAccess.address)).to.be.false
      await nft.grantRole(MINTER_ROLE, noAccess.address)
      expect(await nft.hasRole(MINTER_ROLE, noAccess.address)).to.be.true
    })

    it('grants ENLARGEMENT_ROLE', async () => {
      expect(await nft.hasRole(ENLARGEMENT_ROLE, noAccess.address)).to.be.false
      await nft.grantRole(ENLARGEMENT_ROLE, noAccess.address)
      expect(await nft.hasRole(ENLARGEMENT_ROLE, noAccess.address)).to.be.true
    })

    it('revokes MINTER_ROLE', async () => {
      expect(await nft.hasRole(MINTER_ROLE, noAccess.address)).to.be.false
      await nft.grantRole(MINTER_ROLE, noAccess.address)
      await nft.revokeRole(MINTER_ROLE, noAccess.address)
      expect(await nft.hasRole(MINTER_ROLE, noAccess.address)).to.be.false
    })

    it('revokes ENLARGEMENT_ROLE', async () => {
      expect(await nft.hasRole(ENLARGEMENT_ROLE, noAccess.address)).to.be.false
      await nft.grantRole(ENLARGEMENT_ROLE, noAccess.address)
      await nft.revokeRole(ENLARGEMENT_ROLE, noAccess.address)
      expect(await nft.hasRole(ENLARGEMENT_ROLE, noAccess.address)).to.be.false
    })
  })

  describe('Royalties Tests', () => {
    describe('Rarible', () => {
      it('return rarible royalties', async () => {
        const royalties = await nft.getRaribleV2Royalties(0)

        expect(royalties.length).to.be.equal(1)
        expect(royalties[0].value).to.be.equal(DEFAULT_ROYALTY)
        expect(royalties[0].account).to.be.equal(royRec_1.address)
      })

      it('return same rarible royalties for all', async () => {
        await nft.mint(nftOwner.address)

        const royalties_1 = await nft.getRaribleV2Royalties(0)
        const royalties_2 = await nft.getRaribleV2Royalties(1)

        expect(royalties_1.length).to.be.equal(royalties_2.length)
        expect(royalties_1[0].value).to.be.equal(royalties_2[0].value)
        expect(royalties_1[0].account).to.be.equal(royalties_2[0].account)
      })

      it('does not break on 0% royalty', async () => {
        const NEW_ROYALTY = 0

        await nft.updateRoyalty(royRec_2.address, NEW_ROYALTY)

        const royalties = await nft.getRaribleV2Royalties(0)

        expect(royalties.length).to.be.equal(1)
        expect(royalties[0].value).to.be.equal(NEW_ROYALTY)
        expect(royalties[0].account).to.be.equal(royRec_2.address)
      })

      it('reverts requesting royalties of non-existing tokenId', async () => {
        await expect(nft.getRaribleV2Royalties(99)).to.be.reverted
      })

      it('updates royalties', async () => {
        const NEW_ROYALTY = 1000

        await nft.updateRoyalty(royRec_2.address, NEW_ROYALTY)

        const royalties = await nft.getRaribleV2Royalties(0)

        expect(royalties.length).to.be.equal(1)
        expect(royalties[0].value).to.be.equal(NEW_ROYALTY)
        expect(royalties[0].account).to.be.equal(royRec_2.address)
      })

      it('supports rarible _INTERFACE_ID_ROYALTIES', async () => {
        expect(await nft.supportsInterface(_INTERFACE_ID_ROYALTIES)).to.be.true
      })
    })

    describe('ERC2981 Standart', () => {
      it('return royalty info', async () => {
        const SALE_PRICE = 100
        const EXPECTED_ROY_AMOUNT = (SALE_PRICE * DEFAULT_ROYALTY) / 10000

        const royInfo = await nft.royaltyInfo(0, SALE_PRICE)
        const [receiver, royAmount] = royInfo

        expect(royAmount).to.be.equal(EXPECTED_ROY_AMOUNT)
        expect(receiver).to.be.equal(royRec_1.address)
      })

      it('return same royalty info for all', async () => {
        const SALE_PRICE = 100
        const EXPECTED_ROY_AMOUNT = (SALE_PRICE * DEFAULT_ROYALTY) / 10000

        await nft.mint(nftOwner.address)

        const royInfo_1 = await nft.royaltyInfo(0, SALE_PRICE)
        const royInfo_2 = await nft.royaltyInfo(0, SALE_PRICE)

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

        await nft.updateRoyalty(royRec_2.address, NEW_ROYALTY)

        const royInfo = await nft.royaltyInfo(0, SALE_PRICE)
        const [receiver, royAmount] = royInfo

        expect(royAmount).to.be.equal(EXPECTED_ROY_AMOUNT)
        expect(receiver).to.be.equal(
          '0x0000000000000000000000000000000000000000'
        )
      })

      it('does not break on 0 sales price', async () => {
        const SALE_PRICE = 0
        const EXPECTED_ROY_AMOUNT = 0

        const royInfo = await nft.royaltyInfo(0, SALE_PRICE)
        const [, royAmount] = royInfo

        expect(royAmount).to.be.equal(EXPECTED_ROY_AMOUNT)
      })

      it('reverts requesting royalties of non-existing tokenId', async () => {
        const SALE_PRICE = 100
        await expect(nft.royaltyInfo(99, SALE_PRICE)).to.be.reverted
      })

      it('updates royalties', async () => {
        const NEW_ROYALTY = 400
        const SALE_PRICE = 100
        const EXPECTED_ROY_AMOUNT = (SALE_PRICE * NEW_ROYALTY) / 10000

        await nft.updateRoyalty(royRec_2.address, NEW_ROYALTY)

        const royInfo = await nft.royaltyInfo(0, SALE_PRICE)
        const [receiver, royAmount] = royInfo

        expect(receiver).to.be.equal(royRec_2.address)
        expect(royAmount).to.be.equal(EXPECTED_ROY_AMOUNT)
      })

      it('supports rarible _INTERFACE_ID_ERC2981', async () => {
        expect(await nft.supportsInterface(_INTERFACE_ID_ERC2981)).to.be.true
      })
    })

    it('reverts update royalties above 10%', async () => {
      await expect(nft.updateRoyalty(royRec_2.address, 2000)).to.be.reverted
    })

    it('reverts update royalties without DEFAULT_ADMIN_ROLE', async () => {
      await expect(nft.connect(noAccess).updateRoyalty(royRec_2.address, 1000))
        .to.be.reverted
    })
  })
})
