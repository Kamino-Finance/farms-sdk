export type CustomError =
  | StakeZero
  | UnstakeZero
  | NothingToUnstake
  | NoRewardToHarvest
  | NoRewardInList
  | RewardAlreadyInitialized
  | MaxRewardNumberReached
  | RewardDoesNotExist
  | WrongRewardVaultAccount
  | RewardVaultMismatch
  | RewardVaultAuthorityMismatch
  | NothingStaked
  | IntegerOverflow
  | ConversionFailure
  | UnexpectedAccount
  | OperationForbidden
  | MathOverflow
  | MinClaimDurationNotReached
  | RewardsVaultHasDelegate
  | RewardsVaultHasCloseAuthority
  | FarmVaultHasDelegate
  | FarmVaultHasCloseAuthority
  | RewardsTreasuryVaultHasDelegate
  | RewardsTreasuryVaultHasCloseAuthority
  | UserAtaRewardVaultMintMissmatch
  | UserAtaFarmTokenMintMissmatch
  | TokenFarmTokenMintMissmatch
  | RewardAtaRewardMintMissmatch
  | RewardAtaOwnerNotPayer
  | InvalidGlobalConfigMode
  | RewardIndexOutOfRange
  | NothingToWithdraw
  | UserDelegatedFarmNonDelegatedMissmatch
  | AuthorityFarmDelegateMissmatch
  | FarmNotDelegated
  | FarmDelegated
  | UnstakeNotElapsed
  | PendingWithdrawalNotWithdrawnYet
  | DepositZero
  | InvalidConfigValue
  | InvalidPenaltyPercentage
  | EarlyWithdrawalNotAllowed
  | InvalidLockingTimestamps
  | InvalidRpsCurvePoint
  | InvalidTimestamp
  | DepositCapReached
  | MissingScopePrices
  | ScopeOraclePriceTooOld
  | InvalidOracleConfig
  | CouldNotDeserializeScope
  | RewardAtaOwnerNotAdmin
  | WithdrawRewardZeroAvailable
  | RewardScheduleCurveSet
  | UnsupportedTokenExtension
  | InvalidFarmConfigUpdateAuthority
  | InvalidTransferOwnershipOldOwner
  | InvalidTransferOwnershipFarmState
  | InvalidTransferOwnershipUserStateOwnerDelegatee
  | InvalidTransferOwnershipFarmStateLockingMode
  | InvalidTransferOwnershipFarmStateWithdrawCooldownPeriod
  | InvalidTransferOwnershipStakeAmount
  | InvalidTransferOwnershipNewOwner
  | InvalidTransferOwnershipFarmStateDepositWarmupPeriod

export class StakeZero extends Error {
  static readonly code = 6000
  readonly code = 6000
  readonly name = "StakeZero"
  readonly msg = "Cannot stake 0 amount"

  constructor(readonly logs?: string[]) {
    super("6000: Cannot stake 0 amount")
  }
}

export class UnstakeZero extends Error {
  static readonly code = 6001
  readonly code = 6001
  readonly name = "UnstakeZero"
  readonly msg = "Cannot unstake 0 amount"

  constructor(readonly logs?: string[]) {
    super("6001: Cannot unstake 0 amount")
  }
}

export class NothingToUnstake extends Error {
  static readonly code = 6002
  readonly code = 6002
  readonly name = "NothingToUnstake"
  readonly msg = "Nothing to unstake"

  constructor(readonly logs?: string[]) {
    super("6002: Nothing to unstake")
  }
}

export class NoRewardToHarvest extends Error {
  static readonly code = 6003
  readonly code = 6003
  readonly name = "NoRewardToHarvest"
  readonly msg = "No reward to harvest"

  constructor(readonly logs?: string[]) {
    super("6003: No reward to harvest")
  }
}

export class NoRewardInList extends Error {
  static readonly code = 6004
  readonly code = 6004
  readonly name = "NoRewardInList"
  readonly msg = "Reward not present in reward list"

  constructor(readonly logs?: string[]) {
    super("6004: Reward not present in reward list")
  }
}

