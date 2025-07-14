/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Address,
  isSome,
  IAccountMeta,
  IAccountSignerMeta,
  IInstruction,
  Option,
  TransactionSigner,
} from "@solana/kit"
/* eslint-enable @typescript-eslint/no-unused-vars */
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import { borshAddress } from "../utils" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface RewardUserOnceArgs {
  rewardIndex: BN
  amount: BN
}

export interface RewardUserOnceAccounts {
  farmAdmin: TransactionSigner
  farmState: Address
  userState: Address
}

export const layout = borsh.struct<RewardUserOnceArgs>([
  borsh.u64("rewardIndex"),
  borsh.u64("amount"),
])

export function rewardUserOnce(
  args: RewardUserOnceArgs,
  accounts: RewardUserOnceAccounts,
  remainingAccounts: Array<IAccountMeta | IAccountSignerMeta> = [],
  programAddress: Address = PROGRAM_ID
) {
  const keys: Array<IAccountMeta | IAccountSignerMeta> = [
    {
      address: accounts.farmAdmin.address,
      role: 3,
      signer: accounts.farmAdmin,
    },
    { address: accounts.farmState, role: 1 },
    { address: accounts.userState, role: 1 },
    ...remainingAccounts,
  ]
  const identifier = Buffer.from([219, 137, 57, 22, 94, 186, 96, 114])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      rewardIndex: args.rewardIndex,
      amount: args.amount,
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix: IInstruction = { accounts: keys, programAddress, data }
  return ix
}
