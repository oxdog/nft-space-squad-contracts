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

async function main() {
  Moralis.start({
    serverUrl: process.env.MORALIS_SERVER_URL,
    appId: process.env.MORALIS_APP_ID,
    masterKey: process.env.MORALIS_MASTER_KEY
  })

  console.log('# # # # # # # # # # ')
  console.log('# Upload started')
  console.log(
    `# estimated completion in ${unixToHMS(1000 * 0.93 * COLLECTION_SIZE)}`
  )

  await handleImages()
  // await handleMeta()

  console.log('done')
}

const handleImages = async () => {
  let totalUploadCount = 0
  const startingTime = Date.now()
  let imageUploadPromises: Promise<any>[] = []

  for (let i = 0; i < COLLECTION_SIZE; i++) {
    if (imageUploadPromises.length < 25) {
      imageUploadPromises.push(
        new Promise((res, rej) => {
          const image = fs.readFileSync(
            path.join(__dirname, '../../resources/images', `/${i}.png`)
          )

          const file = new Moralis.File(`${i}.png`, {
            base64: image.toString('base64')
          })

          file
            .saveIPFS({ useMasterKey: true })
            .then((result) => {
              const cid = result
                .url()
                .replace(/.*files\/.*\//, '')
                .replace('.txt', '')

              totalUploadCount++
              console.log(
                cid,
                `Upload #${totalUploadCount} ${unixToHMS(
                  Date.now() - startingTime
                )}`
              )

              updateJSON(i, cid)

              res(true)
            })
            .catch((e) => {
              console.log('error')
              rej(e)
            })
        })
      )
    } else {
      await Promise.all(imageUploadPromises)

      imageUploadPromises = []
      i--
    }
  }

  await Promise.all(imageUploadPromises)
}

const handleMeta = async () => {
  let metaData: any[] = []

  for (let i = 0; i < COLLECTION_SIZE; i++) {
    for (let size = 1; size <= MAX_SIZE; size++) {
      const rawData = fs.readFileSync(
        path.join(__dirname, '../../resources/meta', `/${i}.json`)
      )

      const data = JSON.parse(rawData.toString())

      const content = {
        ...data,
        attributes: [
          ...data.attributes.filter((a: any) => a.trait_type !== 'Outline'),
          {
            trait_type: 'Size',
            value: size
          }
        ]
      }

      metaData.push({
        path: `metadata/${size}/${i}.json`,
        content
      })
    }
  }

  console.log('uploading meta')
  const resMeta = await uploadData(metaData)
  console.log(resMeta.data)
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

const updateJSON = (index: number, imageCID: string) => {
  const rawData = fs.readFileSync(
    path.join(__dirname, '../../resources/meta', `/${index}.json`)
  )

  const existing = JSON.parse(rawData.toString())

  const data = JSON.stringify({
    tokenId: existing.tokenId,
    name: `${SINGLE_NAME} #${index}`,
    description: `${SINGLE_NAME} #${existing.tokenId} ${REST_OF_OPENSEA_DESCRIPTION}`,
    image: 'ipfs://' + imageCID,
    ...existing,
    attributes: [
      ...existing.attributes.filter(
        (a: { trait_type: string; value: string }) =>
          a.trait_type !== 'Outline' && a.value.toLowerCase() != 'blank'
      )
    ]
  })

  fs.writeFileSync(
    path.join(__dirname, '../../resources/meta', `/${index}.json`),
    data
  )
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
