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

export interface IdlMissingTypesArgs {
  globalConfigOptionKind: types.GlobalConfigOptionKind
  farmConfigOptionKind: types.FarmConfigOptionKind
  timeUnit: types.TimeUnitKind
  lockingMode: types.LockingModeKind
  rewardType: types.RewardTypeKind
}

export interface IdlMissingTypesAccounts {
  globalAdmin: TransactionSigner
  globalConfig: Address
}

export const layout = borsh.struct<IdlMissingTypesArgs>([
  types.GlobalConfigOption.layout("globalConfigOptionKind"),
  types.FarmConfigOption.layout("farmConfigOptionKind"),
  types.TimeUnit.layout("timeUnit"),
  types.LockingMode.layout("lockingMode"),
  types.RewardType.layout("rewardType"),
])

export function idlMissingTypes(
  args: IdlMissingTypesArgs,
  accounts: IdlMissingTypesAccounts,
  remainingAccounts: Array<IAccountMeta | IAccountSignerMeta> = [],
  programAddress: Address = PROGRAM_ID
) {
  const keys: Array<IAccountMeta | IAccountSignerMeta> = [
    {
      address: accounts.globalAdmin.address,
      role: 2,
      signer: accounts.globalAdmin,
    },
    { address: accounts.globalConfig, role: 1 },
    ...remainingAccounts,
  ]
  const identifier = Buffer.from([130, 80, 38, 153, 80, 212, 182, 253])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      globalConfigOptionKind: args.globalConfigOptionKind.toEncodable() as any,
      farmConfigOptionKind: args.farmConfigOptionKind.toEncodable() as any,
      timeUnit: args.timeUnit.toEncodable() as any,
      lockingMode: args.lockingMode.toEncodable() as any,
      rewardType: args.rewardType.toEncodable() as any,
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix: IInstruction = { accounts: keys, programAddress, data }
  return ix
}
