/* eslint-disable @typescript-eslint/no-unused-vars */
import { address, Address } from "@solana/kit"
import * as types from "../types"
import * as borsh from "../utils/borsh"
import { borshAddress } from "../utils"
/* eslint-enable @typescript-eslint/no-unused-vars */
export interface TokenInfoFields {
  mint: Address
  decimals: bigint
  tokenProgram: Address
  padding: Array<bigint>
}

export interface TokenInfoJSON {
  mint: string
  decimals: string
  tokenProgram: string
  padding: Array<string>
}

export class TokenInfo {
  readonly mint: Address
  readonly decimals: bigint
  readonly tokenProgram: Address
  readonly padding: Array<bigint>

  constructor(fields: TokenInfoFields) {
    this.mint = fields.mint
    this.decimals = fields.decimals
    this.tokenProgram = fields.tokenProgram
    this.padding = fields.padding
  }

  static layout(property?: string) {
    return borsh.struct(
      [
        borshAddress("mint"),
        borsh.u64("decimals"),
        borshAddress("tokenProgram"),
        borsh.array(borsh.u64(), 6, "padding"),
      ],
      property
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromDecoded(obj: any) {
    return new TokenInfo({
      mint: obj.mint,
      decimals: obj.decimals,
      tokenProgram: obj.tokenProgram,
      padding: obj.padding,
    })
  }

  static toEncodable(fields: TokenInfoFields) {
    return {
      mint: fields.mint,
      decimals: fields.decimals,
      tokenProgram: fields.tokenProgram,
      padding: fields.padding,
    }
  }

  toJSON(): TokenInfoJSON {
    return {
      mint: this.mint,
      decimals: this.decimals.toString(),
      tokenProgram: this.tokenProgram,
      padding: this.padding.map((item) => item.toString()),
    }
  }

  static fromJSON(obj: TokenInfoJSON): TokenInfo {
    return new TokenInfo({
      mint: address(obj.mint),
      decimals: BigInt(obj.decimals),
      tokenProgram: address(obj.tokenProgram),
      padding: obj.padding.map((item) => BigInt(item)),
    })
  }

  toEncodable() {
    return TokenInfo.toEncodable(this)
  }
}
