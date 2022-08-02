import 'dotenv/config'
import * as fs from 'fs'
import path from 'path'
import { COLLECTION_SIZE } from '../config/config'

const MAX_SIZE = 5

// * Note:
// * This file exists because Moralis IPFS Gateway could not handle 50k files at a time
// * I did not bother to code Pinata IPFS Gateway upload because they have a UI to upload a folder
// * Generate Meta manually and upload entire folder via their UI https://app.pinata.cloud/pinmanager

async function main() {
  console.log('# # # # # # # # # # ')
  console.log('# Generating more meta')

  for (let i = 0; i < COLLECTION_SIZE; i++) {
    for (let size = 1; size <= MAX_SIZE; size++) {
      const rawData = fs.readFileSync(
        path.join(__dirname, '../../resources/meta', `/${i}.json`)
      )

      const data = JSON.parse(rawData.toString())

      const content = {
        ...data,
        attributes: [
          ...data.attributes.filter(
            (a: { trait_type: string; value: string }) =>
              a.trait_type !== 'Outline' && a.value.toLowerCase() != 'blank'
          ),
          {
            trait_type: 'Size',
            value: size
          }
        ]
      }

      fs.writeFileSync(
        path.join(
          __dirname,
          '../../resources/metaWSizes',
          `/${size}/${i}.json`
        ),
        JSON.stringify(content)
      )
    }
  }

  console.log('done')
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
