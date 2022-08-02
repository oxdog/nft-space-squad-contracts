declare global {
  namespace NodeJS {
    interface ProcessEnv {
      INFURA_PROJECT_ID: string
      WALLET_PRIVATE_KEY: string
      ETHERSCAN_API_KEY: string
    }
  }
}

export {}
