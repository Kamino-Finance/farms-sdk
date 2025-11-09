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

export const DISCRIMINATOR = Buffer.from([40, 63, 122, 158, 144, 216, 83, 96])

export interface WithdrawTreasuryArgs {
  amount: BN
}

export interface WithdrawTreasuryAccounts {
  globalAdmin: TransactionSigner
  globalConfig: Address
  rewardMint: Address
  rewardTreasuryVault: Address
  treasuryVaultAuthority: Address
  withdrawDestinationTokenAccount: Address
  tokenProgram: Address
}

export const layout = borsh.struct([borsh.u64("amount")])

export function withdrawTreasury(
  args: WithdrawTreasuryArgs,
  accounts: WithdrawTreasuryAccounts,
  remainingAccounts: Array<AccountMeta | AccountSignerMeta> = [],
  programAddress: Address = PROGRAM_ID
) {
  const keys: Array<AccountMeta | AccountSignerMeta> = [
    {
      address: accounts.globalAdmin.address,
      role: 3,
      signer: accounts.globalAdmin,
    },
    { address: accounts.globalConfig, role: 0 },
    { address: accounts.rewardMint, role: 0 },
    { address: accounts.rewardTreasuryVault, role: 1 },
    { address: accounts.treasuryVaultAuthority, role: 0 },
    { address: accounts.withdrawDestinationTokenAccount, role: 1 },
    { address: accounts.tokenProgram, role: 0 },
    ...remainingAccounts,
  ]
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      amount: args.amount,
    },
    buffer
  )
  const data = Buffer.concat([DISCRIMINATOR, buffer]).slice(0, 8 + len)
  const ix: Instruction = { accounts: keys, programAddress, data }
  return ix
}
