/* eslint-disable @typescript-eslint/no-unused-vars */
import { address, Address } from "@solana/kit"
import * as types from "../types"
import * as borsh from "../utils/borsh"
import { borshAddress } from "../utils"
/* eslint-enable @typescript-eslint/no-unused-vars */
export interface NoneJSON {
  kind: "None"
}

export class None {
  static readonly discriminator = 0
  static readonly kind = "None"
  readonly discriminator = 0
  readonly kind = "None"

  toJSON(): NoneJSON {
    return {
      kind: "None",
    }
  }

  toEncodable() {
    return {
      None: {},
    }
  }
}

export interface ContinuousJSON {
  kind: "Continuous"
}

export class Continuous {
  static readonly discriminator = 1
  static readonly kind = "Continuous"
  readonly discriminator = 1
  readonly kind = "Continuous"

  toJSON(): ContinuousJSON {
    return {
      kind: "Continuous",
    }
  }

  toEncodable() {
    return {
      Continuous: {},
    }
  }
}

export interface WithExpiryJSON {
  kind: "WithExpiry"
}

export class WithExpiry {
  static readonly discriminator = 2
  static readonly kind = "WithExpiry"
  readonly discriminator = 2
  readonly kind = "WithExpiry"

  toJSON(): WithExpiryJSON {
    return {
      kind: "WithExpiry",
    }
  }

  toEncodable() {
    return {
      WithExpiry: {},
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fromDecoded(obj: any): types.LockingModeKind {
  if (typeof obj !== "object") {
    throw new Error("Invalid enum object")
  }

  if ("None" in obj) {
    return new None()
  }
  if ("Continuous" in obj) {
    return new Continuous()
  }
  if ("WithExpiry" in obj) {
    return new WithExpiry()
  }

  throw new Error("Invalid enum object")
}

export function fromJSON(obj: types.LockingModeJSON): types.LockingModeKind {
  switch (obj.kind) {
    case "None": {
      return new None()
    }
    case "Continuous": {
      return new Continuous()
    }
    case "WithExpiry": {
      return new WithExpiry()
    }
  }
}

export function layout(property?: string) {
  const ret = borsh.rustEnum([
    borsh.struct([], "None"),
    borsh.struct([], "Continuous"),
    borsh.struct([], "WithExpiry"),
  ])
  if (property !== undefined) {
    return ret.replicate(property)
  }
  return ret
}
