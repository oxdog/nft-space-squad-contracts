import { ethers } from 'hardhat'
import chai from '../scripts/chaisetup'
const { expect } = chai

export const setBalanceInWei = async (address: string, amount: string) =>
  setBalance(address, ethers.BigNumber.from(amount).toHexString())

export const setBalanceInEther = async (address: string, amount: number) =>
  setBalance(
    address,
    ethers.BigNumber.from(
      ethers.utils.parseEther(amount.toString())
    ).toHexString()
  )

const setBalance = async (address: string, amount: string) => {
  await ethers.provider.send('hardhat_setBalance', [
    address,
    ethers.utils.parseEther(amount).toHexString()
  ])
  expect(await ethers.provider.getBalance(address)).to.be.equal(
    ethers.utils.parseEther(amount)
  )
}
