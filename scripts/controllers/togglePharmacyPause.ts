import 'dotenv/config'
import { ethers } from 'hardhat'
import { Pharmacy } from '../../types/typechain/Pharmacy'
import { deployer, PHARMACY_ADDRESS } from '../config/config'

async function main() {
  console.log('############################')
  console.log('# Pharamcy Pause Toggle')
  console.log('# ------------------')
  console.log(`# ... getting current status`)
  const pharmacyFactory = await ethers.getContractFactory('Pharmacy', deployer)
  const pharmacy = pharmacyFactory.attach(PHARMACY_ADDRESS) as Pharmacy
  const paused = await pharmacy.paused()
  console.log(`# ... is pharmacy currently paused? ${paused}`)
  let tx = await pharmacy.togglePause()
  console.log(`# ... waiting for TX to complete ${tx.hash}`)
  await tx.wait()
  const pausedAfterTX = await pharmacy.paused()
  console.log(`# ... pause status after TX: ${pausedAfterTX}`)
  console.log('# ------------------')
  console.log('############################')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
