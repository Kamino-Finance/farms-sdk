import { address, Address } from "@solana/kit" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh"
import { borshAddress } from "../utils"

export interface UpdateRewardRpsJSON {
  kind: "UpdateRewardRps"
}

export class UpdateRewardRps {
  static readonly discriminator = 0
  static readonly kind = "UpdateRewardRps"
  readonly discriminator = 0
  readonly kind = "UpdateRewardRps"

  toJSON(): UpdateRewardRpsJSON {
    return {
      kind: "UpdateRewardRps",
    }
  }

  toEncodable() {
    return {
      UpdateRewardRps: {},
    }
  }
}

export interface UpdateRewardMinClaimDurationJSON {
  kind: "UpdateRewardMinClaimDuration"
}

export class UpdateRewardMinClaimDuration {
  static readonly discriminator = 1
  static readonly kind = "UpdateRewardMinClaimDuration"
  readonly discriminator = 1
  readonly kind = "UpdateRewardMinClaimDuration"

  toJSON(): UpdateRewardMinClaimDurationJSON {
    return {
      kind: "UpdateRewardMinClaimDuration",
    }
  }

  toEncodable() {
    return {
      UpdateRewardMinClaimDuration: {},
    }
  }
}

export interface WithdrawAuthorityJSON {
  kind: "WithdrawAuthority"
}

export class WithdrawAuthority {
  static readonly discriminator = 2
  static readonly kind = "WithdrawAuthority"
  readonly discriminator = 2
  readonly kind = "WithdrawAuthority"

  toJSON(): WithdrawAuthorityJSON {
    return {
      kind: "WithdrawAuthority",
    }
  }

  toEncodable() {
    return {
      WithdrawAuthority: {},
    }
  }
}

export interface DepositWarmupPeriodJSON {
  kind: "DepositWarmupPeriod"
}

export class DepositWarmupPeriod {
  static readonly discriminator = 3
  static readonly kind = "DepositWarmupPeriod"
  readonly discriminator = 3
  readonly kind = "DepositWarmupPeriod"

  toJSON(): DepositWarmupPeriodJSON {
    return {
      kind: "DepositWarmupPeriod",
    }
  }

  toEncodable() {
    return {
      DepositWarmupPeriod: {},
    }
  }
}

export interface WithdrawCooldownPeriodJSON {
  kind: "WithdrawCooldownPeriod"
}

export class WithdrawCooldownPeriod {
  static readonly discriminator = 4
  static readonly kind = "WithdrawCooldownPeriod"
  readonly discriminator = 4
  readonly kind = "WithdrawCooldownPeriod"

  toJSON(): WithdrawCooldownPeriodJSON {
    return {
      kind: "WithdrawCooldownPeriod",
    }
  }

  toEncodable() {
    return {
      WithdrawCooldownPeriod: {},
    }
  }
}

export interface RewardTypeJSON {
  kind: "RewardType"
}

export class RewardType {
  static readonly discriminator = 5
  static readonly kind = "RewardType"
  readonly discriminator = 5
  readonly kind = "RewardType"

  toJSON(): RewardTypeJSON {
    return {
      kind: "RewardType",
    }
  }

  toEncodable() {
    return {
      RewardType: {},
    }
  }
}

export interface RpsDecimalsJSON {
  kind: "RpsDecimals"
}

export class RpsDecimals {
  static readonly discriminator = 6
  static readonly kind = "RpsDecimals"
  readonly discriminator = 6
  readonly kind = "RpsDecimals"

  toJSON(): RpsDecimalsJSON {
    return {
      kind: "RpsDecimals",
    }
  }

  toEncodable() {
    return {
      RpsDecimals: {},
    }
  }
}

export interface LockingModeJSON {
  kind: "LockingMode"
}

export class LockingMode {
  static readonly discriminator = 7
  static readonly kind = "LockingMode"
  readonly discriminator = 7
  readonly kind = "LockingMode"

  toJSON(): LockingModeJSON {
    return {
      kind: "LockingMode",
    }
  }

  toEncodable() {
    return {
      LockingMode: {},
    }
  }
}

export interface LockingStartTimestampJSON {
  kind: "LockingStartTimestamp"
}

export class LockingStartTimestamp {
  static readonly discriminator = 8
  static readonly kind = "LockingStartTimestamp"
  readonly discriminator = 8
  readonly kind = "LockingStartTimestamp"

  toJSON(): LockingStartTimestampJSON {
    return {
      kind: "LockingStartTimestamp",
    }
  }