export class RewardAlreadyInitialized extends Error {
  static readonly code = 6005
  readonly code = 6005
  readonly name = "RewardAlreadyInitialized"
  readonly msg = "Reward already initialized"

  constructor(readonly logs?: string[]) {
    super("6005: Reward already initialized")
  }
}

export class MaxRewardNumberReached extends Error {
  static readonly code = 6006
  readonly code = 6006
  readonly name = "MaxRewardNumberReached"
  readonly msg = "Max number of reward tokens reached"

  constructor(readonly logs?: string[]) {
    super("6006: Max number of reward tokens reached")
  }
}

export class RewardDoesNotExist extends Error {
  static readonly code = 6007
  readonly code = 6007
  readonly name = "RewardDoesNotExist"
  readonly msg = "Reward does not exist"

  constructor(readonly logs?: string[]) {
    super("6007: Reward does not exist")
  }
}

export class WrongRewardVaultAccount extends Error {
  static readonly code = 6008
  readonly code = 6008
  readonly name = "WrongRewardVaultAccount"
  readonly msg = "Reward vault exists but the account is wrong"

  constructor(readonly logs?: string[]) {
    super("6008: Reward vault exists but the account is wrong")
  }
}

export class RewardVaultMismatch extends Error {
  static readonly code = 6009
  readonly code = 6009
  readonly name = "RewardVaultMismatch"
  readonly msg = "Reward vault pubkey does not match staking pool vault"

  constructor(readonly logs?: string[]) {
    super("6009: Reward vault pubkey does not match staking pool vault")
  }
}

export class RewardVaultAuthorityMismatch extends Error {
  static readonly code = 6010
  readonly code = 6010
  readonly name = "RewardVaultAuthorityMismatch"
  readonly msg =
    "Reward vault authority pubkey does not match staking pool vault"

  constructor(readonly logs?: string[]) {
    super(
      "6010: Reward vault authority pubkey does not match staking pool vault"
    )
  }
}

export class NothingStaked extends Error {
  static readonly code = 6011
  readonly code = 6011
  readonly name = "NothingStaked"
  readonly msg = "Nothing staked, cannot collect any rewards"

  constructor(readonly logs?: string[]) {
    super("6011: Nothing staked, cannot collect any rewards")
  }
}

export class IntegerOverflow extends Error {
  static readonly code = 6012
  readonly code = 6012
  readonly name = "IntegerOverflow"
  readonly msg = "Integer overflow"

  constructor(readonly logs?: string[]) {
    super("6012: Integer overflow")
  }
}

export class ConversionFailure extends Error {
  static readonly code = 6013
  readonly code = 6013
  readonly name = "ConversionFailure"
  readonly msg = "Conversion failure"

  constructor(readonly logs?: string[]) {
    super("6013: Conversion failure")
  }
}

export class UnexpectedAccount extends Error {
  static readonly code = 6014
  readonly code = 6014
  readonly name = "UnexpectedAccount"
  readonly msg = "Unexpected account in instruction"

  constructor(readonly logs?: string[]) {
    super("6014: Unexpected account in instruction")
  }
}

export class OperationForbidden extends Error {
  static readonly code = 6015
  readonly code = 6015
  readonly name = "OperationForbidden"
  readonly msg = "Operation forbidden"

  constructor(readonly logs?: string[]) {
    super("6015: Operation forbidden")
  }
}

export class MathOverflow extends Error {
  static readonly code = 6016
  readonly code = 6016
  readonly name = "MathOverflow"
  readonly msg = "Mathematical operation with overflow"

  constructor(readonly logs?: string[]) {
    super("6016: Mathematical operation with overflow")
  }
}

export class MinClaimDurationNotReached extends Error {
  static readonly code = 6017
  readonly code = 6017
  readonly name = "MinClaimDurationNotReached"
  readonly msg = "Minimum claim duration has not been reached"

  constructor(readonly logs?: string[]) {
    super("6017: Minimum claim duration has not been reached")
  }
}

export class RewardsVaultHasDelegate extends Error {
  static readonly code = 6018
  readonly code = 6018
  readonly name = "RewardsVaultHasDelegate"
  readonly msg = "Reward vault has a delegate"

