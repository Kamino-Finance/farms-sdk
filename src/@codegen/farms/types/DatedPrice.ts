/* eslint-disable @typescript-eslint/no-unused-vars */
import { address, Address } from "@solana/kit"
import * as types from "../types"
import * as borsh from "../utils/borsh"
import { borshAddress } from "../utils"
/* eslint-enable @typescript-eslint/no-unused-vars */
export interface DatedPriceFields {
  price: types.PriceFields
  lastUpdatedSlot: bigint
  unixTimestamp: bigint
  reserved: Array<bigint>
  reserved2: Array<number>
  index: number
}

export interface DatedPriceJSON {
  price: types.PriceJSON
  lastUpdatedSlot: string
  unixTimestamp: string
  reserved: Array<string>
  reserved2: Array<number>
  index: number
}

export class DatedPrice {
  readonly price: types.Price
  readonly lastUpdatedSlot: bigint
  readonly unixTimestamp: bigint
  readonly reserved: Array<bigint>
  readonly reserved2: Array<number>
  readonly index: number

  constructor(fields: DatedPriceFields) {
    this.price = new types.Price({ ...fields.price })
    this.lastUpdatedSlot = fields.lastUpdatedSlot
    this.unixTimestamp = fields.unixTimestamp
    this.reserved = fields.reserved
    this.reserved2 = fields.reserved2
    this.index = fields.index
  }

  static layout(property?: string) {
    return borsh.struct(
      [
        types.Price.layout("price"),
        borsh.u64("lastUpdatedSlot"),
        borsh.u64("unixTimestamp"),
        borsh.array(borsh.u64(), 2, "reserved"),
        borsh.array(borsh.u16(), 3, "reserved2"),
        borsh.u16("index"),
      ],
      property
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromDecoded(obj: any) {
    return new DatedPrice({
      price: types.Price.fromDecoded(obj.price),
      lastUpdatedSlot: obj.lastUpdatedSlot,
      unixTimestamp: obj.unixTimestamp,
      reserved: obj.reserved,
      reserved2: obj.reserved2,
      index: obj.index,
    })
  }

  static toEncodable(fields: DatedPriceFields) {
    return {
      price: types.Price.toEncodable(fields.price),
      lastUpdatedSlot: fields.lastUpdatedSlot,
      unixTimestamp: fields.unixTimestamp,
      reserved: fields.reserved,
      reserved2: fields.reserved2,
      index: fields.index,
    }
  }

  toJSON(): DatedPriceJSON {
    return {
      price: this.price.toJSON(),
      lastUpdatedSlot: this.lastUpdatedSlot.toString(),
      unixTimestamp: this.unixTimestamp.toString(),
      reserved: this.reserved.map((item) => item.toString()),
      reserved2: this.reserved2,
      index: this.index,
    }
  }

  static fromJSON(obj: DatedPriceJSON): DatedPrice {
    return new DatedPrice({
      price: types.Price.fromJSON(obj.price),
      lastUpdatedSlot: BigInt(obj.lastUpdatedSlot),
      unixTimestamp: BigInt(obj.unixTimestamp),
      reserved: obj.reserved.map((item) => BigInt(item)),
      reserved2: obj.reserved2,
      index: obj.index,
    })
  }

  toEncodable() {
    return DatedPrice.toEncodable(this)
  }
}
