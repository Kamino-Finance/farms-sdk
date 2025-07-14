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

export interface InitializeUserAccounts {
  authority: TransactionSigner
  payer: TransactionSigner
  owner: Address
  delegatee: Address
  userState: Address
  farmState: Address
  systemProgram: Address
  rent: Address
}

export function initializeUser(
  accounts: InitializeUserAccounts,
  remainingAccounts: Array<IAccountMeta | IAccountSignerMeta> = [],
  programAddress: Address = PROGRAM_ID
) {
  const keys: Array<IAccountMeta | IAccountSignerMeta> = [
    {
      address: accounts.authority.address,
      role: 2,
      signer: accounts.authority,
    },
    { address: accounts.payer.address, role: 3, signer: accounts.payer },
    { address: accounts.owner, role: 0 },
    { address: accounts.delegatee, role: 0 },
    { address: accounts.userState, role: 1 },
    { address: accounts.farmState, role: 1 },
    { address: accounts.systemProgram, role: 0 },
    { address: accounts.rent, role: 0 },
    ...remainingAccounts,
  ]
  const identifier = Buffer.from([111, 17, 185, 250, 60, 122, 38, 254])
  const data = identifier
  const ix: IInstruction = { accounts: keys, programAddress, data }
  return ix
}