  constructor(readonly logs?: string[]) {
    super("6018: Reward vault has a delegate")
  }
}

export class RewardsVaultHasCloseAuthority extends Error {
  static readonly code = 6019
  readonly code = 6019
  readonly name = "RewardsVaultHasCloseAuthority"
  readonly msg = "Reward vault has a close authority"

  constructor(readonly logs?: string[]) {
    super("6019: Reward vault has a close authority")
  }
}

export class FarmVaultHasDelegate extends Error {
  static readonly code = 6020
  readonly code = 6020
  readonly name = "FarmVaultHasDelegate"
  readonly msg = "Farm vault has a delegate"

  constructor(readonly logs?: string[]) {
    super("6020: Farm vault has a delegate")
  }
}

export class FarmVaultHasCloseAuthority extends Error {
  static readonly code = 6021
  readonly code = 6021
  readonly name = "FarmVaultHasCloseAuthority"
  readonly msg = "Farm vault has a close authority"

  constructor(readonly logs?: string[]) {
    super("6021: Farm vault has a close authority")
  }
}

export class RewardsTreasuryVaultHasDelegate extends Error {
  static readonly code = 6022
  readonly code = 6022
  readonly name = "RewardsTreasuryVaultHasDelegate"
  readonly msg = "Reward vault has a delegate"

  constructor(readonly logs?: string[]) {
    super("6022: Reward vault has a delegate")
  }
}

export class RewardsTreasuryVaultHasCloseAuthority extends Error {
  static readonly code = 6023
  readonly code = 6023
  readonly name = "RewardsTreasuryVaultHasCloseAuthority"
  readonly msg = "Reward vault has a close authority"

  constructor(readonly logs?: string[]) {
    super("6023: Reward vault has a close authority")
  }
}

export class UserAtaRewardVaultMintMissmatch extends Error {
  static readonly code = 6024
  readonly code = 6024
  readonly name = "UserAtaRewardVaultMintMissmatch"
  readonly msg = "User ata and reward vault have different mints"

  constructor(readonly logs?: string[]) {
    super("6024: User ata and reward vault have different mints")
  }
}

export class UserAtaFarmTokenMintMissmatch extends Error {
  static readonly code = 6025
  readonly code = 6025
  readonly name = "UserAtaFarmTokenMintMissmatch"
  readonly msg = "User ata and farm token have different mints"

  constructor(readonly logs?: string[]) {
    super("6025: User ata and farm token have different mints")
  }
}

export class TokenFarmTokenMintMissmatch extends Error {
  static readonly code = 6026
  readonly code = 6026
  readonly name = "TokenFarmTokenMintMissmatch"
  readonly msg = "Token mint and farm token have different mints"

  constructor(readonly logs?: string[]) {
    super("6026: Token mint and farm token have different mints")
  }
}

export class RewardAtaRewardMintMissmatch extends Error {
  static readonly code = 6027
  readonly code = 6027
  readonly name = "RewardAtaRewardMintMissmatch"
  readonly msg = "Reward ata mint is different than reward mint"

  constructor(readonly logs?: string[]) {
    super("6027: Reward ata mint is different than reward mint")
  }
}

export class RewardAtaOwnerNotPayer extends Error {
  static readonly code = 6028
  readonly code = 6028
  readonly name = "RewardAtaOwnerNotPayer"
  readonly msg = "Reward ata owner is different than payer"

  constructor(readonly logs?: string[]) {
    super("6028: Reward ata owner is different than payer")
  }
}

export class InvalidGlobalConfigMode extends Error {
  static readonly code = 6029
  readonly code = 6029
  readonly name = "InvalidGlobalConfigMode"
  readonly msg = "Mode to update global_config is invalid"

  constructor(readonly logs?: string[]) {
    super("6029: Mode to update global_config is invalid")
  }
}

export class RewardIndexOutOfRange extends Error {
  static readonly code = 6030
  readonly code = 6030
  readonly name = "RewardIndexOutOfRange"
  readonly msg = "Reward Index is higher than number of rewards"

