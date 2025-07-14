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

export interface UpdateFarmConfigArgs {
  mode: number
  data: Uint8Array
}

export interface UpdateFarmConfigAccounts {
  signer: TransactionSigner
  farmState: Address
  scopePrices: Option<Address>
}

export const layout = borsh.struct<UpdateFarmConfigArgs>([
  borsh.u16("mode"),
  borsh.vecU8("data"),
])

export function updateFarmConfig(
  args: UpdateFarmConfigArgs,
  accounts: UpdateFarmConfigAccounts,
  remainingAccounts: Array<IAccountMeta | IAccountSignerMeta> = [],
  programAddress: Address = PROGRAM_ID
) {
  const keys: Array<IAccountMeta | IAccountSignerMeta> = [
    { address: accounts.signer.address, role: 3, signer: accounts.signer },
    { address: accounts.farmState, role: 1 },
    isSome(accounts.scopePrices)
      ? { address: accounts.scopePrices.value, role: 0 }
      : { address: programAddress, role: 0 },
    ...remainingAccounts,
  ]
  const identifier = Buffer.from([214, 176, 188, 244, 203, 59, 230, 207])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      mode: args.mode,
      data: Buffer.from(
        args.data.buffer,
        args.data.byteOffset,
        args.data.length
      ),
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix: IInstruction = { accounts: keys, programAddress, data }
  return ix
}