  toEncodable() {
    return {
      LockingStartTimestamp: {},
    }
  }
}

export interface LockingDurationJSON {
  kind: "LockingDuration"
}

export class LockingDuration {
  static readonly discriminator = 9
  static readonly kind = "LockingDuration"
  readonly discriminator = 9
  readonly kind = "LockingDuration"

  toJSON(): LockingDurationJSON {
    return {
      kind: "LockingDuration",
    }
  }

  toEncodable() {
    return {
      LockingDuration: {},
    }
  }
}

export interface LockingEarlyWithdrawalPenaltyBpsJSON {
  kind: "LockingEarlyWithdrawalPenaltyBps"
}

export class LockingEarlyWithdrawalPenaltyBps {
  static readonly discriminator = 10
  static readonly kind = "LockingEarlyWithdrawalPenaltyBps"
  readonly discriminator = 10
  readonly kind = "LockingEarlyWithdrawalPenaltyBps"

  toJSON(): LockingEarlyWithdrawalPenaltyBpsJSON {
    return {
      kind: "LockingEarlyWithdrawalPenaltyBps",
    }
  }

  toEncodable() {
    return {
      LockingEarlyWithdrawalPenaltyBps: {},
    }
  }
}

export interface DepositCapAmountJSON {
  kind: "DepositCapAmount"
}

export class DepositCapAmount {
  static readonly discriminator = 11
  static readonly kind = "DepositCapAmount"
  readonly discriminator = 11
  readonly kind = "DepositCapAmount"

  toJSON(): DepositCapAmountJSON {
    return {
      kind: "DepositCapAmount",
    }
  }

  toEncodable() {
    return {
      DepositCapAmount: {},
    }
  }
}

export interface SlashedAmountSpillAddressJSON {
  kind: "SlashedAmountSpillAddress"
}

export class SlashedAmountSpillAddress {
  static readonly discriminator = 12
  static readonly kind = "SlashedAmountSpillAddress"
  readonly discriminator = 12
  readonly kind = "SlashedAmountSpillAddress"

  toJSON(): SlashedAmountSpillAddressJSON {
    return {
      kind: "SlashedAmountSpillAddress",
    }
  }

  toEncodable() {
    return {
      SlashedAmountSpillAddress: {},
    }
  }
}

export interface ScopePricesAccountJSON {
  kind: "ScopePricesAccount"
}

export class ScopePricesAccount {
  static readonly discriminator = 13
  static readonly kind = "ScopePricesAccount"
  readonly discriminator = 13
  readonly kind = "ScopePricesAccount"

  toJSON(): ScopePricesAccountJSON {
    return {
      kind: "ScopePricesAccount",
    }
  }

  toEncodable() {
    return {
      ScopePricesAccount: {},
    }
  }
}

export interface ScopeOraclePriceIdJSON {
  kind: "ScopeOraclePriceId"
}

export class ScopeOraclePriceId {
  static readonly discriminator = 14
  static readonly kind = "ScopeOraclePriceId"
  readonly discriminator = 14
  readonly kind = "ScopeOraclePriceId"

  toJSON(): ScopeOraclePriceIdJSON {
    return {
      kind: "ScopeOraclePriceId",
    }
  }

  toEncodable() {
    return {
      ScopeOraclePriceId: {},
    }
  }
}

export interface ScopeOracleMaxAgeJSON {
  kind: "ScopeOracleMaxAge"
}

export class ScopeOracleMaxAge {
  static readonly discriminator = 15
  static readonly kind = "ScopeOracleMaxAge"
  readonly discriminator = 15
  readonly kind = "ScopeOracleMaxAge"

  toJSON(): ScopeOracleMaxAgeJSON {
    return {
      kind: "ScopeOracleMaxAge",
    }
  }

  toEncodable() {
    return {
      ScopeOracleMaxAge: {},
    }
  }
}

export interface UpdateRewardScheduleCurvePointsJSON {
  kind: "UpdateRewardScheduleCurvePoints"
}

export class UpdateRewardScheduleCurvePoints {
  static readonly discriminator = 16
  static readonly kind = "UpdateRewardScheduleCurvePoints"
  readonly discriminator = 16
  readonly kind = "UpdateRewardScheduleCurvePoints"

  toJSON(): UpdateRewardScheduleCurvePointsJSON {
    return {
      kind: "UpdateRewardScheduleCurvePoints",
    }
  }

  toEncodable() {
    return {
      UpdateRewardScheduleCurvePoints: {},
    }
  }
}