  constructor(readonly logs?: string[]) {
    super("6030: Reward Index is higher than number of rewards")
  }
}

export class NothingToWithdraw extends Error {
  static readonly code = 6031
  readonly code = 6031
  readonly name = "NothingToWithdraw"
  readonly msg = "No tokens available to withdraw"

  constructor(readonly logs?: string[]) {
    super("6031: No tokens available to withdraw")
  }
}

export class UserDelegatedFarmNonDelegatedMissmatch extends Error {
  static readonly code = 6032
  readonly code = 6032
  readonly name = "UserDelegatedFarmNonDelegatedMissmatch"
  readonly msg =
    "user, user_ref, authority and payer must match for non-delegated farm"

  constructor(readonly logs?: string[]) {
    super(
      "6032: user, user_ref, authority and payer must match for non-delegated farm"
    )
  }
}

export class AuthorityFarmDelegateMissmatch extends Error {
  static readonly code = 6033
  readonly code = 6033
  readonly name = "AuthorityFarmDelegateMissmatch"
  readonly msg = "Authority must match farm delegate authority"

  constructor(readonly logs?: string[]) {
    super("6033: Authority must match farm delegate authority")
  }
}

export class FarmNotDelegated extends Error {
  static readonly code = 6034
  readonly code = 6034
  readonly name = "FarmNotDelegated"
  readonly msg = "Farm not delegated, can not set stake"

  constructor(readonly logs?: string[]) {
    super("6034: Farm not delegated, can not set stake")
  }
}

export class FarmDelegated extends Error {
  static readonly code = 6035
  readonly code = 6035
  readonly name = "FarmDelegated"
  readonly msg = "Operation not allowed for delegated farm"

  constructor(readonly logs?: string[]) {
    super("6035: Operation not allowed for delegated farm")
  }
}

export class UnstakeNotElapsed extends Error {
  static readonly code = 6036
  readonly code = 6036
  readonly name = "UnstakeNotElapsed"
  readonly msg =
    "Unstake lockup period is not elapsed. Deposit is locked until end of unstake period"

  constructor(readonly logs?: string[]) {
    super(
      "6036: Unstake lockup period is not elapsed. Deposit is locked until end of unstake period"
    )
  }
}

export class PendingWithdrawalNotWithdrawnYet extends Error {
  static readonly code = 6037
  readonly code = 6037
  readonly name = "PendingWithdrawalNotWithdrawnYet"
  readonly msg = "Pending withdrawal already exist and not withdrawn yet"

  constructor(readonly logs?: string[]) {
    super("6037: Pending withdrawal already exist and not withdrawn yet")
  }
}

export class DepositZero extends Error {
  static readonly code = 6038
  readonly code = 6038
  readonly name = "DepositZero"
  readonly msg = "Cannot deposit zero amount directly to farm vault"

  constructor(readonly logs?: string[]) {
    super("6038: Cannot deposit zero amount directly to farm vault")
  }
}

export class InvalidConfigValue extends Error {
  static readonly code = 6039
  readonly code = 6039
  readonly name = "InvalidConfigValue"
  readonly msg = "Invalid config value"

  constructor(readonly logs?: string[]) {
    super("6039: Invalid config value")
  }
}

export class InvalidPenaltyPercentage extends Error {
  static readonly code = 6040
  readonly code = 6040
  readonly name = "InvalidPenaltyPercentage"
  readonly msg = "Invalid penalty percentage"

  constructor(readonly logs?: string[]) {
    super("6040: Invalid penalty percentage")
  }
}

export class EarlyWithdrawalNotAllowed extends Error {
  static readonly code = 6041
  readonly code = 6041
  readonly name = "EarlyWithdrawalNotAllowed"
  readonly msg = "Early withdrawal not allowed"

  constructor(readonly logs?: string[]) {
    super("6041: Early withdrawal not allowed")
  }
}

export class InvalidLockingTimestamps extends Error {
  static readonly code = 6042
  readonly code = 6042
  readonly name = "InvalidLockingTimestamps"
  readonly msg = "Invalid locking timestamps"

