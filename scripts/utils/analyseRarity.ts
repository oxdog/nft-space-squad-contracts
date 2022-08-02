import 'dotenv/config'
import * as fs from 'fs'
import path from 'path'
import { clearLastLine } from '../../utils/console/clearLastLine'
import { COLLECTION_SIZE } from '../config/config'

const TOP_RARITY: Record<string, number> = {
  Background: 4,
  Clothing: 3,
  Cockring: 3,
  NFTcolor: 5,
  Face: 3,
  Hat: 3,
  Outline: 1,
  Piercing: 4
}

async function main() {
  console.log('\n>Analysing Rarity')

  const rarityRecord: { [tradeType: string]: { [value: string]: number } } = {}

  for (let i = 0; i < COLLECTION_SIZE; i++) {
    const rawData = fs.readFileSync(
      path.join(__dirname, '../../resources/meta', `/${i}.json`)
    )

    const data = JSON.parse(rawData.toString())

    const attributes = data.attributes.map((attribute: any) => [
      attribute.trait_type,
      attribute.value
    ])

    attributes.forEach((at: [string, string]) => {
      const currentCount = rarityRecord[at[0]]
        ? rarityRecord[at[0]][at[1]] || 0
        : 0

      !rarityRecord[at[0]] && (rarityRecord[at[0]] = {})

      rarityRecord[at[0]][at[1]] = currentCount + 1
    })

    console.log(`>>> Scanned ${i}`)
    clearLastLine()
  }

  const categories = Object.keys(rarityRecord)

  categories.forEach((category) => {
    const traitTypes = Object.keys(rarityRecord[category])
    let rarsInTrait: number[] = []

    traitTypes.forEach((trait) => {
      const rarity = Math.round(
        (rarityRecord[category][trait] / COLLECTION_SIZE) * 100
      )
      rarityRecord[category][trait] = rarity
      rarsInTrait.push(rarity)
    })

    rarsInTrait = rarsInTrait.sort((a, b) => (a > b ? 1 : a == b ? 0 : -1))
    rarityRecord[category]['TOP_RARITY'] = TOP_RARITY[category]
  })

  fs.writeFileSync(
    path.join(__dirname, '../../resources/rarityRecord.json'),
    JSON.stringify(rarityRecord)
  )

  console.log('> done')
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
