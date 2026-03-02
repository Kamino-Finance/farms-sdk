/* eslint-disable @typescript-eslint/no-unused-vars */
import { address, Address } from "@solana/kit"
import * as types from "../types"
import * as borsh from "../utils/borsh"
import { borshAddress } from "../utils"
/* eslint-enable @typescript-eslint/no-unused-vars */
export interface RewardPerTimeUnitPointFields {
  tsStart: bigint
  rewardPerTimeUnit: bigint
}

export interface RewardPerTimeUnitPointJSON {
  tsStart: string
  rewardPerTimeUnit: string
}

export class RewardPerTimeUnitPoint {
  readonly tsStart: bigint
  readonly rewardPerTimeUnit: bigint

  constructor(fields: RewardPerTimeUnitPointFields) {
    this.tsStart = fields.tsStart
    this.rewardPerTimeUnit = fields.rewardPerTimeUnit
  }

  static layout(property?: string) {
    return borsh.struct(
      [borsh.u64("tsStart"), borsh.u64("rewardPerTimeUnit")],
      property
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromDecoded(obj: any) {
    return new RewardPerTimeUnitPoint({
      tsStart: obj.tsStart,
      rewardPerTimeUnit: obj.rewardPerTimeUnit,
    })
  }

  static toEncodable(fields: RewardPerTimeUnitPointFields) {
    return {
      tsStart: fields.tsStart,
      rewardPerTimeUnit: fields.rewardPerTimeUnit,
    }
  }

  toJSON(): RewardPerTimeUnitPointJSON {
    return {
      tsStart: this.tsStart.toString(),
      rewardPerTimeUnit: this.rewardPerTimeUnit.toString(),
    }
  }

  static fromJSON(obj: RewardPerTimeUnitPointJSON): RewardPerTimeUnitPoint {
    return new RewardPerTimeUnitPoint({
      tsStart: BigInt(obj.tsStart),
      rewardPerTimeUnit: BigInt(obj.rewardPerTimeUnit),
    })
  }

  toEncodable() {
    return RewardPerTimeUnitPoint.toEncodable(this)
  }
}
