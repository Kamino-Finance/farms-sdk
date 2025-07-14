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

export interface UpdateSecondDelegatedAuthorityAccounts {
  globalAdmin: TransactionSigner
  farmState: Address
  globalConfig: Address
  newSecondDelegatedAuthority: Address
}

export function updateSecondDelegatedAuthority(
  accounts: UpdateSecondDelegatedAuthorityAccounts,
  remainingAccounts: Array<IAccountMeta | IAccountSignerMeta> = [],
  programAddress: Address = PROGRAM_ID
) {
  const keys: Array<IAccountMeta | IAccountSignerMeta> = [
    {
      address: accounts.globalAdmin.address,
      role: 3,
      signer: accounts.globalAdmin,
    },
    { address: accounts.farmState, role: 1 },
    { address: accounts.globalConfig, role: 0 },
    { address: accounts.newSecondDelegatedAuthority, role: 0 },
    ...remainingAccounts,
  ]
  const identifier = Buffer.from([127, 26, 6, 181, 203, 248, 117, 64])
  const data = identifier
  const ix: IInstruction = { accounts: keys, programAddress, data }
  return ix
}
