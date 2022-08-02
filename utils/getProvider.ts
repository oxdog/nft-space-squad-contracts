import { ethers, network } from 'hardhat'

const keys: { [network: string]: string } = {
  mainnet: process.env.ALCHEMY_API_MAINNET as string,
  rinkeby: process.env.ALCHEMY_DEV_API_RINKEBY as string
}

export const getProvider = () =>
  network.name === 'fork'
    ? // ? new ethers.providers.JsonRpcProvider('http://localhost:8545')
      new ethers.providers.JsonRpcProvider('http://localhost:8545', {
        chainId: 31337,
        name: 'fork'
      })
    : new ethers.providers.AlchemyProvider(network.name, keys[network.name])
