/* eslint-disable @typescript-eslint/no-unused-vars */
import { address, Address } from "@solana/kit"
import * as types from "../types"
import * as borsh from "../utils/borsh"
import { borshAddress } from "../utils"
/* eslint-enable @typescript-eslint/no-unused-vars */
export interface SecondsJSON {
  kind: "Seconds"
}

export class Seconds {
  static readonly discriminator = 0
  static readonly kind = "Seconds"
  readonly discriminator = 0
  readonly kind = "Seconds"

  toJSON(): SecondsJSON {
    return {
      kind: "Seconds",
    }
  }

  toEncodable() {
    return {
      Seconds: {},
    }
  }
}

export interface SlotsJSON {
  kind: "Slots"
}

export class Slots {
  static readonly discriminator = 1
  static readonly kind = "Slots"
  readonly discriminator = 1
  readonly kind = "Slots"

  toJSON(): SlotsJSON {
    return {
      kind: "Slots",
    }
  }

  toEncodable() {
    return {
      Slots: {},
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fromDecoded(obj: any): types.TimeUnitKind {
  if (typeof obj !== "object") {
    throw new Error("Invalid enum object")
  }

  if ("Seconds" in obj) {
    return new Seconds()
  }
  if ("Slots" in obj) {
    return new Slots()
  }

  throw new Error("Invalid enum object")
}

export function fromJSON(obj: types.TimeUnitJSON): types.TimeUnitKind {
  switch (obj.kind) {
    case "Seconds": {
      return new Seconds()
    }
    case "Slots": {
      return new Slots()
    }
  }
}

export function layout(property?: string) {
  const ret = borsh.rustEnum([
    borsh.struct([], "Seconds"),
    borsh.struct([], "Slots"),
  ])
  if (property !== undefined) {
    return ret.replicate(property)
  }
  return ret
}
