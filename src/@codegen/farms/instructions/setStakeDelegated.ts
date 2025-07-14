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

export interface SetStakeDelegatedArgs {
  newAmount: BN
}

export interface SetStakeDelegatedAccounts {
  delegateAuthority: TransactionSigner
  userState: Address
  farmState: Address
}

export const layout = borsh.struct<SetStakeDelegatedArgs>([
  borsh.u64("newAmount"),
])

export function setStakeDelegated(
  args: SetStakeDelegatedArgs,
  accounts: SetStakeDelegatedAccounts,
  remainingAccounts: Array<IAccountMeta | IAccountSignerMeta> = [],
  programAddress: Address = PROGRAM_ID
) {
  const keys: Array<IAccountMeta | IAccountSignerMeta> = [
    {
      address: accounts.delegateAuthority.address,
      role: 2,
      signer: accounts.delegateAuthority,
    },
    { address: accounts.userState, role: 1 },
    { address: accounts.farmState, role: 1 },
    ...remainingAccounts,
  ]
  const identifier = Buffer.from([73, 171, 184, 75, 30, 56, 198, 223])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      newAmount: args.newAmount,
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix: IInstruction = { accounts: keys, programAddress, data }
  return ix
}
