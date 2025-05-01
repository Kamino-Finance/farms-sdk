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

export interface OraclePricesFields {
  oracleMappings: Address
  prices: Array<types.DatedPriceFields>
}

export interface OraclePricesJSON {
  oracleMappings: string
  prices: Array<types.DatedPriceJSON>
}

export class OraclePrices {
  readonly oracleMappings: Address
  readonly prices: Array<types.DatedPrice>

  static readonly discriminator = Buffer.from([
    89, 128, 118, 221, 6, 72, 180, 146,
  ])

  static readonly layout = borsh.struct<OraclePrices>([
    borshAddress("oracleMappings"),
    borsh.array(types.DatedPrice.layout(), 512, "prices"),
  ])

  constructor(fields: OraclePricesFields) {
    this.oracleMappings = fields.oracleMappings
    this.prices = fields.prices.map((item) => new types.DatedPrice({ ...item }))
  }

  static async fetch(
    rpc: Rpc<GetAccountInfoApi>,
    address: Address,
    programId: Address = PROGRAM_ID
  ): Promise<OraclePrices | null> {
    const info = await fetchEncodedAccount(rpc, address)

    if (!info.exists) {
      return null
    }
    if (info.programAddress !== programId) {
      throw new Error("account doesn't belong to this program")
    }

    return this.decode(Buffer.from(info.data))
  }

  static async fetchMultiple(
    rpc: Rpc<GetMultipleAccountsApi>,
    addresses: Address[],
    programId: Address = PROGRAM_ID
  ): Promise<Array<OraclePrices | null>> {
    const infos = await fetchEncodedAccounts(rpc, addresses)

    return infos.map((info) => {
      if (!info.exists) {
        return null
      }
      if (info.programAddress !== programId) {
        throw new Error("account doesn't belong to this program")
      }

      return this.decode(Buffer.from(info.data))
    })
  }

  static decode(data: Buffer): OraclePrices {
    if (!data.slice(0, 8).equals(OraclePrices.discriminator)) {
      throw new Error("invalid account discriminator")
    }

    const dec = OraclePrices.layout.decode(data.slice(8))

    return new OraclePrices({
      oracleMappings: dec.oracleMappings,
      prices: dec.prices.map(
        (
          item: any /* eslint-disable-line @typescript-eslint/no-explicit-any */
        ) => types.DatedPrice.fromDecoded(item)
      ),
    })
  }

  toJSON(): OraclePricesJSON {
    return {
      oracleMappings: this.oracleMappings,
      prices: this.prices.map((item) => item.toJSON()),
    }
  }

  static fromJSON(obj: OraclePricesJSON): OraclePrices {
    return new OraclePrices({
      oracleMappings: address(obj.oracleMappings),
      prices: obj.prices.map((item) => types.DatedPrice.fromJSON(item)),
    })
  }
}
