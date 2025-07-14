/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  address,
  Address,
  fetchEncodedAccount,
  fetchEncodedAccounts,
  GetAccountInfoApi,
  GetMultipleAccountsApi,
  Rpc,
} from "@solana/kit"
/* eslint-enable @typescript-eslint/no-unused-vars */
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import { borshAddress } from "../utils" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface GlobalConfigFields {
  globalAdmin: Address
  treasuryFeeBps: BN
  treasuryVaultsAuthority: Address
  treasuryVaultsAuthorityBump: BN
  pendingGlobalAdmin: Address
  padding1: Array<BN>
}

export interface GlobalConfigJSON {
  globalAdmin: string
  treasuryFeeBps: string
  treasuryVaultsAuthority: string
  treasuryVaultsAuthorityBump: string
  pendingGlobalAdmin: string
  padding1: Array<string>
}

export class GlobalConfig {
  readonly globalAdmin: Address
  readonly treasuryFeeBps: BN
  readonly treasuryVaultsAuthority: Address
  readonly treasuryVaultsAuthorityBump: BN
  readonly pendingGlobalAdmin: Address
  readonly padding1: Array<BN>

  static readonly discriminator = Buffer.from([
    149, 8, 156, 202, 160, 252, 176, 217,
  ])

  static readonly layout = borsh.struct<GlobalConfig>([
    borshAddress("globalAdmin"),
    borsh.u64("treasuryFeeBps"),
    borshAddress("treasuryVaultsAuthority"),
    borsh.u64("treasuryVaultsAuthorityBump"),
    borshAddress("pendingGlobalAdmin"),
    borsh.array(borsh.u128(), 126, "padding1"),
  ])

  constructor(fields: GlobalConfigFields) {
    this.globalAdmin = fields.globalAdmin
    this.treasuryFeeBps = fields.treasuryFeeBps
    this.treasuryVaultsAuthority = fields.treasuryVaultsAuthority
    this.treasuryVaultsAuthorityBump = fields.treasuryVaultsAuthorityBump
    this.pendingGlobalAdmin = fields.pendingGlobalAdmin
    this.padding1 = fields.padding1
  }

  static async fetch(
    rpc: Rpc<GetAccountInfoApi>,
    address: Address,
    programId: Address = PROGRAM_ID
  ): Promise<GlobalConfig | null> {
    const info = await fetchEncodedAccount(rpc, address)

    if (!info.exists) {
      return null
    }
    if (info.programAddress !== programId) {
      throw new Error(
        `GlobalConfigFields account ${address} belongs to wrong program ${info.programAddress}, expected ${programId}`
      )
    }

    return this.decode(Buffer.from(info.data))
  }

  static async fetchMultiple(
    rpc: Rpc<GetMultipleAccountsApi>,
    addresses: Address[],
    programId: Address = PROGRAM_ID
  ): Promise<Array<GlobalConfig | null>> {
    const infos = await fetchEncodedAccounts(rpc, addresses)

    return infos.map((info) => {
      if (!info.exists) {
        return null
      }
      if (info.programAddress !== programId) {
        throw new Error(
          `GlobalConfigFields account ${info.address} belongs to wrong program ${info.programAddress}, expected ${programId}`
        )
      }

      return this.decode(Buffer.from(info.data))
    })
  }

  static decode(data: Buffer): GlobalConfig {
    if (!data.slice(0, 8).equals(GlobalConfig.discriminator)) {
      throw new Error("invalid account discriminator")
    }

    const dec = GlobalConfig.layout.decode(data.slice(8))

    return new GlobalConfig({
      globalAdmin: dec.globalAdmin,
      treasuryFeeBps: dec.treasuryFeeBps,
      treasuryVaultsAuthority: dec.treasuryVaultsAuthority,
      treasuryVaultsAuthorityBump: dec.treasuryVaultsAuthorityBump,
      pendingGlobalAdmin: dec.pendingGlobalAdmin,
      padding1: dec.padding1,
    })
  }

  toJSON(): GlobalConfigJSON {
    return {
      globalAdmin: this.globalAdmin,
      treasuryFeeBps: this.treasuryFeeBps.toString(),
      treasuryVaultsAuthority: this.treasuryVaultsAuthority,
      treasuryVaultsAuthorityBump: this.treasuryVaultsAuthorityBump.toString(),
      pendingGlobalAdmin: this.pendingGlobalAdmin,
      padding1: this.padding1.map((item) => item.toString()),
    }
  }

  static fromJSON(obj: GlobalConfigJSON): GlobalConfig {
    return new GlobalConfig({
      globalAdmin: address(obj.globalAdmin),
      treasuryFeeBps: new BN(obj.treasuryFeeBps),
      treasuryVaultsAuthority: address(obj.treasuryVaultsAuthority),
      treasuryVaultsAuthorityBump: new BN(obj.treasuryVaultsAuthorityBump),
      pendingGlobalAdmin: address(obj.pendingGlobalAdmin),
      padding1: obj.padding1.map((item) => new BN(item)),
    })
  }
}
