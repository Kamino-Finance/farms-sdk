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

export interface WithdrawUnstakedDepositsAccounts {
  owner: TransactionSigner
  userState: Address
  farmState: Address
  userAta: Address
  farmVault: Address
  farmVaultsAuthority: Address
  tokenProgram: Address
}

export function withdrawUnstakedDeposits(
  accounts: WithdrawUnstakedDepositsAccounts,
  remainingAccounts: Array<IAccountMeta | IAccountSignerMeta> = [],
  programAddress: Address = PROGRAM_ID
) {
  const keys: Array<IAccountMeta | IAccountSignerMeta> = [
    { address: accounts.owner.address, role: 3, signer: accounts.owner },
    { address: accounts.userState, role: 1 },
    { address: accounts.farmState, role: 1 },
    { address: accounts.userAta, role: 1 },
    { address: accounts.farmVault, role: 1 },
    { address: accounts.farmVaultsAuthority, role: 0 },
    { address: accounts.tokenProgram, role: 0 },
    ...remainingAccounts,
  ]
  const identifier = Buffer.from([36, 102, 187, 49, 220, 36, 132, 67])
  const data = identifier
  const ix: IInstruction = { accounts: keys, programAddress, data }
  return ix
}
