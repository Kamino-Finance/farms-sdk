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

export interface InitializeFarmAccounts {
  farmAdmin: TransactionSigner
  farmState: Address
  globalConfig: Address
  farmVault: Address
  farmVaultsAuthority: Address
  tokenMint: Address
  tokenProgram: Address
  systemProgram: Address
  rent: Address
}

export function initializeFarm(
  accounts: InitializeFarmAccounts,
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
    { address: accounts.globalConfig, role: 0 },
    { address: accounts.farmVault, role: 1 },
    { address: accounts.farmVaultsAuthority, role: 0 },
    { address: accounts.tokenMint, role: 0 },
    { address: accounts.tokenProgram, role: 0 },
    { address: accounts.systemProgram, role: 0 },
    { address: accounts.rent, role: 0 },
    ...remainingAccounts,
  ]
  const identifier = Buffer.from([252, 28, 185, 172, 244, 74, 117, 165])
  const data = identifier
  const ix: IInstruction = { accounts: keys, programAddress, data }
  return ix
}
