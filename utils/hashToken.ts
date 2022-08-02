import { ethers } from 'hardhat'

export const hashToken = (
  account: string,
  whitelist: number,
  freeMint: number
) =>
  Buffer.from(
    ethers.utils
      .solidityKeccak256(
        ['address', 'uint256', 'uint256'],
        [account, whitelist, freeMint]
      )
      .slice(2),
    'hex'
  )