export interface UpdatePendingFarmAdminJSON {
  kind: "UpdatePendingFarmAdmin"
}

export class UpdatePendingFarmAdmin {
  static readonly discriminator = 17
  static readonly kind = "UpdatePendingFarmAdmin"
  readonly discriminator = 17
  readonly kind = "UpdatePendingFarmAdmin"

  toJSON(): UpdatePendingFarmAdminJSON {
    return {
      kind: "UpdatePendingFarmAdmin",
    }
  }

  toEncodable() {
    return {
      UpdatePendingFarmAdmin: {},
    }
  }
}

export interface UpdateStrategyIdJSON {
  kind: "UpdateStrategyId"
}

export class UpdateStrategyId {
  static readonly discriminator = 18
  static readonly kind = "UpdateStrategyId"
  readonly discriminator = 18
  readonly kind = "UpdateStrategyId"

  toJSON(): UpdateStrategyIdJSON {
    return {
      kind: "UpdateStrategyId",
    }
  }

  toEncodable() {
    return {
      UpdateStrategyId: {},
    }
  }
}

export interface UpdateDelegatedRpsAdminJSON {
  kind: "UpdateDelegatedRpsAdmin"
}

export class UpdateDelegatedRpsAdmin {
  static readonly discriminator = 19
  static readonly kind = "UpdateDelegatedRpsAdmin"
  readonly discriminator = 19
  readonly kind = "UpdateDelegatedRpsAdmin"

  toJSON(): UpdateDelegatedRpsAdminJSON {
    return {
      kind: "UpdateDelegatedRpsAdmin",
    }
  }

  toEncodable() {
    return {
      UpdateDelegatedRpsAdmin: {},
    }
  }
}

export interface UpdateVaultIdJSON {
  kind: "UpdateVaultId"
}

export class UpdateVaultId {
  static readonly discriminator = 20
  static readonly kind = "UpdateVaultId"
  readonly discriminator = 20
  readonly kind = "UpdateVaultId"

  toJSON(): UpdateVaultIdJSON {
    return {
      kind: "UpdateVaultId",
    }
  }

  toEncodable() {
    return {
      UpdateVaultId: {},
    }
  }
}

export interface UpdateExtraDelegatedAuthorityJSON {
  kind: "UpdateExtraDelegatedAuthority"
}

export class UpdateExtraDelegatedAuthority {
  static readonly discriminator = 21
  static readonly kind = "UpdateExtraDelegatedAuthority"
  readonly discriminator = 21
  readonly kind = "UpdateExtraDelegatedAuthority"

  toJSON(): UpdateExtraDelegatedAuthorityJSON {
    return {
      kind: "UpdateExtraDelegatedAuthority",
    }
  }