  constructor(readonly logs?: string[]) {
    super("6042: Invalid locking timestamps")
  }
}

export class InvalidRpsCurvePoint extends Error {
  static readonly code = 6043
  readonly code = 6043
  readonly name = "InvalidRpsCurvePoint"
  readonly msg = "Invalid reward rate curve point"

  constructor(readonly logs?: string[]) {
    super("6043: Invalid reward rate curve point")
  }
}

export class InvalidTimestamp extends Error {
  static readonly code = 6044
  readonly code = 6044
  readonly name = "InvalidTimestamp"
  readonly msg = "Invalid timestamp"

  constructor(readonly logs?: string[]) {
    super("6044: Invalid timestamp")
  }
}

export class DepositCapReached extends Error {
  static readonly code = 6045
  readonly code = 6045
  readonly name = "DepositCapReached"
  readonly msg = "Deposit cap reached"

  constructor(readonly logs?: string[]) {
    super("6045: Deposit cap reached")
  }
}

export class MissingScopePrices extends Error {
  static readonly code = 6046
  readonly code = 6046
  readonly name = "MissingScopePrices"
  readonly msg = "Missing Scope Prices"

  constructor(readonly logs?: string[]) {
    super("6046: Missing Scope Prices")
  }
}

export class ScopeOraclePriceTooOld extends Error {
  static readonly code = 6047
  readonly code = 6047
  readonly name = "ScopeOraclePriceTooOld"
  readonly msg = "Scope Oracle Price Too Old"

  constructor(readonly logs?: string[]) {
    super("6047: Scope Oracle Price Too Old")
  }
}

export class InvalidOracleConfig extends Error {
  static readonly code = 6048
  readonly code = 6048
  readonly name = "InvalidOracleConfig"
  readonly msg = "Invalid Oracle Config"

  constructor(readonly logs?: string[]) {
    super("6048: Invalid Oracle Config")
  }
}

export class CouldNotDeserializeScope extends Error {
  static readonly code = 6049
  readonly code = 6049
  readonly name = "CouldNotDeserializeScope"
  readonly msg = "Could not deserialize scope"

  constructor(readonly logs?: string[]) {
    super("6049: Could not deserialize scope")
  }
}

export class RewardAtaOwnerNotAdmin extends Error {
  static readonly code = 6050
  readonly code = 6050
  readonly name = "RewardAtaOwnerNotAdmin"
  readonly msg = "Reward ata owner is different than farm admin"

  constructor(readonly logs?: string[]) {
    super("6050: Reward ata owner is different than farm admin")
  }
}

export class WithdrawRewardZeroAvailable extends Error {
  static readonly code = 6051
  readonly code = 6051
  readonly name = "WithdrawRewardZeroAvailable"
  readonly msg = "Cannot withdraw reward as available amount is zero"

  constructor(readonly logs?: string[]) {
    super("6051: Cannot withdraw reward as available amount is zero")
  }
}

export class RewardScheduleCurveSet extends Error {
  static readonly code = 6052
  readonly code = 6052
  readonly name = "RewardScheduleCurveSet"
  readonly msg = "Cannot withdraw reward as reward schedule is set"

  constructor(readonly logs?: string[]) {
    super("6052: Cannot withdraw reward as reward schedule is set")
  }
}

export class UnsupportedTokenExtension extends Error {
  static readonly code = 6053
  readonly code = 6053
  readonly name = "UnsupportedTokenExtension"
  readonly msg =
    "Cannot initialize farm while having a mint with token22 and requested extensions"

  constructor(readonly logs?: string[]) {
    super(
      "6053: Cannot initialize farm while having a mint with token22 and requested extensions"
    )
  }
}

export class InvalidFarmConfigUpdateAuthority extends Error {
  static readonly code = 6054
  readonly code = 6054
  readonly name = "InvalidFarmConfigUpdateAuthority"
  readonly msg = "Invalid authority for updating farm config"

  constructor(readonly logs?: string[]) {
    super("6054: Invalid authority for updating farm config")
  }
}

