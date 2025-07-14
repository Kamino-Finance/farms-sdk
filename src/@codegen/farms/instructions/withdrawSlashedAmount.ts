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

export interface WithdrawSlashedAmountAccounts {
  crank: TransactionSigner
  farmState: Address
  slashedAmountSpillAddress: Address
  farmVault: Address
  farmVaultsAuthority: Address
  tokenProgram: Address
}

export function withdrawSlashedAmount(
  accounts: WithdrawSlashedAmountAccounts,
  remainingAccounts: Array<IAccountMeta | IAccountSignerMeta> = [],
  programAddress: Address = PROGRAM_ID
) {
  const keys: Array<IAccountMeta | IAccountSignerMeta> = [
    { address: accounts.crank.address, role: 3, signer: accounts.crank },
    { address: accounts.farmState, role: 1 },
    { address: accounts.slashedAmountSpillAddress, role: 1 },
    { address: accounts.farmVault, role: 1 },
    { address: accounts.farmVaultsAuthority, role: 0 },
    { address: accounts.tokenProgram, role: 0 },
    ...remainingAccounts,
  ]
  const identifier = Buffer.from([202, 217, 67, 74, 172, 22, 140, 216])
  const data = identifier
  const ix: IInstruction = { accounts: keys, programAddress, data }
  return ix
}
