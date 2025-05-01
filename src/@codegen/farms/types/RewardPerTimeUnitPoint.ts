import { address, Address } from "@solana/kit" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh"
import { borshAddress } from "../utils"

export interface RewardPerTimeUnitPointFields {
  tsStart: BN
  rewardPerTimeUnit: BN
}

export interface RewardPerTimeUnitPointJSON {
  tsStart: string
  rewardPerTimeUnit: string
}

export class RewardPerTimeUnitPoint {
  readonly tsStart: BN
  readonly rewardPerTimeUnit: BN

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
      tsStart: new BN(obj.tsStart),
      rewardPerTimeUnit: new BN(obj.rewardPerTimeUnit),
    })
  }

  toEncodable() {
    return RewardPerTimeUnitPoint.toEncodable(this)
  }
}
