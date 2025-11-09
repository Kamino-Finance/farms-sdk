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

export const DISCRIMINATOR = Buffer.from([
  206, 176, 202, 18, 200, 209, 179, 108,
])

export interface StakeArgs {
  amount: BN
}

export interface StakeAccounts {
  owner: TransactionSigner
  userState: Address
  farmState: Address
  farmVault: Address
  userAta: Address
  tokenMint: Address
  scopePrices: Option<Address>
  tokenProgram: Address
}

export const layout = borsh.struct([borsh.u64("amount")])

export function stake(
  args: StakeArgs,
  accounts: StakeAccounts,
  remainingAccounts: Array<AccountMeta | AccountSignerMeta> = [],
  programAddress: Address = PROGRAM_ID
) {
  const keys: Array<AccountMeta | AccountSignerMeta> = [
    { address: accounts.owner.address, role: 2, signer: accounts.owner },
    { address: accounts.userState, role: 1 },
    { address: accounts.farmState, role: 1 },
    { address: accounts.farmVault, role: 1 },
    { address: accounts.userAta, role: 1 },
    { address: accounts.tokenMint, role: 0 },
    isSome(accounts.scopePrices)
      ? { address: accounts.scopePrices.value, role: 0 }
      : { address: programAddress, role: 0 },
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
