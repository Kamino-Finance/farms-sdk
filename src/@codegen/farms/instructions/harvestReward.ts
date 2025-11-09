/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Address,
  isSome,
  AccountMeta,
  AccountSignerMeta,
  Instruction,
  Option,
  TransactionSigner,
} from "@solana/kit"
/* eslint-enable @typescript-eslint/no-unused-vars */
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import { borshAddress } from "../utils" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export const DISCRIMINATOR = Buffer.from([68, 200, 228, 233, 184, 32, 226, 188])

export interface HarvestRewardArgs {
  rewardIndex: BN
}

export interface HarvestRewardAccounts {
  payer: TransactionSigner
  userState: Address
  farmState: Address
  globalConfig: Address
  rewardMint: Address
  userRewardTokenAccount: Address
  rewardsVault: Address
  rewardsTreasuryVault: Address
  farmVaultsAuthority: Address
  scopePrices: Option<Address>
  tokenProgram: Address
}

export const layout = borsh.struct([borsh.u64("rewardIndex")])

export function harvestReward(
  args: HarvestRewardArgs,
  accounts: HarvestRewardAccounts,
  remainingAccounts: Array<AccountMeta | AccountSignerMeta> = [],
  programAddress: Address = PROGRAM_ID
) {
  const keys: Array<AccountMeta | AccountSignerMeta> = [
    { address: accounts.payer.address, role: 3, signer: accounts.payer },
    { address: accounts.userState, role: 1 },
    { address: accounts.farmState, role: 1 },
    { address: accounts.globalConfig, role: 0 },
    { address: accounts.rewardMint, role: 0 },
    { address: accounts.userRewardTokenAccount, role: 1 },
    { address: accounts.rewardsVault, role: 1 },
    { address: accounts.rewardsTreasuryVault, role: 1 },
    { address: accounts.farmVaultsAuthority, role: 0 },
    isSome(accounts.scopePrices)
      ? { address: accounts.scopePrices.value, role: 0 }
      : { address: programAddress, role: 0 },
    { address: accounts.tokenProgram, role: 0 },
    ...remainingAccounts,
  ]
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      rewardIndex: args.rewardIndex,
    },
    buffer
  )
  const data = Buffer.concat([DISCRIMINATOR, buffer]).slice(0, 8 + len)
  const ix: Instruction = { accounts: keys, programAddress, data }
  return ix
}
