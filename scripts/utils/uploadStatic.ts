import axios from 'axios'
import 'dotenv/config'
import 'path'
import * as fs from 'fs'
import path from 'path'
import Moralis from 'moralis/node'
import { unixToHMS } from '../../utils/unixToHMS'
import {
  COLLECTION_SIZE,
  PROJECT_NAME,
  REST_OF_OPENSEA_DESCRIPTION,
  SINGLE_NAME
} from '../config/config'

const MAX_SIZE = 5

const uploadDEP = async () => {
  const DEPImage = fs.readFileSync(
    path.join(__dirname, '../resources/dep/pill.png')
  )

  const DEPFile = new Moralis.File(`dep.png`, {
    base64: DEPImage.toString('base64')
  })

  const DEPResult = await DEPFile.saveIPFS({ useMasterKey: true })

  const DEPCID = DEPResult.url()
    .replace(/.*files\/.*\//, '')
    .replace('.txt', '')

  const rawDEPData = fs.readFileSync(
    path.join(__dirname, '../resources/dep/dep.json')
  )

  const data = JSON.parse(rawDEPData.toString())

  const content = {
    ...data,
    image: `ipfs://${DEPCID}`
  }

  console.log('content', content)

  const resMeta = await uploadData([{ path: 'dep.json', content }])
  console.log('DEP', resMeta.data)
}

const uploadUnrevealed = async () => {
  const UnrevealedGif = fs.readFileSync(
    path.join(__dirname, '../resources/unrevealed/unrevealed.gif')
  )

  const UnrevealedFile = new Moralis.File(`unrev.gif`, {
    base64: UnrevealedGif.toString('base64')
  })

  const UnrevResult = await UnrevealedFile.saveIPFS({ useMasterKey: true })

  const cid = UnrevResult.url()
    .replace(/.*files\/.*\//, '')
    .replace('.txt', '')

  const rawData = fs.readFileSync(
    path.join(__dirname, '../resources/unrevealed/unrevealed.json')
  )

  const data = JSON.parse(rawData.toString())

  const content = {
    ...data,
    image: cid
  }

  const resMeta = await uploadData([{ path: 'unrevealed.json', content }])
  console.log('Unrevealed', resMeta.data)
}

async function main() {
  Moralis.start({
    serverUrl: process.env.MORALIS_SERVER_URL,
    appId: process.env.MORALIS_APP_ID,
    masterKey: process.env.MORALIS_MASTER_KEY
  })

  console.log('# # # # # # # # # # ')
  console.log('# Upload Pill & Placeholder started')

  await uploadDEP()
  await uploadUnrevealed()
}

const uploadData = (data: any) =>
  axios.post('https://deep-index.moralis.io/api/v2/ipfs/uploadFolder', data, {
    headers: {
      'X-API-KEY': process.env.MORALIS_WEB3_API_KEY as string,
      'Content-Type': 'application/json',
      accept: 'application/json'
    },
    maxContentLength: Infinity,
    maxBodyLength: Infinity
  })

main()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
