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

export const DISCRIMINATOR = Buffer.from([240, 24, 9, 227, 86, 225, 199, 95])

export interface CloseEmptyUserStateAccounts {
  /**
   * The account that signs the transaction
   * - Non-delegated: user signs
   * - Delegated: delegated authority signs
   */
  signer: TransactionSigner
  userState: Address
  /** The farm state account for validation */
  farmState: Address
  /**
   * The account that receives the rent
   * - Non-delegated: user receives the rent
   * - Delegated: farm admin receives the rent
   */
  rentReceiver: Address
  systemProgram: Address
}

export function closeEmptyUserState(
  accounts: CloseEmptyUserStateAccounts,
  remainingAccounts: Array<AccountMeta | AccountSignerMeta> = [],
  programAddress: Address = PROGRAM_ID
) {
  const keys: Array<AccountMeta | AccountSignerMeta> = [
    { address: accounts.signer.address, role: 2, signer: accounts.signer },
    { address: accounts.userState, role: 1 },
    { address: accounts.farmState, role: 0 },
    { address: accounts.rentReceiver, role: 1 },
    { address: accounts.systemProgram, role: 0 },
    ...remainingAccounts,
  ]
  const data = DISCRIMINATOR
  const ix: Instruction = { accounts: keys, programAddress, data }
  return ix
}
