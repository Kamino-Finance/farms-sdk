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

export interface TransferOwnershipAccounts {
  oldOwner: TransactionSigner
  payer: TransactionSigner
  newOwner: Address
  oldUserState: Address
  newUserState: Address
  farmState: Address
  scopePrices: Option<Address>
  systemProgram: Address
  rent: Address
}

export function transferOwnership(
  accounts: TransferOwnershipAccounts,
  remainingAccounts: Array<IAccountMeta | IAccountSignerMeta> = [],
  programAddress: Address = PROGRAM_ID
) {
  const keys: Array<IAccountMeta | IAccountSignerMeta> = [
    { address: accounts.oldOwner.address, role: 2, signer: accounts.oldOwner },
    { address: accounts.payer.address, role: 3, signer: accounts.payer },
    { address: accounts.newOwner, role: 0 },
    { address: accounts.oldUserState, role: 1 },
    { address: accounts.newUserState, role: 1 },
    { address: accounts.farmState, role: 1 },
    isSome(accounts.scopePrices)
      ? { address: accounts.scopePrices.value, role: 0 }
      : { address: programAddress, role: 0 },
    { address: accounts.systemProgram, role: 0 },
    { address: accounts.rent, role: 0 },
    ...remainingAccounts,
  ]
  const identifier = Buffer.from([65, 177, 215, 73, 53, 45, 99, 47])
  const data = identifier
  const ix: IInstruction = { accounts: keys, programAddress, data }
  return ix
}
