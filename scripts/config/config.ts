import { ethers, network } from 'hardhat'
import moment from 'moment'
const { utils } = ethers

// ! HOW TO
// * 1. add images & meta to resources
// * 2. npm run upload
// * 3. npm run provenance

// * PRESALE
// * 4. npm run prod_deployPhase0
// * 5. npm run contingent

// * WL & PUBLIC
// * 6. npm run prod_deployPhase1
// * 7. npm run prod_update_wl

// * 8. npm run prod_reveal

// * PILLS
// * 9. npm run uploadStatic
// * 10. npm run prod_deployPhase2
// * 11. npm run prod_togglePharmacyPause

// ! Pre-Deploy Phase 0 checklist
// ?  Upload related
// *  [x] add provenance records to website

// ?  Contract related
// *  [x] correct Gnosis Safe
// *  [x] correct Presale price
// *  [x] correct DMSS-NFT Base URI in deploy script
// *  [x] correct ReleaseDates (Pre, Wl, Public)
// *  [x] correct Pill Qualify Deadline
// *  [x] correct provenance hash
// *  [x] correct EMC-NFT Base URI in deploy script
// *  [x] deploying with right wallet (companyOpensea)

// ! Post-Deploy Phase 0 checklist
// ?  Contract related
// *  [x] execute verify commands
// *  [x] addresses updated in this config file
// *  [x] issue contingent
// *  [x] list on OS & add link for opeansea to app. (url should be /NFTspacesquad)
// *  [x] DMSS royalties set to 3%
// *  [x] EMC royalties set to 5.693%

// ? Web related
// *  [x] update env & heroku file
// *      - contract address
// *      - ReleaseDates
// *      - Collection url
// *      - NEXT_PUBLIC_DEPLOYED_NETWORK MAINNET / RINKEBY
// *  [x] Set heroku to prod git:remote
// *  [x] Push to heroku for re-build

// ?  Discord Bot related
// *  [ ] heroku-bot env to DMSS-NFT address

// ! Pre-Deploy Phase 1 checklist
// ?  Contract related
// *  [ ] revokeRole AUTH_MINTER (EMC) & MINTER (DMSS) Roles from presale
// *  [ ] correct releaseDates
// *  [ ] correct INITIAL_FREE_MINT_CONTINGENT
// *  [ ] deploying with right wallet (companyOpensea)

// ! Post-Deploy Phase1 checklist
// ?  Contract related
// *  [ ] execute verify commands
// *  [ ] addresses updated in this config file
// *  [ ] update whitelist [update_wl, whitelist.json]

// ? Web related
// *  [ ] /presale to /mint
// *  [ ] Header Mint link
// *  [ ] Remove presale page
// *  [ ] update env & heroku file
// *      - contract address
// *      - ReleaseDates
// *  [ ] Push to heroku for re-build

// ! Pre-Release after Phase 1
// *  [ ] update whitelist [update_wl, whitelist.json]
// *  [ ] update FreeMintContingent

// ! Pre-Deploy Phase 2 checklist
// *  [ ] correct pill price
// *  [ ] correct tokenURI for pill
// *  [ ] correct total_supply (keep claimReserve DMSS (pcCount) in mind)
// *  [ ] deploying with right wallet (companyOpensea)

// ! Post-Deploy Phase 2 checklist
// ?  Contract related
// *  [ ] execute verfiy commands
// *  [ ] issue founder pill contingent
// *  [ ] list on OS
// *  [ ] royalties set to 3%

// ? Web related
// *  [ ] update env & heroku file
// *      - contract address
// *      - Pill Price
// *  [ ] enable all pill elements
// *  [ ] Push to heroku for re-build

// ! Pre-Release after Phase 2
// *  [ ] unpause pharmacy (when time is ready; updates claimReserve on togglePause())

// ! CONFIG
export const PROJECT_NAME = 'NFT  Space Squad'
export const SINGLE_NAME = 'NFT '
export const REST_OF_OPENSEA_DESCRIPTION =
  'is a member of the NFT  Space Squad. Having found primordial wall drawings and artefacts of an ancient civilization on their planet, the lab-bred penises of the space squad are on a noble space mission to find traces of a gender of their race lost to time.'

export const NFT_NAME = 'NFT  Space Squad'
export const NFT_SYMBOL = 'DMSS'
export const NFT_PRICE = utils.parseEther('0.08')
export const NFT_PRICE_PRESALE = utils.parseEther('0.06')
export const NFT_DMSS_PROVENANCE =
  '39c40bbf8fabb1154ffe40b04dde716fc60a1d4f58878c28a7a2cebf66f14426'
export const NFT_BASE_URI =
  'ipfs://QmQZpjVznfGMqCtuvDDvousPFo7yqKX2QuNyzVyAWL35Zj/' //e.g. 'ipfs://QmXGfLyRUzumFL3ytMX4MgyWBLQ4rr1kmzrQGe8mwoDAXs/'
export const NFT_UNREVEALED_URI =
  'ipfs://Qmbkxba1j72tE6TqjMpMdz7qo2a85LzLEZcHeeRkFYCQH4'

export const EMC_NFT_NAME = 'company MembershipPlus Card'
export const EMC_NFT_SYMBOL = 'EMC'
export const EMC_NFT_BASE_URI =
  'ipfs://QmTxFVDBMq5eNngATfXvBWFEtAXBfFcwjuK6ifjuLf7rjs'

export const ROYALTY_BASISPOINTS = 300 // 3%; for NFT & Pills
export const GNOSIS_SAFE = '0x6EA403B0cf1A62e2bF04972a304870F60Cb1dCb6'

export const FREEMINT_SIZE = 9800
export const PRESALE_SIZE = 508
export const COLLECTION_SIZE = 10000
export const CONTINGENT = 50
export const CONTINGENT_RECEIVER = GNOSIS_SAFE
export const INITIAL_FREE_MINT_CONTINGENT = 150

export const PRE_RELEASE_DATE_UTC = moment.utc('2022-05-27T19:00:00').unix()
export const WL_RELEASE_DATE_UTC = moment.utc('2022-06-10T19:00:00').unix()
export const RELEASE_DATE_UTC = moment.utc('2022-06-11T19:00:00').unix()
export const PILL_QUALIFY_DEADLINE_UTC = moment
  .utc('2022-07-11T19:00:00')
  .unix()
export const PILL_CLAIM_DEALDINE_UTC = moment.utc('2022-09-11T19:00:00').unix()

// ! Config Pill & Pharamcy Deploy
export const PILL_NAME = 'NFT Enlargening Pill'
export const PILL_SYMBOL = 'DEP'
export const PILL_METADATA =
  'ipfs://QmRUUuDa9dyWThRpJazVfYySaJ3htNqXt6aR6LxXmMhfqP/dep.json'
export const PILL_PRICE = utils.parseEther('0.01')
export const PILL_SUPPLY = 5000

// ! Config Post Deploy
export const NFT_ADDRESS = '0x327923c061E94476560B831d8E5bC63CFb2534F6'
export const PRESALE_ADDRESS = '0x9834001BB28b778b82fC30Fb38e5426c4674dfB8'
export const company_MEMBERSHIP_CARD_ADDRESS =
  '0x1bB2Eecc657013C2bBAEF66cf3F84de823DF0b12'
export const DISTRIBUTOR_ADDRESS = ''
export const PILL_ADDRESS = ''
export const PHARMACY_ADDRESS = ''