export class InvalidTransferOwnershipOldOwner extends Error {
  static readonly code = 6055
  readonly code = 6055
  readonly name = "InvalidTransferOwnershipOldOwner"
  readonly msg =
    "Invalid authority for transfer ownersip new user state initialization"

  constructor(readonly logs?: string[]) {
    super(
      "6055: Invalid authority for transfer ownersip new user state initialization"
    )
  }
}

export class InvalidTransferOwnershipFarmState extends Error {
  static readonly code = 6056
  readonly code = 6056
  readonly name = "InvalidTransferOwnershipFarmState"
  readonly msg =
    "Invalid farm state for transfer ownership new user state initialization"

  constructor(readonly logs?: string[]) {
    super(
      "6056: Invalid farm state for transfer ownership new user state initialization"
    )
  }
}

export class InvalidTransferOwnershipUserStateOwnerDelegatee extends Error {
  static readonly code = 6057
  readonly code = 6057
  readonly name = "InvalidTransferOwnershipUserStateOwnerDelegatee"
  readonly msg =
    "Invalid user state for transfer ownership, owner must match delegatee"

  constructor(readonly logs?: string[]) {
    super(
      "6057: Invalid user state for transfer ownership, owner must match delegatee"
    )
  }
}

export class InvalidTransferOwnershipFarmStateLockingMode extends Error {
  static readonly code = 6058
  readonly code = 6058
  readonly name = "InvalidTransferOwnershipFarmStateLockingMode"
  readonly msg =
    "Invalid farm state locking mode for transfer ownership, must be 0"

  constructor(readonly logs?: string[]) {
    super(
      "6058: Invalid farm state locking mode for transfer ownership, must be 0"
    )
  }
}

export class InvalidTransferOwnershipFarmStateWithdrawCooldownPeriod extends Error {
  static readonly code = 6059
  readonly code = 6059
  readonly name = "InvalidTransferOwnershipFarmStateWithdrawCooldownPeriod"
  readonly msg =
    "Invalid farm state withdrawal cooldown period for transfer ownership, must be 0"

  constructor(readonly logs?: string[]) {
    super(
      "6059: Invalid farm state withdrawal cooldown period for transfer ownership, must be 0"
    )
  }
}

export class InvalidTransferOwnershipStakeAmount extends Error {
  static readonly code = 6060
  readonly code = 6060
  readonly name = "InvalidTransferOwnershipStakeAmount"
  readonly msg =
    "Invalid transfer ownership stake amount, must be equal to unstaked deposits"

  constructor(readonly logs?: string[]) {
    super(
      "6060: Invalid transfer ownership stake amount, must be equal to unstaked deposits"
    )
  }
}

export class InvalidTransferOwnershipNewOwner extends Error {
  static readonly code = 6061
  readonly code = 6061
  readonly name = "InvalidTransferOwnershipNewOwner"
  readonly msg =
    "Invalid authority for transfer ownersip new user state initialization"

  constructor(readonly logs?: string[]) {
    super(
      "6061: Invalid authority for transfer ownersip new user state initialization"
    )
  }
}

export class InvalidTransferOwnershipFarmStateDepositWarmupPeriod extends Error {
  static readonly code = 6062
  readonly code = 6062
  readonly name = "InvalidTransferOwnershipFarmStateDepositWarmupPeriod"
  readonly msg =
    "Invalid farm state deposit warmup period for transfer ownership, must be 0 if old user has stake"

  constructor(readonly logs?: string[]) {
    super(
      "6062: Invalid farm state deposit warmup period for transfer ownership, must be 0 if old user has stake"
    )
  }
}

