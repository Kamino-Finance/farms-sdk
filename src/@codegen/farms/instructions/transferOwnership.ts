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

export interface TransferOwnershipArgs {
  newOwner: Address
}

export interface TransferOwnershipAccounts {
  owner: TransactionSigner
  userState: Address
}

export const layout = borsh.struct([borshAddress("newOwner")])

export function transferOwnership(
  args: TransferOwnershipArgs,
  accounts: TransferOwnershipAccounts,
  programAddress: Address = PROGRAM_ID
) {
  const keys: Array<IAccountMeta | IAccountSignerMeta> = [
    { address: accounts.owner.address, role: 2, signer: accounts.owner },
    { address: accounts.userState, role: 1 },
  ]
  const identifier = Buffer.from([65, 177, 215, 73, 53, 45, 99, 47])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      newOwner: args.newOwner,
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix: IInstruction = { accounts: keys, programAddress, data }
  return ix
}
