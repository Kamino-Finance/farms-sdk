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

export interface UpdateFarmAdminAccounts {
  pendingFarmAdmin: TransactionSigner
  farmState: Address
}

export function updateFarmAdmin(
  accounts: UpdateFarmAdminAccounts,
  remainingAccounts: Array<IAccountMeta | IAccountSignerMeta> = [],
  programAddress: Address = PROGRAM_ID
) {
  const keys: Array<IAccountMeta | IAccountSignerMeta> = [
    {
      address: accounts.pendingFarmAdmin.address,
      role: 3,
      signer: accounts.pendingFarmAdmin,
    },
    { address: accounts.farmState, role: 1 },
    ...remainingAccounts,
  ]
  const identifier = Buffer.from([20, 37, 136, 19, 122, 239, 36, 130])
  const data = identifier
  const ix: IInstruction = { accounts: keys, programAddress, data }
  return ix
}