  toEncodable() {
    return {
      UpdateExtraDelegatedAuthority: {},
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fromDecoded(obj: any): types.FarmConfigOptionKind {
  if (typeof obj !== "object") {
    throw new Error("Invalid enum object")
  }

  if ("UpdateRewardRps" in obj) {
    return new UpdateRewardRps()
  }
  if ("UpdateRewardMinClaimDuration" in obj) {
    return new UpdateRewardMinClaimDuration()
  }
  if ("WithdrawAuthority" in obj) {
    return new WithdrawAuthority()
  }
  if ("DepositWarmupPeriod" in obj) {
    return new DepositWarmupPeriod()
  }
  if ("WithdrawCooldownPeriod" in obj) {
    return new WithdrawCooldownPeriod()
  }
  if ("RewardType" in obj) {
    return new RewardType()
  }
  if ("RpsDecimals" in obj) {
    return new RpsDecimals()
  }
  if ("LockingMode" in obj) {
    return new LockingMode()
  }
  if ("LockingStartTimestamp" in obj) {
    return new LockingStartTimestamp()
  }
  if ("LockingDuration" in obj) {
    return new LockingDuration()
  }
  if ("LockingEarlyWithdrawalPenaltyBps" in obj) {
    return new LockingEarlyWithdrawalPenaltyBps()
  }
  if ("DepositCapAmount" in obj) {
    return new DepositCapAmount()
  }
  if ("SlashedAmountSpillAddress" in obj) {
    return new SlashedAmountSpillAddress()
  }
  if ("ScopePricesAccount" in obj) {
    return new ScopePricesAccount()
  }
  if ("ScopeOraclePriceId" in obj) {
    return new ScopeOraclePriceId()
  }
  if ("ScopeOracleMaxAge" in obj) {
    return new ScopeOracleMaxAge()
  }
  if ("UpdateRewardScheduleCurvePoints" in obj) {
    return new UpdateRewardScheduleCurvePoints()
  }
  if ("UpdatePendingFarmAdmin" in obj) {
    return new UpdatePendingFarmAdmin()
  }
  if ("UpdateStrategyId" in obj) {
    return new UpdateStrategyId()
  }
  if ("UpdateDelegatedRpsAdmin" in obj) {
    return new UpdateDelegatedRpsAdmin()
  }
  if ("UpdateVaultId" in obj) {
    return new UpdateVaultId()
  }
  if ("UpdateExtraDelegatedAuthority" in obj) {
    return new UpdateExtraDelegatedAuthority()
  }

  throw new Error("Invalid enum object")
}

export function fromJSON(
  obj: types.FarmConfigOptionJSON
): types.FarmConfigOptionKind {
  switch (obj.kind) {
    case "UpdateRewardRps": {
      return new UpdateRewardRps()
    }
    case "UpdateRewardMinClaimDuration": {
      return new UpdateRewardMinClaimDuration()
    }
    case "WithdrawAuthority": {
      return new WithdrawAuthority()
    }
    case "DepositWarmupPeriod": {
      return new DepositWarmupPeriod()
    }
    case "WithdrawCooldownPeriod": {
      return new WithdrawCooldownPeriod()
    }
    case "RewardType": {
      return new RewardType()
    }
    case "RpsDecimals": {
      return new RpsDecimals()
    }
    case "LockingMode": {
      return new LockingMode()
    }
    case "LockingStartTimestamp": {
      return new LockingStartTimestamp()
    }
    case "LockingDuration": {
      return new LockingDuration()
    }
    case "LockingEarlyWithdrawalPenaltyBps": {
      return new LockingEarlyWithdrawalPenaltyBps()
    }
    case "DepositCapAmount": {
      return new DepositCapAmount()
    }
    case "SlashedAmountSpillAddress": {
      return new SlashedAmountSpillAddress()
    }
    case "ScopePricesAccount": {
      return new ScopePricesAccount()
    }
    case "ScopeOraclePriceId": {
      return new ScopeOraclePriceId()
    }
    case "ScopeOracleMaxAge": {
      return new ScopeOracleMaxAge()
    }
    case "UpdateRewardScheduleCurvePoints": {
      return new UpdateRewardScheduleCurvePoints()
    }
    case "UpdatePendingFarmAdmin": {
      return new UpdatePendingFarmAdmin()
    }
    case "UpdateStrategyId": {
      return new UpdateStrategyId()
    }
    case "UpdateDelegatedRpsAdmin": {
      return new UpdateDelegatedRpsAdmin()
    }
    case "UpdateVaultId": {
      return new UpdateVaultId()
    }
    case "UpdateExtraDelegatedAuthority": {
      return new UpdateExtraDelegatedAuthority()
    }
  }
}

export function layout(property?: string) {
  const ret = borsh.rustEnum([
    borsh.struct([], "UpdateRewardRps"),
    borsh.struct([], "UpdateRewardMinClaimDuration"),
    borsh.struct([], "WithdrawAuthority"),
    borsh.struct([], "DepositWarmupPeriod"),
    borsh.struct([], "WithdrawCooldownPeriod"),
    borsh.struct([], "RewardType"),
    borsh.struct([], "RpsDecimals"),
    borsh.struct([], "LockingMode"),
    borsh.struct([], "LockingStartTimestamp"),
    borsh.struct([], "LockingDuration"),
    borsh.struct([], "LockingEarlyWithdrawalPenaltyBps"),
    borsh.struct([], "DepositCapAmount"),
    borsh.struct([], "SlashedAmountSpillAddress"),
    borsh.struct([], "ScopePricesAccount"),
    borsh.struct([], "ScopeOraclePriceId"),
    borsh.struct([], "ScopeOracleMaxAge"),
    borsh.struct([], "UpdateRewardScheduleCurvePoints"),
    borsh.struct([], "UpdatePendingFarmAdmin"),
    borsh.struct([], "UpdateStrategyId"),
    borsh.struct([], "UpdateDelegatedRpsAdmin"),
    borsh.struct([], "UpdateVaultId"),
    borsh.struct([], "UpdateExtraDelegatedAuthority"),
  ])
  if (property !== undefined) {
    return ret.replicate(property)
  }
  return ret
}
