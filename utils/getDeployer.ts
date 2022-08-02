import { ethers } from 'hardhat'
import { getProvider } from './getProvider'

export const getDeployer = () => {
  const provider = getProvider()
  const deployer = new ethers.Wallet(process.env.DEV_WALLET as string, provider)
  return deployer
}
