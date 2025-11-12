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

export const DISCRIMINATOR = Buffer.from([219, 137, 57, 22, 94, 186, 96, 114])

export interface RewardUserOnceArgs {
  rewardIndex: BN
  amount: BN
  expectedRewardIssuedUnclaimed: BN
}

export interface RewardUserOnceAccounts {
  delegateAuthority: TransactionSigner
  farmState: Address
  userState: Address
}

export const layout = borsh.struct([
  borsh.u64("rewardIndex"),
  borsh.u64("amount"),
  borsh.u64("expectedRewardIssuedUnclaimed"),
])

export function rewardUserOnce(
  args: RewardUserOnceArgs,
  accounts: RewardUserOnceAccounts,
  remainingAccounts: Array<AccountMeta | AccountSignerMeta> = [],
  programAddress: Address = PROGRAM_ID
) {
  const keys: Array<AccountMeta | AccountSignerMeta> = [
    {
      address: accounts.delegateAuthority.address,
      role: 3,
      signer: accounts.delegateAuthority,
    },
    { address: accounts.farmState, role: 1 },
    { address: accounts.userState, role: 1 },
    ...remainingAccounts,
  ]
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      rewardIndex: args.rewardIndex,
      amount: args.amount,
      expectedRewardIssuedUnclaimed: args.expectedRewardIssuedUnclaimed,
    },
    buffer
  )
  const data = Buffer.concat([DISCRIMINATOR, buffer]).slice(0, 8 + len)
  const ix: Instruction = { accounts: keys, programAddress, data }
  return ix
}
