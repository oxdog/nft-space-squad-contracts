import * as fs from 'fs'
import { ethers } from 'hardhat'
import path from 'path'
import { COLLECTION_SIZE } from '../config/config'

const { utils } = ethers

async function main() {
  let allHashes = ''
  let imgUriList: {
    tokenId: number
    ipfsUrl: string
    ipfsHash: string
    sha256: string
  }[] = []
  const rowElements: string[] = []

  for (let i = 0; i < COLLECTION_SIZE; i++) {
    const rawData = fs.readFileSync(
      path.join(__dirname, '../../resources/meta', `/${i}.json`)
    )

    const data = JSON.parse(rawData.toString())

    const ipfsUrl = data.image

    if (!ipfsUrl) {
      console.log('No image property on json. Run upload first.')
    }

    const ipfsHash = ipfsUrl.replace('ipfs://', '')
    const sha256 = utils.sha256(utils.toUtf8Bytes(ipfsHash)).substring(2)

    allHashes = allHashes.concat(sha256)
    imgUriList.push({ tokenId: i, ipfsUrl: data.image, ipfsHash, sha256 })
    rowElements.push(`
      <tr>
        <td>${i}</td>
        <td>${sha256}</td>
        <td>
          <a href="${
            'https://ipfs.io/ipfs/' + ipfsHash
          }" style="color: #a300bf"> ${ipfsHash} </a>
        </td>
      </tr>
    `)
  }

  const finalProofHash = utils.sha256(utils.toUtf8Bytes(allHashes)).substring(2)

  const finalHtml = `
    <table cellpadding="16" cellspacing="1">
        <tr>
          <th>Token Id</th>
          <th>Sha256</th>
          <th>IPFS Hash</th>
        </tr>
        ${rowElements.reduce((a, b) => a.concat(b))}
      </table>
  `

  fs.writeFileSync(
    path.join(__dirname, '../../resources/provenance', `/concatenatedHash.txt`),
    allHashes
  )
  fs.writeFileSync(
    path.join(__dirname, '../../resources/provenance', `/finalProofHash.txt`),
    finalProofHash
  )
  fs.writeFileSync(
    path.join(__dirname, '../../resources/provenance', `/ListOfURI.json`),
    JSON.stringify(imgUriList)
  )
  fs.writeFileSync(
    path.join(__dirname, '../../resources/provenance', `/provenance.html`),
    finalHtml
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
