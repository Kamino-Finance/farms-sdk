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

export interface UpdateGlobalConfigAdminAccounts {
  pendingGlobalAdmin: TransactionSigner
  globalConfig: Address
}

export function updateGlobalConfigAdmin(
  accounts: UpdateGlobalConfigAdminAccounts,
  remainingAccounts: Array<IAccountMeta | IAccountSignerMeta> = [],
  programAddress: Address = PROGRAM_ID
) {
  const keys: Array<IAccountMeta | IAccountSignerMeta> = [
    {
      address: accounts.pendingGlobalAdmin.address,
      role: 2,
      signer: accounts.pendingGlobalAdmin,
    },
    { address: accounts.globalConfig, role: 1 },
    ...remainingAccounts,
  ]
  const identifier = Buffer.from([184, 87, 23, 193, 156, 238, 175, 119])
  const data = identifier
  const ix: IInstruction = { accounts: keys, programAddress, data }
  return ix
}
