import * as FarmConfigOption from "./FarmConfigOption"
import * as GlobalConfigOption from "./GlobalConfigOption"
import * as LockingMode from "./LockingMode"
import * as RewardType from "./RewardType"
import * as TimeUnit from "./TimeUnit"

export { FarmConfigOption }

export type FarmConfigOptionKind =
  | FarmConfigOption.UpdateRewardRps
  | FarmConfigOption.UpdateRewardMinClaimDuration
  | FarmConfigOption.WithdrawAuthority
  | FarmConfigOption.DepositWarmupPeriod
  | FarmConfigOption.WithdrawCooldownPeriod
  | FarmConfigOption.RewardType
  | FarmConfigOption.RpsDecimals
  | FarmConfigOption.LockingMode
  | FarmConfigOption.LockingStartTimestamp
  | FarmConfigOption.LockingDuration
  | FarmConfigOption.LockingEarlyWithdrawalPenaltyBps
  | FarmConfigOption.DepositCapAmount
  | FarmConfigOption.SlashedAmountSpillAddress
  | FarmConfigOption.ScopePricesAccount
  | FarmConfigOption.ScopeOraclePriceId
  | FarmConfigOption.ScopeOracleMaxAge
  | FarmConfigOption.UpdateRewardScheduleCurvePoints
  | FarmConfigOption.UpdatePendingFarmAdmin
  | FarmConfigOption.UpdateStrategyId
  | FarmConfigOption.UpdateDelegatedRpsAdmin
  | FarmConfigOption.UpdateVaultId
  | FarmConfigOption.UpdateExtraDelegatedAuthority
export type FarmConfigOptionJSON =
  | FarmConfigOption.UpdateRewardRpsJSON
  | FarmConfigOption.UpdateRewardMinClaimDurationJSON
  | FarmConfigOption.WithdrawAuthorityJSON
  | FarmConfigOption.DepositWarmupPeriodJSON
  | FarmConfigOption.WithdrawCooldownPeriodJSON
  | FarmConfigOption.RewardTypeJSON
  | FarmConfigOption.RpsDecimalsJSON
  | FarmConfigOption.LockingModeJSON
  | FarmConfigOption.LockingStartTimestampJSON
  | FarmConfigOption.LockingDurationJSON
  | FarmConfigOption.LockingEarlyWithdrawalPenaltyBpsJSON
  | FarmConfigOption.DepositCapAmountJSON
  | FarmConfigOption.SlashedAmountSpillAddressJSON
  | FarmConfigOption.ScopePricesAccountJSON
  | FarmConfigOption.ScopeOraclePriceIdJSON
  | FarmConfigOption.ScopeOracleMaxAgeJSON
  | FarmConfigOption.UpdateRewardScheduleCurvePointsJSON
  | FarmConfigOption.UpdatePendingFarmAdminJSON
  | FarmConfigOption.UpdateStrategyIdJSON
  | FarmConfigOption.UpdateDelegatedRpsAdminJSON
  | FarmConfigOption.UpdateVaultIdJSON
  | FarmConfigOption.UpdateExtraDelegatedAuthorityJSON

export { GlobalConfigOption }

export type GlobalConfigOptionKind =
  | GlobalConfigOption.SetPendingGlobalAdmin
  | GlobalConfigOption.SetTreasuryFeeBps
export type GlobalConfigOptionJSON =
  | GlobalConfigOption.SetPendingGlobalAdminJSON
  | GlobalConfigOption.SetTreasuryFeeBpsJSON

export { LockingMode }

export type LockingModeKind =
  | LockingMode.None
  | LockingMode.Continuous
  | LockingMode.WithExpiry
export type LockingModeJSON =
  | LockingMode.NoneJSON
  | LockingMode.ContinuousJSON
  | LockingMode.WithExpiryJSON

export { RewardInfo } from "./RewardInfo"
export type { RewardInfoFields, RewardInfoJSON } from "./RewardInfo"
export { RewardPerTimeUnitPoint } from "./RewardPerTimeUnitPoint"
export type {
  RewardPerTimeUnitPointFields,
  RewardPerTimeUnitPointJSON,
} from "./RewardPerTimeUnitPoint"
export { RewardScheduleCurve } from "./RewardScheduleCurve"
export type {
  RewardScheduleCurveFields,
  RewardScheduleCurveJSON,
} from "./RewardScheduleCurve"
export { RewardType }

export type RewardTypeKind = RewardType.Proportional | RewardType.Constant
export type RewardTypeJSON =
  | RewardType.ProportionalJSON
  | RewardType.ConstantJSON

export { TimeUnit }

export type TimeUnitKind = TimeUnit.Seconds | TimeUnit.Slots
export type TimeUnitJSON = TimeUnit.SecondsJSON | TimeUnit.SlotsJSON

export { TokenInfo } from "./TokenInfo"
export type { TokenInfoFields, TokenInfoJSON } from "./TokenInfo"
export { DatedPrice } from "./DatedPrice"
export type { DatedPriceFields, DatedPriceJSON } from "./DatedPrice"
export { Price } from "./Price"
export type { PriceFields, PriceJSON } from "./Price"
