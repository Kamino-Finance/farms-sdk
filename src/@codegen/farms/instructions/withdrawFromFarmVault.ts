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

export const DISCRIMINATOR = Buffer.from([22, 82, 128, 250, 86, 79, 124, 78])

export interface WithdrawFromFarmVaultArgs {
  amount: BN
}

export interface WithdrawFromFarmVaultAccounts {
  withdrawAuthority: TransactionSigner
  farmState: Address
  withdrawerTokenAccount: Address
  farmVault: Address
  farmVaultsAuthority: Address
  tokenProgram: Address
}

export const layout = borsh.struct([borsh.u64("amount")])

export function withdrawFromFarmVault(
  args: WithdrawFromFarmVaultArgs,
  accounts: WithdrawFromFarmVaultAccounts,
  remainingAccounts: Array<AccountMeta | AccountSignerMeta> = [],
  programAddress: Address = PROGRAM_ID
) {
  const keys: Array<AccountMeta | AccountSignerMeta> = [
    {
      address: accounts.withdrawAuthority.address,
      role: 3,
      signer: accounts.withdrawAuthority,
    },
    { address: accounts.farmState, role: 1 },
    { address: accounts.withdrawerTokenAccount, role: 1 },
    { address: accounts.farmVault, role: 1 },
    { address: accounts.farmVaultsAuthority, role: 0 },
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
