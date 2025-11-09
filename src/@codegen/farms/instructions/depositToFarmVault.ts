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

export const DISCRIMINATOR = Buffer.from([131, 166, 64, 94, 108, 213, 114, 183])

export interface DepositToFarmVaultArgs {
  amount: BN
}

export interface DepositToFarmVaultAccounts {
  depositor: TransactionSigner
  farmState: Address
  farmVault: Address
  depositorAta: Address
  tokenProgram: Address
}

export const layout = borsh.struct([borsh.u64("amount")])

export function depositToFarmVault(
  args: DepositToFarmVaultArgs,
  accounts: DepositToFarmVaultAccounts,
  remainingAccounts: Array<AccountMeta | AccountSignerMeta> = [],
  programAddress: Address = PROGRAM_ID
) {
  const keys: Array<AccountMeta | AccountSignerMeta> = [
    {
      address: accounts.depositor.address,
      role: 2,
      signer: accounts.depositor,
    },
    { address: accounts.farmState, role: 1 },
    { address: accounts.farmVault, role: 1 },
    { address: accounts.depositorAta, role: 1 },
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
