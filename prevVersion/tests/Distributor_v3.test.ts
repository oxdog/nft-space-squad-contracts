import { ethers } from 'hardhat'
import chai from '../../scripts/config/chaisetup'
import { NFT } from '../../types/typechain/NFT'
import { Distributor } from '../../types/typechain/Distributor'
import moment from 'moment'
import { BigNumber } from 'ethers'

const { expect } = chai
const { utils } = ethers

describe.skip('Distributor v3', () => {
  const BUYER_INITIAL_BALANCE = ethers.utils.parseEther('18')

  const MINTER_ROLE = utils.keccak256(utils.toUtf8Bytes('MINTER_ROLE'))
  const ISSUER_ROLE = utils.keccak256(utils.toUtf8Bytes('ISSUER_ROLE'))
  const PAUSER_ROLE = utils.keccak256(utils.toUtf8Bytes('PAUSER_ROLE'))
  const DEFAULT_ADMIN_ROLE = ethers.constants.HashZero

  const NFT_NAME = 'NFT'
  const NFT_SYMBOL = 'DMC'
  const BASE_URI = 'ipfs://abcdefg/'
  const UNREVEALED_URI = 'ipfs://unrevealed'
  const ITEM_PRICE = ethers.utils.parseEther('0.8')
  const DEFAULT_ROYALTY = 300 // 3%
  const RELEASE_DATE_UTC = moment.utc().add(2, 'day').unix()
  const WL_RELEASE_DATE_UTC = moment.utc().add(1, 'day').unix()
  const WL_M1_CONTINGENT = BigNumber.from(2)
  const WL_M2_CONTINGENT = BigNumber.from(4)
  const FM_M1_CONTINGENT = BigNumber.from(1)
  const FM_M2_CONTINGENT = BigNumber.from(3)

  const CONTINGENT = 10
  const COLLECTION_SIZE = 20
  const MAX_ISSUANCE_PER_TX = 20

  let deployer: any
  let buyer: any
  let noAccess: any
  let royRec: any
  let wlMember1: any
  let wlMember2: any
  let publicSale1: any

  let nft: NFT
  let dist: Distributor

  beforeEach(async () => {
    ;[deployer, buyer, noAccess, royRec, wlMember1, wlMember2, publicSale1] =
      await ethers.getSigners()

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

    //* SETUP CUSTOMER
    await ethers.provider.send('hardhat_setBalance', [
      buyer.address,
      BUYER_INITIAL_BALANCE.toHexString()
    ])

    expect(await ethers.provider.getBalance(buyer.address)).to.be.equal(
      BUYER_INITIAL_BALANCE
    )

    //* SETUP DISTRIBUTOR
    const distFactory = await ethers.getContractFactory('Distributor', deployer)

    dist = (await distFactory.deploy(
      nft.address,
      COLLECTION_SIZE,
      RELEASE_DATE_UTC,
      WL_RELEASE_DATE_UTC,
      ITEM_PRICE
    )) as Distributor

    await nft.grantRole(MINTER_ROLE, dist.address)
    await dist.updateSpots([
      {
        position: deployer.address,
        whitelistContingent: 2,
        freeMintContingent: 0
      },
      {
        position: buyer.address,
        whitelistContingent: 2,
        freeMintContingent: 0
      }
    ])
  })

  describe('Whitelist & Free Claim Tests', () => {
    describe('Controlling List', () => {
      beforeEach(async () => {
        expect(await dist.whitelist(wlMember1.address)).to.be.equal(0)
        expect(await dist.whitelist(wlMember2.address)).to.be.equal(0)
      })

      it('adds spots to whiteliste', async () => {
        await dist.updateSpots([
          {
            position: wlMember1.address,
            whitelistContingent: WL_M1_CONTINGENT,
            freeMintContingent: 0
          },
          {
            position: wlMember2.address,
            whitelistContingent: WL_M2_CONTINGENT,
            freeMintContingent: 0
          }
        ])

        const wl1CountAft = await dist.whitelist(wlMember1.address)
        const wl2CountAft = await dist.whitelist(wlMember2.address)

        expect(wl1CountAft.eq(WL_M1_CONTINGENT)).to.be.true
        expect(wl2CountAft.eq(WL_M2_CONTINGENT)).to.be.true
      })

      it('adds 600 spots to whiteliste', async () => {
        let longListOfAddresses = []

        // This seems to hit the gas limit in tests
        for (let i = 0; i < 600; i++) {
          const address = '0x' + i.toString().padStart(40, '0')
          longListOfAddresses.push({
            position: address,
            whitelistContingent: 2,
            freeMintContingent: 0
          })
        }

        const tx = await dist.updateSpots(longListOfAddresses)
        // const recipe = await tx.wait()
        // console.log(recipe)

        expect(
          await dist.whitelist('0x0000000000000000000000000000000000000000')
        ).to.eq(2)
        expect(
          await dist.whitelist('0x0000000000000000000000000000000000000599')
        ).to.eq(2)
        expect(
          await dist.whitelist('0x0000000000000000000000000000000000000600')
        ).to.eq(0)
      })

      it('removes spots from whiteliste', async () => {
        await dist.updateSpots([
          {
            position: wlMember1.address,
            whitelistContingent: WL_M1_CONTINGENT,
            freeMintContingent: 0
          },
          {
            position: wlMember2.address,
            whitelistContingent: WL_M2_CONTINGENT,
            freeMintContingent: 0
          }
        ])

        expect(await dist.whitelist(wlMember1.address)).to.be.equal(
          WL_M1_CONTINGENT
        )
        expect(await dist.whitelist(wlMember2.address)).to.be.equal(
          WL_M2_CONTINGENT
        )

        await dist.updateSpots([
          {
            position: wlMember1.address,
            whitelistContingent: 0,
            freeMintContingent: 0
          }
        ])

        expect(await dist.whitelist(wlMember1.address)).to.be.equal(0)
        expect(await dist.whitelist(wlMember2.address)).to.be.equal(
          WL_M2_CONTINGENT
        )
      })

      it('reverts update spots without DEFAULT_ADMIN_ROLE', async () => {
        await expect(
          dist.connect(noAccess).updateSpots([
            {
              position: wlMember1.address,
              whitelistContingent: WL_M1_CONTINGENT,
              freeMintContingent: 0
            }
          ])
        ).to.be.reverted
      })

      it('adds freeMint Contingent with updateSpot', async () => {
        await dist.updateSpots([
          {
            position: wlMember1.address,
            whitelistContingent: 0,
            freeMintContingent: FM_M1_CONTINGENT
          },
          {
            position: wlMember2.address,
            whitelistContingent: 0,
            freeMintContingent: FM_M2_CONTINGENT
          }
        ])

        const fm1Count = await dist.freeMint(wlMember1.address)
        const fm2Count = await dist.freeMint(wlMember2.address)

        expect(fm1Count.eq(FM_M1_CONTINGENT)).to.be.true
        expect(fm2Count.eq(FM_M2_CONTINGENT)).to.be.true
      })

      it('forces whitelist spot on adding free claim without whitelistContingent', async () => {
        it('adds freeMint Contingent with updateSpot', async () => {
          await dist.updateSpots([
            {
              position: wlMember1.address,
              whitelistContingent: 0,
              freeMintContingent: FM_M1_CONTINGENT
            },
            {
              position: wlMember2.address,
              whitelistContingent: 0,
              freeMintContingent: FM_M2_CONTINGENT
            }
          ])

          const fm1Count = await dist.freeMint(wlMember1.address)
          const fm2Count = await dist.freeMint(wlMember2.address)
          const wl1Count = await dist.whitelist(wlMember1.address)
          const wl2Count = await dist.whitelist(wlMember2.address)

          expect(fm1Count.eq(FM_M1_CONTINGENT)).to.be.true
          expect(fm2Count.eq(FM_M2_CONTINGENT)).to.be.true
          expect(wl1Count.eq(FM_M1_CONTINGENT)).to.be.true
          expect(wl2Count.eq(FM_M2_CONTINGENT)).to.be.true
        })
      })
    })

    describe('whitelisted', () => {
      beforeEach(async () => {
        await dist.updateSpots([
          {
            position: wlMember1.address,
            whitelistContingent: WL_M1_CONTINGENT,
            freeMintContingent: 0
          },
          {
            position: wlMember2.address,
            whitelistContingent: WL_M2_CONTINGENT,
            freeMintContingent: FM_M2_CONTINGENT
          }
        ])
      })

      it('reverts mint before whitelist sale', async () => {
        await expect(
          dist.connect(wlMember1).mintNewNFTs(1, { value: ITEM_PRICE })
        ).to.be.reverted
      })

      it('reverts claim free mint before whitelist sale', async () => {
        await expect(dist.connect(wlMember1).claimFreeMint()).to.be.reverted
      })

      it('mints in whitelist sale', async () => {
        ethers.provider.send('evm_increaseTime', [60 * 60 * 24])

        await dist.connect(wlMember1).mintNewNFTs(1, { value: ITEM_PRICE })
      })

      it('reverts whitelist mint if free mint is not claimed', async () => {
        await expect(
          dist.connect(wlMember2).mintNewNFTs(1, { value: ITEM_PRICE })
        ).to.be.reverted
      })

      it('mints whitelist after free mint is claimed', async () => {
        expect(await dist.freeMint(wlMember2.address)).to.be.equal(
          FM_M2_CONTINGENT
        )

        await expect(
          dist.connect(wlMember2).mintNewNFTs(1, { value: ITEM_PRICE })
        ).to.be.reverted

        await dist.connect(wlMember2).claimFreeMint()
        expect(await dist.freeMint(wlMember2.address)).to.be.equal(0)

        dist.connect(wlMember2).mintNewNFTs(1, { value: ITEM_PRICE })
      })

      it('mints max contingent per spot', async () => {
        await dist.connect(wlMember1).mintNewNFTs(WL_M1_CONTINGENT, {
          value: ITEM_PRICE.mul(WL_M1_CONTINGENT)
        })

        expect(await nft.balanceOf(wlMember1.address)).to.be.equal(
          WL_M1_CONTINGENT
        )
      })

      it('reverts on minting above contingent in single TX', async () => {
        await expect(
          dist.connect(wlMember1).mintNewNFTs(WL_M1_CONTINGENT.add(1), {
            value: ITEM_PRICE.mul(WL_M1_CONTINGENT).add(1)
          })
        ).to.be.reverted
      })

      it('reverts on minting above contingent in multiple TX', async () => {
        await dist.connect(wlMember1).mintNewNFTs(1, {
          value: ITEM_PRICE
        })

        expect(await nft.balanceOf(wlMember1.address)).to.be.equal(1)

        await expect(
          dist.connect(wlMember1).mintNewNFTs(WL_M1_CONTINGENT, {
            value: ITEM_PRICE.mul(WL_M1_CONTINGENT)
          })
        ).to.be.reverted
      })

      it('reduces contingent of spot after mint', async () => {
        const quantity = 2
        const wlBef = await dist.whitelist(wlMember1.address)
        await dist
          .connect(wlMember1)
          .mintNewNFTs(quantity, { value: ITEM_PRICE.mul(quantity) })
        const wlAft = await dist.whitelist(wlMember1.address)

        expect(wlBef.sub(quantity).eq(wlAft)).to.be.true
      })
    })

    describe('Free Mint', () => {
      beforeEach(async () => {
        await dist.updateSpots([
          {
            position: wlMember1.address,
            whitelistContingent: 0,
            freeMintContingent: FM_M1_CONTINGENT
          },
          {
            position: wlMember2.address,
            whitelistContingent: 0,
            freeMintContingent: FM_M2_CONTINGENT
          }
        ])

        expect(await dist.whitelist(wlMember1.address)).to.be.eq(
          FM_M1_CONTINGENT
        )
        expect(await dist.whitelist(wlMember2.address)).to.be.eq(
          FM_M2_CONTINGENT
        )
        expect(await dist.freeMint(wlMember1.address)).to.be.eq(
          FM_M1_CONTINGENT
        )
        expect(await dist.freeMint(wlMember2.address)).to.be.eq(
          FM_M2_CONTINGENT
        )
      })

      it('claims free mint', async () => {
        const balanceBef = await nft.balanceOf(wlMember1.address)
        await dist.connect(wlMember1).claimFreeMint()
        const balanceAft = await nft.balanceOf(wlMember1.address)

        expect(balanceAft).to.be.eq(balanceBef.add(FM_M1_CONTINGENT))
      })

      it('can only claim once', async () => {
        await dist.connect(wlMember1).claimFreeMint()
        expect(await dist.freeMint(wlMember1.address)).to.be.eq(0)
        await expect(dist.connect(wlMember1).claimFreeMint()).to.be.reverted
      })

      it('claims correct amount', async () => {
        const balanceBef1 = await nft.balanceOf(wlMember1.address)
        const balanceBef2 = await nft.balanceOf(wlMember2.address)

        await dist.connect(wlMember1).claimFreeMint()
        await dist.connect(wlMember2).claimFreeMint()

        const balanceAft1 = await nft.balanceOf(wlMember1.address)
        const balanceAft2 = await nft.balanceOf(wlMember2.address)

        expect(balanceAft1).to.be.eq(balanceBef1.add(FM_M1_CONTINGENT))
        expect(balanceAft2).to.be.eq(balanceBef2.add(FM_M2_CONTINGENT))
      })

      it('reduces whitelist contingent when claiming free mint', async () => {
        expect(await dist.whitelist(wlMember1.address)).to.be.eq(
          FM_M1_CONTINGENT
        )
        await dist.connect(wlMember1).claimFreeMint()
        expect(await dist.whitelist(wlMember1.address)).to.be.eq(0)
      })

      it('cannot claim if no free mint is available', async () => {
        await expect(dist.connect(noAccess).claimFreeMint()).to.be.reverted
      })
    })

    describe('not whitelisted', () => {
      it('reverts mint before public sale', async () => {
        await expect(
          dist.connect(publicSale1).mintNewNFTs(1, { value: ITEM_PRICE })
        ).to.be.reverted
      })

      it('mints on public sale', async () => {
        ethers.provider.send('evm_increaseTime', [60 * 60 * 24])

        await dist.connect(publicSale1).mintNewNFTs(1, {
          value: ITEM_PRICE
        })

        await dist.connect(wlMember1).mintNewNFTs(1, {
          value: ITEM_PRICE.mul(1)
        })

        expect(await nft.balanceOf(publicSale1.address)).to.be.equal(1)
        expect(await nft.balanceOf(wlMember1.address)).to.be.equal(1)
      })
    })
  })

  describe('Mint Tests', () => {
    it('mints single NFT to buyer', async () => {
      expect(await nft.balanceOf(buyer.address)).to.equal(0)

      await dist.connect(buyer).mintNewNFTs(1, { value: ITEM_PRICE })

      expect(await nft.balanceOf(buyer.address)).to.equal(1)
    })

    it('mints multiple NFTs to buyer', async () => {
      const quantity = 5

      expect(await nft.balanceOf(buyer.address)).to.equal(0)

      await dist
        .connect(buyer)
        .mintNewNFTs(quantity, { value: ITEM_PRICE.mul(quantity) })

      expect(await nft.balanceOf(buyer.address)).to.equal(quantity)
    })

    it('reverts trying to mint above MAX_ISSUANCE_PER_TX', async () => {
      const quantity = MAX_ISSUANCE_PER_TX + 1

      expect(await ethers.provider.getBalance(buyer.address)).to.be.gt(
        ITEM_PRICE.mul(quantity)
      )

      16800000000000000000
      15000000000000000000

      await expect(
        dist
          .connect(buyer)
          .mintNewNFTs(quantity, { value: ITEM_PRICE.mul(quantity) })
      ).to.be.reverted
    })

    it('reverts if payment is too low on single', async () => {
      await expect(
        dist.connect(buyer).mintNewNFTs(1, { value: ITEM_PRICE.div(2) })
      ).to.be.reverted
    })

    it('reverts if payment is too low on multiple', async () => {
      await expect(
        dist.connect(buyer).mintNewNFTs(5, { value: ITEM_PRICE.mul(4) })
      ).to.be.reverted
    })

    it('refunds correct amount on single', async () => {
      expect(await ethers.provider.getBalance(buyer.address)).to.be.equal(
        BUYER_INITIAL_BALANCE
      )

      await dist.connect(buyer).mintNewNFTs(1, {
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
      expect(await ethers.provider.getBalance(buyer.address)).to.be.equal(
        BUYER_INITIAL_BALANCE
      )

      await dist.connect(buyer).mintNewNFTs(quantity, {
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

    it('reverts mint on sell out', async () => {
      await dist
        .connect(deployer)
        .issueContingent(deployer.address, COLLECTION_SIZE)

      await expect(
        dist.connect(buyer).mintNewNFTs(1, {
          value: ITEM_PRICE
        })
      ).to.be.reverted
    })

    it('issues contingent', async () => {
      expect(await nft.balanceOf(deployer.address)).to.equal(0)
      await dist.connect(deployer).issueContingent(deployer.address, CONTINGENT)
      expect(await nft.balanceOf(deployer.address)).to.equal(CONTINGENT)
    })

    it('reverts contingent issuance by non ISSUER_ROLE', async () => {
      await expect(dist.connect(noAccess).issueContingent(buyer.address, 1)).to
        .be.reverted
    })

    it('reverts issuance contingent on sold out', async () => {
      dist.issueContingent(buyer.address, COLLECTION_SIZE)

      await expect(dist.issueContingent(buyer.address, 1)).to.be.reverted
    })
  })

  describe('Release Tests', () => {
    it('adjusts price accordingly', async () => {
      expect(await dist.getCurrentItemPrice()).to.equal(ITEM_PRICE)

      const newPrice = utils.parseEther('0.2')
      await dist.adjustPrice(newPrice)

      expect(await dist.getCurrentItemPrice()).to.equal(newPrice)
    })

    it('reverts on adjusting price to 0', async () => {
      await expect(dist.adjustPrice(0)).to.be.reverted
    })

    it('reverts price adjustment by non ISSUER_ROLE', async () => {
      await expect(dist.connect(noAccess).adjustPrice(utils.parseEther('1'))).to
        .be.reverted
    })

    it('has correct release dates', async () => {
      expect(await dist.releaseDate()).to.be.equal(RELEASE_DATE_UTC)
      expect(await dist.wlReleaseDate()).to.be.equal(WL_RELEASE_DATE_UTC)
    })

    it('updates release dates correctly', async () => {
      const newReleaseDate = moment.utc('2032-02-11T09:00:00').unix()
      const newWlReleaseDate = moment.utc('2032-02-11T09:00:00').unix()

      await dist.updateReleaseDates(newReleaseDate, newWlReleaseDate)

      expect(await dist.releaseDate()).to.be.equal(newReleaseDate)
      expect(await dist.wlReleaseDate()).to.be.equal(newWlReleaseDate)
    })

    it('reverts update release dates without DEFAULT_ADMIN_ROLE', async () => {
      const newReleaseDate = moment.utc('2032-02-11T09:00:00').unix()
      const newWlReleaseDate = moment.utc('2032-02-11T09:00:00').unix()

      await expect(
        dist
          .connect(noAccess)
          .updateReleaseDates(newReleaseDate, newWlReleaseDate)
      ).to.be.reverted
    })
  })

  describe('Pause Tests', () => {
    it('pauses with PAUSER_ROLE', async () => {
      await dist.connect(deployer).togglePause()
      expect(await dist.paused()).to.equal(true)
    })

    it('unpauses with PAUSER_ROLE', async () => {
      await dist.connect(deployer).togglePause()
      expect(await dist.paused()).to.equal(true)

      await dist.connect(deployer).togglePause()
      expect(await dist.paused()).to.equal(false)
    })

    it('reverts on pause toggle without PAUSER_ROLE', async () => {
      await expect(dist.connect(noAccess).togglePause()).to.be.reverted
    })

    describe('when paused', () => {
      beforeEach(async () => {
        await dist.connect(deployer).togglePause()
        expect(await dist.paused()).to.equal(true)
      })

      it('reverts on mint when paused', async () => {
        await expect(dist.connect(buyer).mintNewNFTs(1, { value: ITEM_PRICE }))
          .to.be.reverted
      })

      it('reverts on adjust price when paused', async () => {
        await expect(dist.adjustPrice(ITEM_PRICE)).to.be.reverted
      })

      it('reverts on contingent issuance when paused', async () => {
        await expect(dist.issueContingent(buyer.address, 1)).to.be.reverted
      })

      it('reverts on updateLiquidityCollector when paused', async () => {
        await expect(dist.updateLiquidityCollector(buyer.address)).to.be
          .reverted
      })
    })
  })

  describe('AccessControl Tests', () => {
    it('distributor has MINTER_ROLE on collection', async () => {
      expect(await nft.hasRole(MINTER_ROLE, dist.address))
    })

    it('deployer has all roles on distributor', async () => {
      expect(await dist.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.be
        .true
      expect(await dist.hasRole(ISSUER_ROLE, deployer.address)).to.be.true
      expect(await dist.hasRole(PAUSER_ROLE, deployer.address)).to.be.true
    })

    it('grants PAUSER_ROLE', async () => {
      expect(await dist.hasRole(PAUSER_ROLE, noAccess.address)).to.be.false
      await dist.grantRole(PAUSER_ROLE, noAccess.address)
      expect(await dist.hasRole(PAUSER_ROLE, noAccess.address)).to.be.true
    })

    it('grants ISSUER_ROLE', async () => {
      expect(await dist.hasRole(ISSUER_ROLE, noAccess.address)).to.be.false
      await dist.grantRole(ISSUER_ROLE, noAccess.address)
      expect(await dist.hasRole(ISSUER_ROLE, noAccess.address)).to.be.true
    })

    it('revokes ISSUER_ROLE', async () => {
      expect(await dist.hasRole(ISSUER_ROLE, noAccess.address)).to.be.false
      await dist.grantRole(ISSUER_ROLE, noAccess.address)
      await dist.revokeRole(ISSUER_ROLE, noAccess.address)
      expect(await dist.hasRole(ISSUER_ROLE, noAccess.address)).to.be.false
    })

    it('revokes PAUSER_ROLE', async () => {
      expect(await dist.hasRole(PAUSER_ROLE, noAccess.address)).to.be.false
      await dist.grantRole(PAUSER_ROLE, noAccess.address)
      await dist.revokeRole(PAUSER_ROLE, noAccess.address)
      expect(await dist.hasRole(PAUSER_ROLE, noAccess.address)).to.be.false
    })
  })
})
