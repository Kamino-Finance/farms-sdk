import { address, Address } from "@solana/kit" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh"
import { borshAddress } from "../utils"

export interface SetPendingGlobalAdminJSON {
  kind: "SetPendingGlobalAdmin"
}

export class SetPendingGlobalAdmin {
  static readonly discriminator = 0
  static readonly kind = "SetPendingGlobalAdmin"
  readonly discriminator = 0
  readonly kind = "SetPendingGlobalAdmin"

  toJSON(): SetPendingGlobalAdminJSON {
    return {
      kind: "SetPendingGlobalAdmin",
    }
  }

  toEncodable() {
    return {
      SetPendingGlobalAdmin: {},
    }
  }
}

export interface SetTreasuryFeeBpsJSON {
  kind: "SetTreasuryFeeBps"
}

export class SetTreasuryFeeBps {
  static readonly discriminator = 1
  static readonly kind = "SetTreasuryFeeBps"
  readonly discriminator = 1
  readonly kind = "SetTreasuryFeeBps"

  toJSON(): SetTreasuryFeeBpsJSON {
    return {
      kind: "SetTreasuryFeeBps",
    }
  }

  toEncodable() {
    return {
      SetTreasuryFeeBps: {},
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fromDecoded(obj: any): types.GlobalConfigOptionKind {
  if (typeof obj !== "object") {
    throw new Error("Invalid enum object")
  }

  if ("SetPendingGlobalAdmin" in obj) {
    return new SetPendingGlobalAdmin()
  }
  if ("SetTreasuryFeeBps" in obj) {
    return new SetTreasuryFeeBps()
  }

  throw new Error("Invalid enum object")
}

export function fromJSON(
  obj: types.GlobalConfigOptionJSON
): types.GlobalConfigOptionKind {
  switch (obj.kind) {
    case "SetPendingGlobalAdmin": {
      return new SetPendingGlobalAdmin()
    }
    case "SetTreasuryFeeBps": {
      return new SetTreasuryFeeBps()
    }
  }
}

export function layout(property?: string) {
  const ret = borsh.rustEnum([
    borsh.struct([], "SetPendingGlobalAdmin"),
    borsh.struct([], "SetTreasuryFeeBps"),
  ])
  if (property !== undefined) {
    return ret.replicate(property)
  }
  return ret
}