export function fromCode(code: number, logs?: string[]): CustomError | null {
  switch (code) {
    case 6000:
      return new StakeZero(logs)
    case 6001:
      return new UnstakeZero(logs)
    case 6002:
      return new NothingToUnstake(logs)
    case 6003:
      return new NoRewardToHarvest(logs)
    case 6004:
      return new NoRewardInList(logs)
    case 6005:
      return new RewardAlreadyInitialized(logs)
    case 6006:
      return new MaxRewardNumberReached(logs)
    case 6007:
      return new RewardDoesNotExist(logs)
    case 6008:
      return new WrongRewardVaultAccount(logs)
    case 6009:
      return new RewardVaultMismatch(logs)
    case 6010:
      return new RewardVaultAuthorityMismatch(logs)
    case 6011:
      return new NothingStaked(logs)
    case 6012:
      return new IntegerOverflow(logs)
    case 6013:
      return new ConversionFailure(logs)
    case 6014:
      return new UnexpectedAccount(logs)
    case 6015:
      return new OperationForbidden(logs)
    case 6016:
      return new MathOverflow(logs)
    case 6017:
      return new MinClaimDurationNotReached(logs)
    case 6018:
      return new RewardsVaultHasDelegate(logs)
    case 6019:
      return new RewardsVaultHasCloseAuthority(logs)
    case 6020:
      return new FarmVaultHasDelegate(logs)
    case 6021:
      return new FarmVaultHasCloseAuthority(logs)
    case 6022:
      return new RewardsTreasuryVaultHasDelegate(logs)
    case 6023:
      return new RewardsTreasuryVaultHasCloseAuthority(logs)
    case 6024:
      return new UserAtaRewardVaultMintMissmatch(logs)
    case 6025:
      return new UserAtaFarmTokenMintMissmatch(logs)
    case 6026:
      return new TokenFarmTokenMintMissmatch(logs)
    case 6027:
      return new RewardAtaRewardMintMissmatch(logs)
    case 6028:
      return new RewardAtaOwnerNotPayer(logs)
    case 6029:
      return new InvalidGlobalConfigMode(logs)
    case 6030:
      return new RewardIndexOutOfRange(logs)
    case 6031:
      return new NothingToWithdraw(logs)
    case 6032:
      return new UserDelegatedFarmNonDelegatedMissmatch(logs)
    case 6033:
      return new AuthorityFarmDelegateMissmatch(logs)
    case 6034:
      return new FarmNotDelegated(logs)
    case 6035:
      return new FarmDelegated(logs)
    case 6036:
      return new UnstakeNotElapsed(logs)
    case 6037:
      return new PendingWithdrawalNotWithdrawnYet(logs)
    case 6038:
      return new DepositZero(logs)
    case 6039:
      return new InvalidConfigValue(logs)
    case 6040:
      return new InvalidPenaltyPercentage(logs)
    case 6041:
      return new EarlyWithdrawalNotAllowed(logs)
    case 6042:
      return new InvalidLockingTimestamps(logs)
    case 6043:
      return new InvalidRpsCurvePoint(logs)
    case 6044:
      return new InvalidTimestamp(logs)
    case 6045:
      return new DepositCapReached(logs)
    case 6046:
      return new MissingScopePrices(logs)
    case 6047:
      return new ScopeOraclePriceTooOld(logs)
    case 6048:
      return new InvalidOracleConfig(logs)
    case 6049:
      return new CouldNotDeserializeScope(logs)
    case 6050:
      return new RewardAtaOwnerNotAdmin(logs)
    case 6051:
      return new WithdrawRewardZeroAvailable(logs)
    case 6052:
      return new RewardScheduleCurveSet(logs)
    case 6053:
      return new UnsupportedTokenExtension(logs)
    case 6054:
      return new InvalidFarmConfigUpdateAuthority(logs)
    case 6055:
      return new InvalidTransferOwnershipOldOwner(logs)
    case 6056:
      return new InvalidTransferOwnershipFarmState(logs)
    case 6057:
      return new InvalidTransferOwnershipUserStateOwnerDelegatee(logs)
    case 6058:
      return new InvalidTransferOwnershipFarmStateLockingMode(logs)
    case 6059:
      return new InvalidTransferOwnershipFarmStateWithdrawCooldownPeriod(logs)
    case 6060:
      return new InvalidTransferOwnershipStakeAmount(logs)
    case 6061:
      return new InvalidTransferOwnershipNewOwner(logs)
    case 6062:
      return new InvalidTransferOwnershipFarmStateDepositWarmupPeriod(logs)
  }

  return null
}
