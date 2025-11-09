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

export const DISCRIMINATOR = Buffer.from([95, 135, 192, 196, 242, 129, 230, 68])

export interface InitializeRewardAccounts {
  farmAdmin: TransactionSigner
  farmState: Address
  globalConfig: Address
  rewardMint: Address
  rewardVault: Address
  rewardTreasuryVault: Address
  farmVaultsAuthority: Address
  treasuryVaultsAuthority: Address
  tokenProgram: Address
  systemProgram: Address
  rent: Address
}

export function initializeReward(
  accounts: InitializeRewardAccounts,
  remainingAccounts: Array<AccountMeta | AccountSignerMeta> = [],
  programAddress: Address = PROGRAM_ID
) {
  const keys: Array<AccountMeta | AccountSignerMeta> = [
    {
      address: accounts.farmAdmin.address,
      role: 3,
      signer: accounts.farmAdmin,
    },
    { address: accounts.farmState, role: 1 },
    { address: accounts.globalConfig, role: 0 },
    { address: accounts.rewardMint, role: 0 },
    { address: accounts.rewardVault, role: 1 },
    { address: accounts.rewardTreasuryVault, role: 1 },
    { address: accounts.farmVaultsAuthority, role: 0 },
    { address: accounts.treasuryVaultsAuthority, role: 0 },
    { address: accounts.tokenProgram, role: 0 },
    { address: accounts.systemProgram, role: 0 },
    { address: accounts.rent, role: 0 },
    ...remainingAccounts,
  ]
  const data = DISCRIMINATOR
  const ix: Instruction = { accounts: keys, programAddress, data }
  return ix
}
