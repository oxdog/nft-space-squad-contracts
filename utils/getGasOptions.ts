import { ethers } from 'ethers'
import { network } from 'hardhat'

export const getGasOptions = async (gasLimit: number = 25_000) => {
  const provider = new ethers.providers.AlchemyProvider(
    network.name,
    process.env.ALCHEMY_API_POLYGON
  )
  const price = ethers.utils.formatUnits(await provider.getGasPrice(), 'gwei')

  return {
    gasLimit,
    gasPrice: ethers.utils.parseUnits(price, 'gwei')
  }
}
