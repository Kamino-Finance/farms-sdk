import { address, Address } from "@solana/kit" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh"
import { borshAddress } from "../utils"

export interface RewardScheduleCurveFields {
  /**
   * This is a stepwise function, meaning that each point represents
   * how many rewards are issued per time unit since the beginning
   * of that point until the beginning of the next point.
   * This is not a linear curve, there is no interpolation going on.
   * A curve can be [[t0, 100], [t1, 50], [t2, 0]]
   * meaning that from t0 to t1, 100 rewards are issued per time unit,
   * from t1 to t2, 50 rewards are issued per time unit, and after t2 it stops
   * Another curve, can be [[t0, 100], [u64::max, 0]]
   * meaning that from t0 to u64::max, 100 rewards are issued per time unit
   */
  points: Array<types.RewardPerTimeUnitPointFields>
}

export interface RewardScheduleCurveJSON {
  /**
   * This is a stepwise function, meaning that each point represents
   * how many rewards are issued per time unit since the beginning
   * of that point until the beginning of the next point.
   * This is not a linear curve, there is no interpolation going on.
   * A curve can be [[t0, 100], [t1, 50], [t2, 0]]
   * meaning that from t0 to t1, 100 rewards are issued per time unit,
   * from t1 to t2, 50 rewards are issued per time unit, and after t2 it stops
   * Another curve, can be [[t0, 100], [u64::max, 0]]
   * meaning that from t0 to u64::max, 100 rewards are issued per time unit
   */
  points: Array<types.RewardPerTimeUnitPointJSON>
}

export class RewardScheduleCurve {
  /**
   * This is a stepwise function, meaning that each point represents
   * how many rewards are issued per time unit since the beginning
   * of that point until the beginning of the next point.
   * This is not a linear curve, there is no interpolation going on.
   * A curve can be [[t0, 100], [t1, 50], [t2, 0]]
   * meaning that from t0 to t1, 100 rewards are issued per time unit,
   * from t1 to t2, 50 rewards are issued per time unit, and after t2 it stops
   * Another curve, can be [[t0, 100], [u64::max, 0]]
   * meaning that from t0 to u64::max, 100 rewards are issued per time unit
   */
  readonly points: Array<types.RewardPerTimeUnitPoint>

  constructor(fields: RewardScheduleCurveFields) {
    this.points = fields.points.map(
      (item) => new types.RewardPerTimeUnitPoint({ ...item })
    )
  }

  static layout(property?: string) {
    return borsh.struct(
      [borsh.array(types.RewardPerTimeUnitPoint.layout(), 20, "points")],
      property
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromDecoded(obj: any) {
    return new RewardScheduleCurve({
      points: obj.points.map(
        (
          item: any /* eslint-disable-line @typescript-eslint/no-explicit-any */
        ) => types.RewardPerTimeUnitPoint.fromDecoded(item)
      ),
    })
  }

  static toEncodable(fields: RewardScheduleCurveFields) {
    return {
      points: fields.points.map((item) =>
        types.RewardPerTimeUnitPoint.toEncodable(item)
      ),
    }
  }

  toJSON(): RewardScheduleCurveJSON {
    return {
      points: this.points.map((item) => item.toJSON()),
    }
  }

  static fromJSON(obj: RewardScheduleCurveJSON): RewardScheduleCurve {
    return new RewardScheduleCurve({
      points: obj.points.map((item) =>
        types.RewardPerTimeUnitPoint.fromJSON(item)
      ),
    })
  }

  toEncodable() {
    return RewardScheduleCurve.toEncodable(this)
  }
}
