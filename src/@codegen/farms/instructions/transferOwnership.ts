/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Address,
  isSome,
  AccountMeta,
  AccountSignerMeta,
  Instruction,
  Option,
  TransactionSigner,
} from "@solana/kit"
/* eslint-enable @typescript-eslint/no-unused-vars */
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import { borshAddress } from "../utils" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export const DISCRIMINATOR = Buffer.from([65, 177, 215, 73, 53, 45, 99, 47])

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
  remainingAccounts: Array<AccountMeta | AccountSignerMeta> = [],
  programAddress: Address = PROGRAM_ID
) {
  const keys: Array<AccountMeta | AccountSignerMeta> = [
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
  const data = DISCRIMINATOR
  const ix: Instruction = { accounts: keys, programAddress, data }
  return ix
}
