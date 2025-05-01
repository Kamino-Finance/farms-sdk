import { address, Address } from "@solana/kit" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh"
import { borshAddress } from "../utils"

export interface ProportionalJSON {
  kind: "Proportional"
}

export class Proportional {
  static readonly discriminator = 0
  static readonly kind = "Proportional"
  readonly discriminator = 0
  readonly kind = "Proportional"

  toJSON(): ProportionalJSON {
    return {
      kind: "Proportional",
    }
  }

  toEncodable() {
    return {
      Proportional: {},
    }
  }
}

export interface ConstantJSON {
  kind: "Constant"
}

export class Constant {
  static readonly discriminator = 1
  static readonly kind = "Constant"
  readonly discriminator = 1
  readonly kind = "Constant"

  toJSON(): ConstantJSON {
    return {
      kind: "Constant",
    }
  }

  toEncodable() {
    return {
      Constant: {},
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fromDecoded(obj: any): types.RewardTypeKind {
  if (typeof obj !== "object") {
    throw new Error("Invalid enum object")
  }

  if ("Proportional" in obj) {
    return new Proportional()
  }
  if ("Constant" in obj) {
    return new Constant()
  }

  throw new Error("Invalid enum object")
}

export function fromJSON(obj: types.RewardTypeJSON): types.RewardTypeKind {
  switch (obj.kind) {
    case "Proportional": {
      return new Proportional()
    }
    case "Constant": {
      return new Constant()
    }
  }
}

export function layout(property?: string) {
  const ret = borsh.rustEnum([
    borsh.struct([], "Proportional"),
    borsh.struct([], "Constant"),
  ])
  if (property !== undefined) {
    return ret.replicate(property)
  }
  return ret
}
