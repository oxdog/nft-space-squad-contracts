import { ethers, network } from 'hardhat'
import moment from 'moment'
const { utils } = ethers

const provider = new ethers.providers.AlchemyProvider(
  network.name,
  network.name === 'mainnet'
    ? process.env.ALCHEMY_API_MAINNET
    : process.env.ALCHEMY_DEV_API_RINKEBY
)

export const deployer = new ethers.Wallet(
  process.env.DEV_WALLET as string,
  provider
)

// ! HOW TO
// * 1. add images & meta to resources
// * 2. npm run upload
// * 3. npm run provenance
// * 4. npm run prod_deployPhase0
// * 5. npm run contingent

// * 4. npm run prod_deployPhase1

// * 6. npm run reveal

// * 7. npm run uploadStatic
// * 8. npm run prod_deployPhase2

// ! Pre-Deploy Phase 0 checklist
// ?  Upload related
// *  [ ] add provenance records to website

// ?  Contract related
// *  [ ] deploying with right wallet
// *  [x] correct Gnosis Safe
// *  [x] correct DMSS-NFT Base URI in deploy script
// *  [ ] correct ReleaseDates
// *  [ ] correct provenance hash
// *  [ ] opensea collection publisher is owner
// *  [ ] correct EMC-NFT Base URI in deploy script
// *  [ ] correct EMC-ReleaseDates

// ! Post-Deploy Phase 0 checklist
// ?  Contract related
// *  [ ] execute verify commands
// *  [ ] issue contingent
// *  [ ] list on OS & add link for opeansea to app.
// *  [ ] royalties set to 3%
// *  [ ] addresses updated in this config file

// ? Web related
// *  [ ] Changed Contract addresses in .env
// *  [ ] Vars & Naming correspond to deployed network NEXT_PUBLIC_DEPLOYED_NETWORK (e.g. "Please change to 'Ethereum Mainnet'")
// *  [ ] Connectors.ts supported networks correspond to deployed network (e.g. enable mainnet with id 1)
// *  [ ] Update abi json in web
// *  [ ] Change OpeanSea collection url in .env
// *  [X] Correct dmss price in .env
// *  [ ] Correct Release Date in .env (keep in mind UTC is your local-1h)
// *  [ ] Set heroku to prod git:remote
// *  [ ] Push to heroku for re-build

// ?  Discord Bot related
// *  [ ] heroku-bot env to DMSS-NFT address

// ! Pre-Deploy Phase 1 checklist
// ?  Contract related
// *  [ ] revokeRole AUTH_MINTER from presale

// ! Post-Deploy Phase1 checklist
// ?  Contract related
// *  [ ] execute verify commands
// *  [ ] addresses updated in this config file

// ? Web related
// *  [ ] 'Mint a new NFT ' button /mint link
// *  [ ] Update Header
// *  [ ] Changed Contract addresses in .env
// *  [ ] Correct Release Date in .env (keep in mind UTC is your local-1h)
// *  [ ] Push to heroku for re-build

// ! Pre-Release after Phase 1
// *  [ ] update RootHash for whitelist
// *  [ ] update FreeMintContingent

// ! Pre-Deploy Phase 2 checklist
// *  [ ] correct NFT_ADDRESS, DISTRIBUTOR_ADDRESS in this file
// *  [ ] correct pill price
// *  [ ] correct total_supply (keep claimReserve (pcCount) in mind)
// *  [ ] correct tokenURI for pill
// *  [ ] add pill as enlargement role for nft

// ! Post-Deploy Phase 2 checklist
// ? Web related
// *  [ ] add pharmacy & pill in heroku .env
// *  [ ] Correct pill price in .env
// *  [ ] Push to heroku for re-build

// ?  Contract related
// *  [ ] execute verfiy commands
// *  [ ] issues contingent
// *  [ ] list on OS
// *  [ ] royalties set to 3%
// *  [ ] unpause pharmacy (when time is ready; updates claimReserve on releaseEmergencySwitch())

// ! CONFIG
export const PROJECT_NAME = 'NFT  Space Squad'
export const SINGLE_NAME = 'NFT '
export const REST_OF_OPENSEA_DESCRIPTION =
  'is a member of the NFT  Space Squad. Having found primordial wall drawings and artefacts of an ancient civilization on their planet, the lab-bred penises of the space squad are on a noble space mission to find traces of a gender of their race lost to time.'

export const NFT_NAME = 'NFT  Space Squad'
export const NFT_SYMBOL = 'DMSS'
export const NFT_PRICE = utils.parseEther('0.08')
export const NFT_DMSS_PROVENANCE =
  '49718870dbcb8b2f60ba1545b5bec4074ab0e5b37ca2e256634090033f722779'
export const NFT_BASE_URI =
  'ipfs://QmX3RQAMfYK4yiQjVtVciDVLfgRPDo3VaYoqUnVjx6WXB4/' //e.g. 'ipfs://QmXGfLyRUzumFL3ytMX4MgyWBLQ4rr1kmzrQGe8mwoDAXs/'
export const NFT_UNREVEALED_URI =
  'ipfs://Qmb32pGsxEjshnLiBAfBt3McViWgGJ2tQ4ijrjHWyeNdHT/unrevealed.json'

export const EMC_NFT_NAME = 'company Membership Card'
export const EMC_NFT_SYMBOL = 'EMC'
export const EMC_NFT_BASE_URI = 'ipfs://tbd/'

export const ROYALTY_BASISPOINTS = 300 // 3%; for NFT & Pills
export const GNOSIS_SAFE = '0x6EA403B0cf1A62e2bF04972a304870F60Cb1dCb6'

export const PRESALE_SIZE = 500
export const COLLECTION_SIZE = 10000
export const CONTINGENT = 50
export const CONTINGENT_RECEIVER = GNOSIS_SAFE
export const INITIAL_FREE_MINT_CONTINGENT = 150

export const PRE_RELEASE_DATE_UTC = moment.utc('2022-05-21T19:00:00').unix()
export const RELEASE_DATE_UTC = moment.utc('2022-06-10T19:00:00').unix()
export const WL_RELEASE_DATE_UTC = moment.utc('2022-06-11T19:00:00').unix()
export const PILL_QUALIFY_DEADLINE_UTC = moment
  .utc('2022-07-06T19:00:00')
  .unix()
export const PILL_CLAIM_DEALDINE_UTC = moment.utc('2022-05-06T19:00:00').unix()

// ! Config Pill & Pharamcy Deploy
export const PILL_NAME = 'NFT Enlargening Pill'
export const PILL_SYMBOL = 'DEP'
export const PILL_METADATA =
  'ipfs://QmRUUuDa9dyWThRpJazVfYySaJ3htNqXt6aR6LxXmMhfqP/dep.json'
export const PILL_PRICE = utils.parseEther('0.01')
export const PILL_SUPPLY = 5000

// ! Config Post Deploy
export const NFT_ADDRESS = '0xC5c5E87647122AA83FbF4788295899E71C12eBdD'
export const PRESALE_ADDRESS = '0x0B27b2dd7799E8eCBFd428d75493a3e7d0Af2018'
export const company_MEMBERSHIP_CARD_ADDRESS =
  '0xeee6Fa935880B8F0C818C43dB4D8e69318Ab3b96'
export const DISTRIBUTOR_ADDRESS = ''
export const PILL_ADDRESS = ''
export const PHARMACY_ADDRESS = ''
