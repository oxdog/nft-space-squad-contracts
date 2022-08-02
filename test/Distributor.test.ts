import { ethers } from 'hardhat'
import chai from '../scripts/config/chaisetup'
import { NFT } from '../types/typechain/NFT'
import { Distributor } from '../types/typechain/Distributor'
import moment from 'moment'
import { BigNumber } from 'ethers'
import { loadDataFromFile } from '../utils/files/loadDataFromFile'
import MerkleTree from 'merkletreejs'
import keccak256 from 'keccak256'
import { hashToken } from '../utils/hashToken'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Whitelist } from '../types/Whitelist'

const { expect } = chai
const { utils } = ethers

describe('Distributor', () => {
  const BUYER_INITIAL_BALANCE = ethers.utils.parseEther('18')
  const ONE_MONTH_IN_SECONDS = 60 * 60 * 24 * 31 // smallest unit is seconds

  const MINTER_ROLE = utils.keccak256(utils.toUtf8Bytes('MINTER_ROLE'))

  const NFT_NAME = 'NFT'
  const NFT_SYMBOL = 'DMC'
  const BASE_URI = 'ipfs://abcdefg/'
  const UNREVEALED_URI = 'ipfs://unrevealed'
  const ITEM_PRICE = ethers.utils.parseEther('0.8')
  const DEFAULT_ROYALTY = 300 // 3%
  const RELEASE_DATE_UTC = moment.utc().add(2, 'day').unix()
  const WL_RELEASE_DATE_UTC = moment.utc().add(1, 'day').unix()
  const WL_M1_CONTINGENT = 2
  const FM_M1_CONTINGENT = 0
  const WL_M2_CONTINGENT = 2
  const FM_M2_CONTINGENT = 2
  const WL_M3_CONTINGENT = 0
  const FM_M3_CONTINGENT = 3

  const COLLECTION_SIZE = 20
  const FREE_MINT_CONTINGENT = 5
  const MAX_ISSUANCE_PER_TX = 20

  let deployer: SignerWithAddress
  let buyer: SignerWithAddress
  let noAccess: SignerWithAddress
  let royRec: SignerWithAddress
  let member1: SignerWithAddress
  let member2: SignerWithAddress
  let member3: SignerWithAddress
  let member4: SignerWithAddress
  let publicSaleMember: SignerWithAddress

  let nft: NFT
  let dist: Distributor

  let whitelist: Whitelist
  let merkleTree: MerkleTree

  beforeEach(async () => {
    ;[
      deployer,
      buyer,
      noAccess,
      royRec,
      member1,
      member2,
      member3,
      member4,
      publicSaleMember
    ] = await ethers.getSigners()

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

    // * Setup Whitelist
    whitelist = loadDataFromFile('whitelist.json')
    whitelist[member1.address] = {
      whitelist: WL_M1_CONTINGENT,
      freeMint: FM_M1_CONTINGENT
    }
    whitelist[member2.address] = {
      whitelist: WL_M2_CONTINGENT,
      freeMint: FM_M2_CONTINGENT
    }
    whitelist[member3.address] = {
      whitelist: WL_M3_CONTINGENT,
      freeMint: FM_M3_CONTINGENT
    }
    whitelist[member4.address] = {
      whitelist: 0,
      freeMint: COLLECTION_SIZE
    }

    merkleTree = new MerkleTree(
      Object.entries(whitelist).map((entry) =>
        hashToken(entry[0], entry[1].whitelist, entry[1].freeMint)
      ),
      keccak256,
      { sortPairs: true }
    )

    await dist.setRootHash(merkleTree.getHexRoot())
    await dist.updateFreeMintContingent(FREE_MINT_CONTINGENT)

    expect(await dist.freeMintContingent()).to.be.equal(FREE_MINT_CONTINGENT)
  })

  describe('Whitelist & Free Claim Tests', () => {
    describe('Controlling List', () => {
      it('sets root hash', async () => {
        expect(await dist.rootHash()).to.not.be.equal('')
      })

      it('reverts setRootHash without DEFAULT_ADMIN_ROLE', async () => {
        await expect(
          dist.connect(noAccess).setRootHash(merkleTree.getHexRoot())
        ).to.be.reverted
      })
    })

    describe('Before Whitelist Sale', () => {
      it('reverts mint before whitelist sale', async () => {
        await expect(
          dist
            .connect(member1)
            .mintNewNFTs(
              1,
              { whitelist: WL_M1_CONTINGENT, freeMint: FM_M1_CONTINGENT },
              merkleTree.getHexProof(
                hashToken(member1.address, WL_M1_CONTINGENT, FM_M1_CONTINGENT)
              ),
              { value: ITEM_PRICE }
            )
        ).to.be.reverted
      })

      it('reverts claim free mint before whitelist sale', async () => {
        await expect(
          dist
            .connect(member2)
            .claimFreeMint(
              2,
              { whitelist: WL_M2_CONTINGENT, freeMint: FM_M2_CONTINGENT },
              merkleTree.getHexProof(
                hashToken(member2.address, WL_M2_CONTINGENT, FM_M2_CONTINGENT)
              )
            )
        ).to.be.reverted
      })
    })

    describe('whitelisted', () => {
      before(() => {
        ethers.provider.send('evm_increaseTime', [60 * 60 * 24])
      })

      it('mints in whitelist sale', async () => {
        await dist
          .connect(member1)
          .mintNewNFTs(
            1,
            { whitelist: WL_M1_CONTINGENT, freeMint: FM_M1_CONTINGENT },
            merkleTree.getHexProof(
              hashToken(member1.address, WL_M1_CONTINGENT, FM_M1_CONTINGENT)
            ),
            { value: ITEM_PRICE }
          )
      })

      it('mints max contingent per spot', async () => {
        await dist
          .connect(member1)
          .mintNewNFTs(
            WL_M1_CONTINGENT,
            { whitelist: WL_M1_CONTINGENT, freeMint: FM_M1_CONTINGENT },
            merkleTree.getHexProof(
              hashToken(member1.address, WL_M1_CONTINGENT, FM_M1_CONTINGENT)
            ),
            { value: ITEM_PRICE.mul(WL_M1_CONTINGENT) }
          )

        await dist
          .connect(member2)
          .mintNewNFTs(
            WL_M2_CONTINGENT,
            { whitelist: WL_M2_CONTINGENT, freeMint: FM_M2_CONTINGENT },
            merkleTree.getHexProof(
              hashToken(member2.address, WL_M2_CONTINGENT, FM_M2_CONTINGENT)
            ),
            { value: ITEM_PRICE.mul(WL_M2_CONTINGENT) }
          )

        expect(await nft.balanceOf(member1.address)).to.be.equal(
          WL_M1_CONTINGENT
        )

        expect(await nft.balanceOf(member2.address)).to.be.equal(
          WL_M2_CONTINGENT
        )
      })

      it('reverts on minting above contingent in single TX', async () => {
        await expect(
          dist
            .connect(member1)
            .mintNewNFTs(
              WL_M1_CONTINGENT + 1,
              { whitelist: WL_M1_CONTINGENT, freeMint: FM_M1_CONTINGENT },
              merkleTree.getHexProof(
                hashToken(member1.address, WL_M1_CONTINGENT, FM_M1_CONTINGENT)
              ),
              { value: ITEM_PRICE.mul(WL_M1_CONTINGENT + 1) }
            )
        ).to.be.reverted

        await expect(
          dist
            .connect(member2)
            .mintNewNFTs(
              WL_M2_CONTINGENT + 1,
              { whitelist: WL_M2_CONTINGENT, freeMint: FM_M2_CONTINGENT },
              merkleTree.getHexProof(
                hashToken(member2.address, WL_M2_CONTINGENT, FM_M2_CONTINGENT)
              ),
              { value: ITEM_PRICE.mul(WL_M2_CONTINGENT + 1) }
            )
        ).to.be.reverted
      })

      it('reverts if no whitelist is available', async () => {
        await expect(
          dist
            .connect(member3)
            .mintNewNFTs(
              1,
              { whitelist: WL_M3_CONTINGENT, freeMint: FM_M3_CONTINGENT },
              merkleTree.getHexProof(
                hashToken(member3.address, WL_M3_CONTINGENT, FM_M3_CONTINGENT)
              ),
              { value: ITEM_PRICE }
            )
        ).to.be.reverted
      })

      it('reverts on minting above contingent in multiple TX', async () => {
        await dist
          .connect(member1)
          .mintNewNFTs(
            WL_M1_CONTINGENT / 2,
            { whitelist: WL_M1_CONTINGENT, freeMint: FM_M1_CONTINGENT },
            merkleTree.getHexProof(
              hashToken(member1.address, WL_M1_CONTINGENT, FM_M1_CONTINGENT)
            ),
            { value: ITEM_PRICE.mul(WL_M1_CONTINGENT / 2) }
          )

        await expect(
          dist
            .connect(member1)
            .mintNewNFTs(
              WL_M1_CONTINGENT / 2 + 1,
              { whitelist: WL_M1_CONTINGENT, freeMint: FM_M1_CONTINGENT },
              merkleTree.getHexProof(
                hashToken(member1.address, WL_M1_CONTINGENT, FM_M1_CONTINGENT)
              ),
              { value: ITEM_PRICE.mul(WL_M1_CONTINGENT / 2 + 1) }
            )
        ).to.be.reverted

        expect(await nft.balanceOf(member1.address)).to.be.equal(
          WL_M1_CONTINGENT / 2
        )
      })

      it('registers mint quantity after mint', async () => {
        const quantity = 1
        const wlBef = await dist.whitelistClaimed(member1.address)

        await dist
          .connect(member1)
          .mintNewNFTs(
            quantity,
            { whitelist: WL_M1_CONTINGENT, freeMint: FM_M1_CONTINGENT },
            merkleTree.getHexProof(
              hashToken(member1.address, WL_M1_CONTINGENT, FM_M1_CONTINGENT)
            ),
            { value: ITEM_PRICE }
          )

        const wlAft = await dist.whitelistClaimed(member1.address)

        expect(wlBef.eq(0)).to.be.true
        expect(wlAft.eq(quantity)).to.be.true
      })

      it('can not mint 0', async () => {
        expect(await nft.balanceOf(member1.address)).to.be.equal(0)

        await dist
          .connect(member1)
          .mintNewNFTs(
            0,
            { whitelist: WL_M1_CONTINGENT, freeMint: FM_M1_CONTINGENT },
            merkleTree.getHexProof(
              hashToken(member1.address, WL_M1_CONTINGENT, FM_M1_CONTINGENT)
            ),
            { value: ITEM_PRICE }
          )

        expect(await nft.balanceOf(member1.address)).to.be.equal(0)
      })

      it('reverts mint for non-whitelist before public sale', async () => {
        await expect(
          dist
            .connect(publicSaleMember)
            .mintNewNFTs(1, { whitelist: 0, freeMint: 0 }, [], {
              value: ITEM_PRICE
            })
        ).to.be.reverted
      })
    })

    describe('Free Mint', () => {
      it('claims free mint', async () => {
        const balanceBef = await nft.balanceOf(member2.address)
        await dist
          .connect(member2)
          .claimFreeMint(
            FM_M2_CONTINGENT,
            { whitelist: WL_M2_CONTINGENT, freeMint: FM_M2_CONTINGENT },
            merkleTree.getHexProof(
              hashToken(member2.address, WL_M2_CONTINGENT, FM_M2_CONTINGENT)
            )
          )
        const balanceAft = await nft.balanceOf(member2.address)

        expect(balanceAft).to.be.eq(balanceBef.add(FM_M2_CONTINGENT))
      })

      it('can only claim once', async () => {
        await dist
          .connect(member2)
          .claimFreeMint(
            FM_M2_CONTINGENT,
            { whitelist: WL_M2_CONTINGENT, freeMint: FM_M2_CONTINGENT },
            merkleTree.getHexProof(
              hashToken(member2.address, WL_M2_CONTINGENT, FM_M2_CONTINGENT)
            )
          )

        expect(await dist.freeMintClaimed(member2.address)).to.be.eq(
          FM_M2_CONTINGENT
        )

        await expect(
          dist
            .connect(member2)
            .claimFreeMint(
              FM_M2_CONTINGENT,
              { whitelist: WL_M2_CONTINGENT, freeMint: FM_M2_CONTINGENT },
              merkleTree.getHexProof(
                hashToken(member2.address, WL_M2_CONTINGENT, FM_M2_CONTINGENT)
              )
            )
        ).to.be.reverted
      })

      it('reverts claiming above contingent', async () => {
        await expect(
          dist
            .connect(member2)
            .claimFreeMint(
              FM_M2_CONTINGENT + 1,
              { whitelist: WL_M2_CONTINGENT, freeMint: FM_M2_CONTINGENT },
              merkleTree.getHexProof(
                hashToken(member2.address, WL_M2_CONTINGENT, FM_M2_CONTINGENT)
              )
            )
        ).to.be.reverted
      })

      it('claims correct amount', async () => {
        await dist
          .connect(member2)
          .claimFreeMint(
            FM_M2_CONTINGENT,
            { whitelist: WL_M2_CONTINGENT, freeMint: FM_M2_CONTINGENT },
            merkleTree.getHexProof(
              hashToken(member2.address, WL_M2_CONTINGENT, FM_M2_CONTINGENT)
            )
          )

        expect(await nft.balanceOf(member2.address)).to.be.eq(FM_M2_CONTINGENT)
      })

      it('registers claimed freeMint', async () => {
        await dist
          .connect(member2)
          .claimFreeMint(
            FM_M2_CONTINGENT,
            { whitelist: WL_M2_CONTINGENT, freeMint: FM_M2_CONTINGENT },
            merkleTree.getHexProof(
              hashToken(member2.address, WL_M2_CONTINGENT, FM_M2_CONTINGENT)
            )
          )

        expect(await dist.freeMintClaimed(member2.address)).to.be.eq(
          FM_M2_CONTINGENT
        )
      })

      it('claiming 0', async () => {
        expect(await nft.balanceOf(member2.address)).to.be.equal(0)
        await dist
          .connect(member2)
          .claimFreeMint(
            0,
            { whitelist: WL_M2_CONTINGENT, freeMint: FM_M2_CONTINGENT },
            merkleTree.getHexProof(
              hashToken(member2.address, WL_M2_CONTINGENT, FM_M2_CONTINGENT)
            )
          )
        expect(await nft.balanceOf(member2.address)).to.be.equal(0)
      })

      it('reverts claim without freeMint contingent', async () => {
        await expect(
          dist
            .connect(member1)
            .claimFreeMint(
              1,
              { whitelist: WL_M1_CONTINGENT, freeMint: FM_M1_CONTINGENT },
              merkleTree.getHexProof(
                hashToken(member1.address, WL_M1_CONTINGENT, FM_M1_CONTINGENT)
              )
            )
        ).to.be.reverted
      })

      it('reverts claim if sold out', async () => {
        await dist
          .connect(member4)
          .claimFreeMint(
            COLLECTION_SIZE,
            { whitelist: 0, freeMint: COLLECTION_SIZE },
            merkleTree.getHexProof(
              hashToken(member4.address, 0, COLLECTION_SIZE)
            )
          )

        await expect(
          dist
            .connect(member2)
            .claimFreeMint(
              1,
              { whitelist: WL_M2_CONTINGENT, freeMint: FM_M2_CONTINGENT },
              merkleTree.getHexProof(
                hashToken(member2.address, WL_M2_CONTINGENT, FM_M2_CONTINGENT)
              )
            )
        ).to.be.reverted
      })
    })

    describe('public sale', () => {
      before(async () => {
        ethers.provider.send('evm_increaseTime', [60 * 60 * 24])
      })

      beforeEach(async () => {
        ethers.provider.send('evm_increaseTime', [60 * 60 * 24])

        expect(await nft.totalSupply()).to.be.equal(0)
      })

      it('non-whitelisted can mint on public sale', async () => {
        await dist
          .connect(publicSaleMember)
          .mintNewNFTs(3, { whitelist: 0, freeMint: 0 }, [], {
            value: ITEM_PRICE.mul(3)
          })

        expect(await nft.balanceOf(publicSaleMember.address)).to.be.equal(3)
      })

      it('claims freeMint on public sale', async () => {
        await dist
          .connect(member2)
          .claimFreeMint(
            FM_M2_CONTINGENT,
            { whitelist: WL_M2_CONTINGENT, freeMint: FM_M2_CONTINGENT },
            merkleTree.getHexProof(
              hashToken(member2.address, WL_M2_CONTINGENT, FM_M2_CONTINGENT)
            )
          )
      })

      it('reserves free mint before claimDeadline', async () => {
        const MAX_MINT_BEF_CLAIM_DEADLINE =
          COLLECTION_SIZE - FREE_MINT_CONTINGENT

        expect(MAX_MINT_BEF_CLAIM_DEADLINE).to.be.lte(MAX_ISSUANCE_PER_TX)

        await dist
          .connect(publicSaleMember)
          .mintNewNFTs(
            MAX_MINT_BEF_CLAIM_DEADLINE,
            { whitelist: 0, freeMint: 0 },
            [],
            {
              value: ITEM_PRICE.mul(MAX_MINT_BEF_CLAIM_DEADLINE)
            }
          )

        expect(await nft.balanceOf(publicSaleMember.address)).to.be.equal(
          MAX_MINT_BEF_CLAIM_DEADLINE
        )

        await expect(
          dist
            .connect(publicSaleMember)
            .mintNewNFTs(1, { whitelist: 0, freeMint: 0 }, [], {
              value: ITEM_PRICE
            })
        ).to.be.rejectedWith('D: FM Reserve not open')
      })

      it('releases reservation after deadline', async () => {
        ethers.provider.send('evm_increaseTime', [ONE_MONTH_IN_SECONDS])

        expect(MAX_ISSUANCE_PER_TX).to.be.gt(
          COLLECTION_SIZE - FREE_MINT_CONTINGENT
        )

        await dist
          .connect(publicSaleMember)
          .mintNewNFTs(MAX_ISSUANCE_PER_TX, { whitelist: 0, freeMint: 0 }, [], {
            value: ITEM_PRICE.mul(MAX_ISSUANCE_PER_TX)
          })

        expect(await nft.balanceOf(publicSaleMember.address)).to.be.equal(
          MAX_ISSUANCE_PER_TX
        )
      })

      it('reverts claim free mint after deadline passed', async () => {
        await expect(
          dist
            .connect(member2)
            .claimFreeMint(
              FM_M2_CONTINGENT,
              { whitelist: WL_M2_CONTINGENT, freeMint: FM_M2_CONTINGENT },
              merkleTree.getHexProof(
                hashToken(member2.address, WL_M2_CONTINGENT, FM_M2_CONTINGENT)
              )
            )
        ).to.be.revertedWith('D: FM deadline passed')
      })

      it('reverts freeMint without contingent on public sale', async () => {
        await expect(
          dist
            .connect(member1)
            .claimFreeMint(
              1,
              { whitelist: WL_M1_CONTINGENT, freeMint: FM_M1_CONTINGENT },
              merkleTree.getHexProof(
                hashToken(member1.address, WL_M1_CONTINGENT, FM_M1_CONTINGENT)
              )
            )
        ).to.be.reverted
      })
    })
  })

  describe('Mint Tests', () => {
    it('mints single NFT to buyer', async () => {
      expect(await nft.balanceOf(buyer.address)).to.equal(0)

      await dist
        .connect(buyer)
        .mintNewNFTs(1, { whitelist: 0, freeMint: 0 }, [], {
          value: ITEM_PRICE
        })

      expect(await nft.balanceOf(buyer.address)).to.equal(1)
    })

    it('mints multiple NFTs to buyer', async () => {
      const quantity = 5

      expect(await nft.balanceOf(buyer.address)).to.equal(0)

      await dist
        .connect(buyer)
        .mintNewNFTs(quantity, { whitelist: 0, freeMint: 0 }, [], {
          value: ITEM_PRICE.mul(quantity)
        })

      expect(await nft.balanceOf(buyer.address)).to.equal(quantity)
    })

    it('reverts trying to mint above MAX_ISSUANCE_PER_TX', async () => {
      const quantity = MAX_ISSUANCE_PER_TX + 1

      expect(await ethers.provider.getBalance(buyer.address)).to.be.gt(
        ITEM_PRICE.mul(quantity)
      )

      await expect(
        dist
          .connect(buyer)
          .mintNewNFTs(quantity, { whitelist: 0, freeMint: 0 }, [], {
            value: ITEM_PRICE.mul(quantity)
          })
      ).to.be.reverted
    })

    it('reverts if payment is too low on single', async () => {
      await expect(
        dist.connect(buyer).mintNewNFTs(1, { whitelist: 0, freeMint: 0 }, [], {
          value: ITEM_PRICE.div(2)
        })
      ).to.be.reverted
    })

    it('reverts if payment is too low on multiple', async () => {
      await expect(
        dist.connect(buyer).mintNewNFTs(5, { whitelist: 0, freeMint: 0 }, [], {
          value: ITEM_PRICE.mul(4)
        })
      ).to.be.reverted
    })

    it('refunds correct amount on single', async () => {
      expect(await ethers.provider.getBalance(buyer.address)).to.be.equal(
        BUYER_INITIAL_BALANCE
      )

      await dist
        .connect(buyer)
        .mintNewNFTs(1, { whitelist: 0, freeMint: 0 }, [], {
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

      await dist
        .connect(buyer)
        .mintNewNFTs(quantity, { whitelist: 0, freeMint: 0 }, [], {
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
        .connect(buyer)
        .mintNewNFTs(COLLECTION_SIZE, { whitelist: 0, freeMint: 0 }, [], {
          value: ITEM_PRICE.mul(COLLECTION_SIZE)
        })

      await expect(
        dist.connect(buyer).mintNewNFTs(1, { whitelist: 0, freeMint: 0 }, [], {
          value: ITEM_PRICE
        })
      ).to.be.reverted
    })
  })

  describe('Release Tests', () => {
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

    it('set freeMintClaimDeadline 1 month after release Date', async () => {
      expect(await dist.freeMintClaimDeadline()).to.be.equal(
        RELEASE_DATE_UTC + ONE_MONTH_IN_SECONDS
      )
    })

    it('updates freeMintContingent', async () => {
      expect(await dist.freeMintContingent()).to.be.equal(FREE_MINT_CONTINGENT)
      await dist.updateFreeMintContingent(0)
      expect(await dist.freeMintContingent()).to.be.equal(0)
    })

    it('reverts update freeMintContingent without DEFAULT_ADMIN_ROLE', async () => {
      await expect(dist.connect(noAccess).updateFreeMintContingent(0)).to.be
        .reverted
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
        await expect(
          dist
            .connect(member1)
            .mintNewNFTs(
              1,
              { whitelist: WL_M1_CONTINGENT, freeMint: FM_M1_CONTINGENT },
              merkleTree.getHexProof(
                hashToken(member1.address, WL_M1_CONTINGENT, FM_M1_CONTINGENT)
              ),
              { value: ITEM_PRICE }
            )
        ).to.be.reverted
      })
    })
  })

  describe('AccessControl Tests', () => {
    it('distributor has MINTER_ROLE on collection', async () => {
      expect(await nft.hasRole(MINTER_ROLE, dist.address))
    })

    it('deployer is owner', async () => {
      expect(await dist.owner()).to.be.equal(deployer.address)
    })
  })
})
