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

export interface InitializeFarmDelegatedAccounts {
  farmAdmin: TransactionSigner
  farmDelegate: TransactionSigner
  farmState: Address
  globalConfig: Address
  farmVaultsAuthority: Address
  systemProgram: Address
  rent: Address
}

export function initializeFarmDelegated(
  accounts: InitializeFarmDelegatedAccounts,
  remainingAccounts: Array<IAccountMeta | IAccountSignerMeta> = [],
  programAddress: Address = PROGRAM_ID
) {
  const keys: Array<IAccountMeta | IAccountSignerMeta> = [
    {
      address: accounts.farmAdmin.address,
      role: 3,
      signer: accounts.farmAdmin,
    },
    {
      address: accounts.farmDelegate.address,
      role: 2,
      signer: accounts.farmDelegate,
    },
    { address: accounts.farmState, role: 1 },
    { address: accounts.globalConfig, role: 0 },
    { address: accounts.farmVaultsAuthority, role: 0 },
    { address: accounts.systemProgram, role: 0 },
    { address: accounts.rent, role: 0 },
    ...remainingAccounts,
  ]
  const identifier = Buffer.from([250, 84, 101, 25, 51, 77, 204, 91])
  const data = identifier
  const ix: IInstruction = { accounts: keys, programAddress, data }
  return ix
}
