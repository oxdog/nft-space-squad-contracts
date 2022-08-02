import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { ethers } from 'hardhat'
import moment from 'moment'
import chai from '../scripts/config/chaisetup'
import { NFT } from '../types/typechain/NFT'
import { companyCard } from '../types/typechain/companyCard'
import { PreSale } from '../types/typechain/PreSale'

const { expect } = chai
const { utils } = ethers

describe('PreSale', async () => {
  const MINTER_ROLE = utils.keccak256(utils.toUtf8Bytes('MINTER_ROLE'))
  const AUTH_MINTER = utils.keccak256(utils.toUtf8Bytes('AUTH_MINTER'))

  const NFT_NAME = 'NFT'
  const NFT_SYMBOL = 'DMC'
  const BASE_URI = 'ipfs://abcdefg/'
  const UNREVEALED_URI = 'ipfs://unrevealed'
  const ITEM_PRICE = ethers.utils.parseEther('0.8')
  const DEFAULT_ROYALTY = 300 // 3%
  const RELEASE_DATE_UTC = moment.utc().add(2, 'months').unix()

  const CONTINGENT = 10
  const PRESALE_SIZE = 100
  const MAX_ISSUANCE_PER_TX = 20

  let deployer: SignerWithAddress
  let buyer: SignerWithAddress
  let noAccess: SignerWithAddress
  let royRec: SignerWithAddress

  let nft: NFT
  let pre: PreSale
  let emc: companyCard

  beforeEach(async () => {
    ;[deployer, buyer, noAccess, royRec] = await ethers.getSigners()

    await ethers.provider.send('hardhat_setBalance', [
      buyer.address,
      utils.parseEther('1000').toHexString()
    ])

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

    //* Setup EMC
    const emcFactory = await ethers.getContractFactory('companyCard', deployer)
    emc = (await emcFactory.deploy(
      NFT_NAME,
      NFT_SYMBOL,
      BASE_URI,
      deployer.address
    )) as companyCard

    //* SETUP Presale
    const preFactory = await ethers.getContractFactory('PreSale', deployer)

    pre = (await preFactory.deploy(
      nft.address,
      emc.address,
      PRESALE_SIZE,
      RELEASE_DATE_UTC,
      ITEM_PRICE
    )) as PreSale

    await emc.grantRole(AUTH_MINTER, pre.address)
    await nft.grantRole(MINTER_ROLE, pre.address)
  })

  describe('Release Tests', () => {
    it.skip('revers mint if sale not started', async () => {
      await expect(
        pre.connect(buyer).mintNewNFTs(1, {
          value: ITEM_PRICE
        })
      ).to.be.revertedWith('PS: Sale not started')
    })
  })

  describe('Mint Tests', () => {
    before(() => {
      ethers.provider.send('evm_increaseTime', [60 * 60 * 24 * 30 * 2])
    })

    it('mint 1', async () => {
      // Eth Preis 1700€
      // 35 Gwei
      // quantity 1 =>  282558 Gas => 0,0098895 ETH = 17€
      // quantity 2 =>  536669 Gas => 0,0187834 ETH = 32€
      // quantity 5 => 1299002 Gas => 0,0454650 ETH = 78€

      // "high" 50 Gwei
      // quantity 1 =>  282558 Gas => 0,0141279 ETH = 24€

      // "low" 22 Gwei
      // quantity 1 =>  282558 Gas => 0,0062162 ETH = 11€

      // Per NFT
      // low  => 11€ per NFT  (Samstag Vormittag bis Mittag)
      // mid  => 17€ per NFT  (average am Tag)
      // high => 24€ per NFT  (Abends)

      const quantity = 1
      const tx = await pre.connect(buyer).mintNewNFTs(quantity, {
        value: ITEM_PRICE.mul(quantity)
      })
      const recipe = await tx.wait()
      console.log(recipe.gasUsed)
    })

    it('mints single membership card', async () => {
      expect(await emc.balanceOf(buyer.address)).to.equal(0)
      await pre.connect(buyer).mintNewNFTs(1, {
        value: ITEM_PRICE
      })
      expect(await emc.balanceOf(buyer.address)).to.equal(1)
    })

    it('mints multiple membership card', async () => {
      const quantity = 5
      expect(await emc.balanceOf(buyer.address)).to.equal(0)
      await pre.connect(buyer).mintNewNFTs(quantity, {
        value: ITEM_PRICE.mul(quantity)
      })
      expect(await emc.balanceOf(buyer.address)).to.equal(quantity)
    })

    it('mints single NFT to buyer', async () => {
      expect(await nft.balanceOf(buyer.address)).to.equal(0)
      await pre.connect(buyer).mintNewNFTs(1, {
        value: ITEM_PRICE
      })
      expect(await nft.balanceOf(buyer.address)).to.equal(1)
    })

    it('mints multiple NFTs to buyer', async () => {
      const quantity = 5
      expect(await nft.balanceOf(buyer.address)).to.equal(0)
      await pre.connect(buyer).mintNewNFTs(quantity, {
        value: ITEM_PRICE.mul(quantity)
      })
      expect(await nft.balanceOf(buyer.address)).to.equal(quantity)
    })

    it('reverts if payment is too low on single', async () => {
      await expect(
        pre.connect(buyer).mintNewNFTs(1, {
          value: ITEM_PRICE.div(2)
        })
      ).to.be.reverted
    })

    it('reverts if payment is too low on multiple', async () => {
      await expect(
        pre.connect(buyer).mintNewNFTs(5, {
          value: ITEM_PRICE.mul(4)
        })
      ).to.be.reverted
    })

    it('refunds correct amount on single', async () => {
      const BUYER_INITIAL_BALANCE = await ethers.provider.getBalance(
        buyer.address
      )
      await pre.connect(buyer).mintNewNFTs(1, {
        value: ITEM_PRICE.add(utils.parseEther('1'))
      })

      expect(await ethers.provider.getBalance(buyer.address))
        .to.be.gte(
          BUYER_INITIAL_BALANCE.sub(ITEM_PRICE).sub(
            utils.parseEther('0.01') // gasfees
          )
        )
        .lte(BUYER_INITIAL_BALANCE.sub(ITEM_PRICE))
    })

    it('refunds correct amount on multiple', async () => {
      const quantity = 5
      const BUYER_INITIAL_BALANCE = await ethers.provider.getBalance(
        buyer.address
      )
      expect(await ethers.provider.getBalance(buyer.address)).to.be.equal(
        BUYER_INITIAL_BALANCE
      )
      await pre.connect(buyer).mintNewNFTs(quantity, {
        value: ITEM_PRICE.mul(quantity).add(utils.parseEther('1'))
      })

      expect(await ethers.provider.getBalance(buyer.address))
        .to.be.gte(
          BUYER_INITIAL_BALANCE.sub(ITEM_PRICE.mul(quantity)).sub(
            utils.parseEther('0.01') // gasfees
          )
        )
        .lte(BUYER_INITIAL_BALANCE.sub(ITEM_PRICE.mul(quantity)))
    })

    it('reverts mint on pre-sale sold out', async () => {
      await pre
        .connect(deployer)
        .issueContingent(deployer.address, PRESALE_SIZE)

      await expect(
        pre.connect(buyer).mintNewNFTs(1, {
          value: ITEM_PRICE
        })
      ).to.be.reverted
    })

    it('issues contingent', async () => {
      expect(await nft.balanceOf(deployer.address)).to.equal(0)
      await pre.connect(deployer).issueContingent(deployer.address, CONTINGENT)
      expect(await nft.balanceOf(deployer.address)).to.equal(CONTINGENT)
    })

    it('reverts contingent issuance by non owner', async () => {
      await expect(pre.connect(noAccess).issueContingent(buyer.address, 1)).to
        .be.reverted
    })
  })

  describe('Release Tests', () => {
    it('has correct release dates', async () => {
      expect(await pre.releaseDate()).to.be.equal(RELEASE_DATE_UTC)
    })
  })

  describe('AccessControl Tests', () => {
    it('deployer is owner', async () => {
      expect(await pre.owner()).to.be.equal(deployer.address)
    })
  })
})
