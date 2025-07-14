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

export interface WithdrawRewardArgs {
  amount: BN
  rewardIndex: BN
}

export interface WithdrawRewardAccounts {
  farmAdmin: TransactionSigner
  farmState: Address
  rewardMint: Address
  rewardVault: Address
  farmVaultsAuthority: Address
  adminRewardTokenAta: Address
  scopePrices: Option<Address>
  tokenProgram: Address
}

export const layout = borsh.struct<WithdrawRewardArgs>([
  borsh.u64("amount"),
  borsh.u64("rewardIndex"),
])

export function withdrawReward(
  args: WithdrawRewardArgs,
  accounts: WithdrawRewardAccounts,
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
    { address: accounts.rewardMint, role: 0 },
    { address: accounts.rewardVault, role: 1 },
    { address: accounts.farmVaultsAuthority, role: 0 },
    { address: accounts.adminRewardTokenAta, role: 1 },
    isSome(accounts.scopePrices)
      ? { address: accounts.scopePrices.value, role: 0 }
      : { address: programAddress, role: 0 },
    { address: accounts.tokenProgram, role: 0 },
    ...remainingAccounts,
  ]
  const identifier = Buffer.from([191, 187, 176, 137, 9, 25, 187, 244])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      amount: args.amount,
      rewardIndex: args.rewardIndex,
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix: IInstruction = { accounts: keys, programAddress, data }
  return ix
}
