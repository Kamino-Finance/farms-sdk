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

export interface AddRewardsArgs {
  amount: BN
  rewardIndex: BN
}

export interface AddRewardsAccounts {
  payer: TransactionSigner
  farmState: Address
  rewardMint: Address
  rewardVault: Address
  farmVaultsAuthority: Address
  payerRewardTokenAta: Address
  scopePrices: Option<Address>
  tokenProgram: Address
}

export const layout = borsh.struct<AddRewardsArgs>([
  borsh.u64("amount"),
  borsh.u64("rewardIndex"),
])

export function addRewards(
  args: AddRewardsArgs,
  accounts: AddRewardsAccounts,
  remainingAccounts: Array<IAccountMeta | IAccountSignerMeta> = [],
  programAddress: Address = PROGRAM_ID
) {
  const keys: Array<IAccountMeta | IAccountSignerMeta> = [
    { address: accounts.payer.address, role: 3, signer: accounts.payer },
    { address: accounts.farmState, role: 1 },
    { address: accounts.rewardMint, role: 0 },
    { address: accounts.rewardVault, role: 1 },
    { address: accounts.farmVaultsAuthority, role: 0 },
    { address: accounts.payerRewardTokenAta, role: 1 },
    isSome(accounts.scopePrices)
      ? { address: accounts.scopePrices.value, role: 0 }
      : { address: programAddress, role: 0 },
    { address: accounts.tokenProgram, role: 0 },
    ...remainingAccounts,
  ]
  const identifier = Buffer.from([88, 186, 25, 227, 38, 137, 81, 23])
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
