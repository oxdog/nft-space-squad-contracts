import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-etherscan'
import '@nomiclabs/hardhat-waffle'
import '@typechain/hardhat'
import 'dotenv/config'
import 'hardhat-contract-sizer'
import 'hardhat-gas-reporter'
import { HardhatUserConfig } from 'hardhat/types'

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  solidity: {
    compilers: [
      {
        version: '0.8.11',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      }
    ]
  },
  networks: {
    hardhat: {},
    rinkeby: {
      url: process.env.ALCHEMY_DEV_URL_RINKEBY,
      accounts: [process.env.OPENSEA_WALLET as string]
    },
    mumbai: {
      url: process.env.ALCHEMY_DEV_URL_MUMBAI,
      accounts: [process.env.DEV_WALLET as string]
    },
    mainnet: {
      url: process.env.ALCHEMY_URL_MAINNET,
      accounts: [process.env.OPENSEA_WALLET as string]
    },
    fork: {
      url: 'http://localhost:8545',
      accounts: [process.env.DEV_WALLET as string]
    }
  },
  contractSizer: {
    alphaSort: false,
    runOnCompile: false,
    disambiguatePaths: false
  },
  gasReporter: {
    currency: 'EUR',
    gasPrice: 50,
    enabled: process.env.REPORT_GAS ? true : false,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY
  },
  typechain: {
    outDir: 'types/typechain'
  },
  etherscan: {
    apiKey: {
      mainnet: '',
      rinkeby: ''
    }
  }
}

export default config
