import { address, Address } from "@solana/kit" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh"
import { borshAddress } from "../utils"

export interface RewardInfoFields {
  token: types.TokenInfoFields
  rewardsVault: Address
  rewardsAvailable: BN
  rewardScheduleCurve: types.RewardScheduleCurveFields
  minClaimDurationSeconds: BN
  lastIssuanceTs: BN
  rewardsIssuedUnclaimed: BN
  rewardsIssuedCumulative: BN
  rewardPerShareScaled: BN
  placeholder0: BN
  rewardType: number
  rewardsPerSecondDecimals: number
  padding0: Array<number>
  padding1: Array<BN>
}

export interface RewardInfoJSON {
  token: types.TokenInfoJSON
  rewardsVault: string
  rewardsAvailable: string
  rewardScheduleCurve: types.RewardScheduleCurveJSON
  minClaimDurationSeconds: string
  lastIssuanceTs: string
  rewardsIssuedUnclaimed: string
  rewardsIssuedCumulative: string
  rewardPerShareScaled: string
  placeholder0: string
  rewardType: number
  rewardsPerSecondDecimals: number
  padding0: Array<number>
  padding1: Array<string>
}

export class RewardInfo {
  readonly token: types.TokenInfo
  readonly rewardsVault: Address
  readonly rewardsAvailable: BN
  readonly rewardScheduleCurve: types.RewardScheduleCurve
  readonly minClaimDurationSeconds: BN
  readonly lastIssuanceTs: BN
  readonly rewardsIssuedUnclaimed: BN
  readonly rewardsIssuedCumulative: BN
  readonly rewardPerShareScaled: BN
  readonly placeholder0: BN
  readonly rewardType: number
  readonly rewardsPerSecondDecimals: number
  readonly padding0: Array<number>
  readonly padding1: Array<BN>

  constructor(fields: RewardInfoFields) {
    this.token = new types.TokenInfo({ ...fields.token })
    this.rewardsVault = fields.rewardsVault
    this.rewardsAvailable = fields.rewardsAvailable
    this.rewardScheduleCurve = new types.RewardScheduleCurve({
      ...fields.rewardScheduleCurve,
    })
    this.minClaimDurationSeconds = fields.minClaimDurationSeconds
    this.lastIssuanceTs = fields.lastIssuanceTs
    this.rewardsIssuedUnclaimed = fields.rewardsIssuedUnclaimed
    this.rewardsIssuedCumulative = fields.rewardsIssuedCumulative
    this.rewardPerShareScaled = fields.rewardPerShareScaled
    this.placeholder0 = fields.placeholder0
    this.rewardType = fields.rewardType
    this.rewardsPerSecondDecimals = fields.rewardsPerSecondDecimals
    this.padding0 = fields.padding0
    this.padding1 = fields.padding1
  }

  static layout(property?: string) {
    return borsh.struct(
      [
        types.TokenInfo.layout("token"),
        borshAddress("rewardsVault"),
        borsh.u64("rewardsAvailable"),
        types.RewardScheduleCurve.layout("rewardScheduleCurve"),
        borsh.u64("minClaimDurationSeconds"),
        borsh.u64("lastIssuanceTs"),
        borsh.u64("rewardsIssuedUnclaimed"),
        borsh.u64("rewardsIssuedCumulative"),
        borsh.u128("rewardPerShareScaled"),
        borsh.u64("placeholder0"),
        borsh.u8("rewardType"),
        borsh.u8("rewardsPerSecondDecimals"),
        borsh.array(borsh.u8(), 6, "padding0"),
        borsh.array(borsh.u64(), 20, "padding1"),
      ],
      property
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromDecoded(obj: any) {
    return new RewardInfo({
      token: types.TokenInfo.fromDecoded(obj.token),
      rewardsVault: obj.rewardsVault,
      rewardsAvailable: obj.rewardsAvailable,
      rewardScheduleCurve: types.RewardScheduleCurve.fromDecoded(
        obj.rewardScheduleCurve
      ),
      minClaimDurationSeconds: obj.minClaimDurationSeconds,
      lastIssuanceTs: obj.lastIssuanceTs,
      rewardsIssuedUnclaimed: obj.rewardsIssuedUnclaimed,
      rewardsIssuedCumulative: obj.rewardsIssuedCumulative,
      rewardPerShareScaled: obj.rewardPerShareScaled,
      placeholder0: obj.placeholder0,
      rewardType: obj.rewardType,
      rewardsPerSecondDecimals: obj.rewardsPerSecondDecimals,
      padding0: obj.padding0,
      padding1: obj.padding1,
    })
  }

  static toEncodable(fields: RewardInfoFields) {
    return {
      token: types.TokenInfo.toEncodable(fields.token),
      rewardsVault: fields.rewardsVault,
      rewardsAvailable: fields.rewardsAvailable,
      rewardScheduleCurve: types.RewardScheduleCurve.toEncodable(
        fields.rewardScheduleCurve
      ),
      minClaimDurationSeconds: fields.minClaimDurationSeconds,
      lastIssuanceTs: fields.lastIssuanceTs,
      rewardsIssuedUnclaimed: fields.rewardsIssuedUnclaimed,
      rewardsIssuedCumulative: fields.rewardsIssuedCumulative,
      rewardPerShareScaled: fields.rewardPerShareScaled,
      placeholder0: fields.placeholder0,
      rewardType: fields.rewardType,
      rewardsPerSecondDecimals: fields.rewardsPerSecondDecimals,
      padding0: fields.padding0,
      padding1: fields.padding1,
    }
  }

  toJSON(): RewardInfoJSON {
    return {
      token: this.token.toJSON(),
      rewardsVault: this.rewardsVault,
      rewardsAvailable: this.rewardsAvailable.toString(),
      rewardScheduleCurve: this.rewardScheduleCurve.toJSON(),
      minClaimDurationSeconds: this.minClaimDurationSeconds.toString(),
      lastIssuanceTs: this.lastIssuanceTs.toString(),
      rewardsIssuedUnclaimed: this.rewardsIssuedUnclaimed.toString(),
      rewardsIssuedCumulative: this.rewardsIssuedCumulative.toString(),
      rewardPerShareScaled: this.rewardPerShareScaled.toString(),
      placeholder0: this.placeholder0.toString(),
      rewardType: this.rewardType,
      rewardsPerSecondDecimals: this.rewardsPerSecondDecimals,
      padding0: this.padding0,
      padding1: this.padding1.map((item) => item.toString()),
    }
  }

  static fromJSON(obj: RewardInfoJSON): RewardInfo {
    return new RewardInfo({
      token: types.TokenInfo.fromJSON(obj.token),
      rewardsVault: address(obj.rewardsVault),
      rewardsAvailable: new BN(obj.rewardsAvailable),
      rewardScheduleCurve: types.RewardScheduleCurve.fromJSON(
        obj.rewardScheduleCurve
      ),
      minClaimDurationSeconds: new BN(obj.minClaimDurationSeconds),
      lastIssuanceTs: new BN(obj.lastIssuanceTs),
      rewardsIssuedUnclaimed: new BN(obj.rewardsIssuedUnclaimed),
      rewardsIssuedCumulative: new BN(obj.rewardsIssuedCumulative),
      rewardPerShareScaled: new BN(obj.rewardPerShareScaled),
      placeholder0: new BN(obj.placeholder0),
      rewardType: obj.rewardType,
      rewardsPerSecondDecimals: obj.rewardsPerSecondDecimals,
      padding0: obj.padding0,
      padding1: obj.padding1.map((item) => new BN(item)),
    })
  }

  toEncodable() {
    return RewardInfo.toEncodable(this)
  }
}
