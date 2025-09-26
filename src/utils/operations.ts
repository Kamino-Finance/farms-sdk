import {
  Address,
  getAddressEncoder,
  IInstruction,
  Option,
  TransactionSigner,
} from "@solana/kit";

import * as Types from "../@codegen/farms/types";
import {
  getGlobalConfigValue,
  getUserStatePDA,
  GlobalConfigFlagValueType,
} from "./utils";
import { RewardCurvePoint } from "../Farms";
import BN from "bn.js";
import { SYSTEM_PROGRAM_ADDRESS } from "@solana-program/system";
import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { SYSVAR_RENT_ADDRESS } from "@solana/sysvars";
import {
  InitializeGlobalConfigAccounts,
  initializeGlobalConfig as initializeGlobalConfigIx,
  UpdateFarmAdminAccounts,
  updateFarmAdmin as updateFarmAdminIx,
  UpdateGlobalConfigAccounts,
  UpdateGlobalConfigAdminAccounts,
  updateGlobalConfigAdmin as updateGlobalConfigAdminIx,
  UpdateGlobalConfigArgs,
  updateGlobalConfig as updateGlobalConfigIx,
  InitializeFarmAccounts,
  initializeFarm as initializeFarmIx,
  InitializeFarmDelegatedAccounts,
  initializeFarmDelegated as initializeFarmDelegatedIx,
  InitializeRewardAccounts,
  initializeReward as initializeRewardIx,
  AddRewardsAccounts,
  AddRewardsArgs,
  addRewards as addRewardsIx,
  WithdrawRewardAccounts,
  WithdrawRewardArgs,
  withdrawReward as withdrawRewardIx,
  UpdateFarmConfigAccounts,
  UpdateFarmConfigArgs,
  updateFarmConfig as updateFarmConfigIx,
  RefreshFarmAccounts,
  refreshFarm as refreshFarmIx,
  InitializeUserAccounts,
  initializeUser as initializeUserIx,
  TransferOwnershipAccounts,
  transferOwnership as transferOwnershipIx,
  StakeAccounts,
  StakeArgs,
  stake as stakeIx,
  UnstakeAccounts,
  UnstakeArgs,
  unstake as unstakeIx,
  HarvestRewardAccounts,
  HarvestRewardArgs,
  harvestReward as harvestRewardIx,
  WithdrawTreasuryAccounts,
  WithdrawTreasuryArgs,
  withdrawTreasury as withdrawTreasuryIx,
  RefreshUserStateAccounts,
  refreshUserState as refreshUserStateIx,
  WithdrawUnstakedDepositsAccounts,
  withdrawUnstakedDeposits as withdrawUnstakedDepositsIx,
  WithdrawFromFarmVaultAccounts,
  WithdrawFromFarmVaultArgs,
  withdrawFromFarmVault as withdrawFromFarmVaultIx,
  DepositToFarmVaultAccounts,
  DepositToFarmVaultArgs,
  depositToFarmVault as depositToFarmVaultIx,
  UpdateSecondDelegatedAuthorityAccounts,
  updateSecondDelegatedAuthority as updateSecondDelegatedAuthorityIx,
} from "../@codegen/farms/instructions";
import {
  DepositCapAmount,
  DepositWarmupPeriod,
  LockingDuration,
  LockingEarlyWithdrawalPenaltyBps,
  LockingMode,
  LockingStartTimestamp,
  ScopeOracleMaxAge,
  ScopeOraclePriceId,
  ScopePricesAccount,
  SlashedAmountSpillAddress,
  UpdateDelegatedRpsAdmin,
  UpdatePendingFarmAdmin,
  UpdateRewardScheduleCurvePoints,
  UpdateStrategyId,
  UpdateVaultId,
  WithdrawAuthority,
  WithdrawCooldownPeriod,
} from "../@codegen/farms/types/FarmConfigOption";
import { PROGRAM_ID } from "../@codegen/farms/programId";

const addressEncoder = getAddressEncoder();

export function initializeGlobalConfig(
  globalAdmin: TransactionSigner,
  globalConfig: Address,
  treasuryVaultAuthority: Address,
): IInstruction {
  let accounts: InitializeGlobalConfigAccounts = {
    globalAdmin,
    globalConfig: globalConfig,
    treasuryVaultsAuthority: treasuryVaultAuthority,
    systemProgram: SYSTEM_PROGRAM_ADDRESS,
  };

  return initializeGlobalConfigIx(accounts);
}

export function updateGlobalConfig(
  globalAdmin: TransactionSigner,
  globalConfig: Address,
  mode: Types.GlobalConfigOptionKind,
  flagValue: string,
  flagValueType: GlobalConfigFlagValueType,
): IInstruction {
  let formattedValue = getGlobalConfigValue(flagValueType, flagValue);

  let accounts: UpdateGlobalConfigAccounts = {
    globalAdmin,
    globalConfig: globalConfig,
  };

  let args: UpdateGlobalConfigArgs = {
    mode: mode.discriminator,
    value: formattedValue,
  };

  return updateGlobalConfigIx(args, accounts);
}

export function updateGlobalConfigAdmin(
  pendingGlobalAdmin: TransactionSigner,
  globalConfig: Address,
): IInstruction {
  let accounts: UpdateGlobalConfigAdminAccounts = {
    pendingGlobalAdmin,
    globalConfig: globalConfig,
  };

  return updateGlobalConfigAdminIx(accounts);
}

export function updateSecondDelegatedAuthority(
  globalConfigAdmin: TransactionSigner,
  globalConfig: Address,
  farm: Address,
  newSecondAuthority: Address,
): IInstruction {
  let accounts: UpdateSecondDelegatedAuthorityAccounts = {
    globalAdmin: globalConfigAdmin,
    farmState: farm,
    globalConfig,
    newSecondDelegatedAuthority: newSecondAuthority,
  };

  return updateSecondDelegatedAuthorityIx(accounts);
}

export function updateFarmAdmin(
  pendingFarmAdmin: TransactionSigner,
  farm: Address,
): IInstruction {
  let accounts: UpdateFarmAdminAccounts = {
    pendingFarmAdmin,
    farmState: farm,
  };

  return updateFarmAdminIx(accounts);
}

export function initializeFarm(
  globalConfig: Address,
  farmAdmin: TransactionSigner,
  farmState: Address,
  farmVault: Address,
  farmVaultAuthority: Address,
  tokenMint: Address,
): IInstruction {
  let accounts: InitializeFarmAccounts = {
    farmAdmin,
    farmState: farmState,
    globalConfig: globalConfig,
    farmVault: farmVault,
    farmVaultsAuthority: farmVaultAuthority,
    tokenMint: tokenMint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
    systemProgram: SYSTEM_PROGRAM_ADDRESS,
    rent: SYSVAR_RENT_ADDRESS,
  };

  return initializeFarmIx(accounts);
}

export function initializeFarmDelegated(
  globalConfig: Address,
  farmAdmin: TransactionSigner,
  farmState: Address,
  farmVaultAuthority: Address,
  farmDelegate: TransactionSigner,
): IInstruction {
  let accounts: InitializeFarmDelegatedAccounts = {
    farmAdmin,
    farmState: farmState,
    globalConfig: globalConfig,
    farmVaultsAuthority: farmVaultAuthority,
    systemProgram: SYSTEM_PROGRAM_ADDRESS,
    rent: SYSVAR_RENT_ADDRESS,
    farmDelegate,
  };

  return initializeFarmDelegatedIx(accounts);
}

export function initializeReward(
  globalConfig: Address,
  treasuryVaultAuthority: Address,
  treasuryVault: Address,
  farmAdmin: TransactionSigner,
  farmState: Address,
  rewardVault: Address,
  farmVaultAuthority: Address,
  rewardMint: Address,
  tokenProgram: Address,
): IInstruction {
  let accounts: InitializeRewardAccounts = {
    farmAdmin,
    farmState: farmState,
    globalConfig: globalConfig,
    rewardVault: rewardVault,
    farmVaultsAuthority: farmVaultAuthority,
    treasuryVaultsAuthority: treasuryVaultAuthority,
    rewardTreasuryVault: treasuryVault,
    rewardMint: rewardMint,
    tokenProgram,
    systemProgram: SYSTEM_PROGRAM_ADDRESS,
    rent: SYSVAR_RENT_ADDRESS,
  };

  return initializeRewardIx(accounts);
}

export function addReward(
  payer: TransactionSigner,
  farmState: Address,
  rewardVault: Address,
  farmVaultAuthority: Address,
  payerRewardAta: Address,
  rewardMint: Address,
  scopePrices: Option<Address>,
  rewardIndex: number,
  tokenProgram: Address,
  amount: BN,
): IInstruction {
  let accounts: AddRewardsAccounts = {
    payer,
    farmState: farmState,
    rewardVault: rewardVault,
    farmVaultsAuthority: farmVaultAuthority,
    payerRewardTokenAta: payerRewardAta,
    rewardMint: rewardMint,
    tokenProgram,
    scopePrices,
  };

  let args: AddRewardsArgs = {
    amount: amount,
    rewardIndex: new BN(rewardIndex),
  };

  return addRewardsIx(args, accounts);
}

export function withdrawReward(
  admin: TransactionSigner,
  farmState: Address,
  rewardMint: Address,
  rewardVault: Address,
  farmVaultAuthority: Address,
  adminRewardAta: Address,
  scopePrices: Option<Address>,
  tokenProgram: Address,
  rewardIndex: number,
  amount: BN,
): IInstruction {
  let accounts: WithdrawRewardAccounts = {
    farmAdmin: admin,
    farmState: farmState,
    rewardVault: rewardVault,
    rewardMint,
    farmVaultsAuthority: farmVaultAuthority,
    adminRewardTokenAta: adminRewardAta,
    tokenProgram,
    scopePrices,
  };

  let args: WithdrawRewardArgs = {
    amount: amount,
    rewardIndex: new BN(rewardIndex),
  };

  return withdrawRewardIx(args, accounts);
}

export function updateFarmConfig(
  farmAdmin: TransactionSigner,
  farmState: Address,
  scopePrices: Option<Address>,
  rewardIndex: number,
  mode: Types.FarmConfigOptionKind,
  value: number | Address | number[] | RewardCurvePoint[] | BN,
): IInstruction {
  let accounts: UpdateFarmConfigAccounts = {
    signer: farmAdmin,
    farmState: farmState,
    scopePrices,
  };

  let data: Uint8Array = new Uint8Array();
  let buffer: Buffer;
  switch (mode.discriminator) {
    case LockingStartTimestamp.discriminator:
    case LockingDuration.discriminator:
    case DepositCapAmount.discriminator:
    case LockingEarlyWithdrawalPenaltyBps.discriminator:
    case LockingMode.discriminator:
    case ScopeOracleMaxAge.discriminator:
      buffer = Buffer.alloc(8);
      buffer.writeBigUint64LE(BigInt(value as number), 0);
      data = Uint8Array.from(buffer);
      break;
    case ScopeOraclePriceId.discriminator: // BN arg
      buffer = Buffer.alloc(8);
      buffer.writeBigUint64LE(BigInt((value as BN).toString()), 0);
      data = Uint8Array.from(buffer);
      break;
    case DepositWarmupPeriod.discriminator:
    case WithdrawCooldownPeriod.discriminator:
      buffer = Buffer.alloc(4);
      buffer.writeInt32LE(value as number, 0);
      data = Uint8Array.from(buffer);
      break;
    case UpdateStrategyId.discriminator:
    case UpdatePendingFarmAdmin.discriminator:
    case ScopePricesAccount.discriminator:
    case SlashedAmountSpillAddress.discriminator:
    case WithdrawAuthority.discriminator:
    case UpdateDelegatedRpsAdmin.discriminator:
    case UpdateVaultId.discriminator:
      data = Buffer.from(addressEncoder.encode(value as Address));
      break;
    case UpdateRewardScheduleCurvePoints.discriminator:
      let points = value as RewardCurvePoint[];
      data = serializeRewardCurvePoint(rewardIndex, points);
      break;
    default:
      data = serializeConfigValue(BigInt(rewardIndex), BigInt(value as number));
      break;
  }

  let args: UpdateFarmConfigArgs = {
    mode: mode.discriminator,
    data,
  };

  return updateFarmConfigIx(args, accounts);
}

export function refreshFarm(
  farmState: Address,
  scopePrices: Option<Address>,
): IInstruction {
  let accounts: RefreshFarmAccounts = {
    farmState: farmState,
    scopePrices,
  };

  return refreshFarmIx(accounts);
}

export function initializeUser(
  farmState: Address,
  owner: Address,
  userState: Address,
  authority: TransactionSigner,
  delegatee: Address = owner,
): IInstruction {
  let accounts: InitializeUserAccounts = {
    authority,
    payer: authority,
    delegatee,
    owner,
    userState: userState,
    farmState: farmState,
    systemProgram: SYSTEM_PROGRAM_ADDRESS,
    rent: SYSVAR_RENT_ADDRESS,
  };

  return initializeUserIx(accounts);
}

export function transferOwnership(
  oldOwner: TransactionSigner,
  oldUserState: Address,
  newOwner: Address,
  farmState: Address,
  newUserState: Address,
  scopePrices: Option<Address>,
  payer: TransactionSigner = oldOwner,
): IInstruction {
  let accounts: TransferOwnershipAccounts = {
    oldOwner: oldOwner,
    payer: payer,
    newOwner: newOwner, // The current owner is the userState
    oldUserState: oldUserState,
    newUserState: newUserState,
    farmState: farmState, // Assuming farmState is the same as userState for this context
    systemProgram: SYSTEM_PROGRAM_ADDRESS,
    rent: SYSVAR_RENT_ADDRESS,
    scopePrices: scopePrices,
  };

  return transferOwnershipIx(accounts);
}

export function stake(
  owner: TransactionSigner,
  userState: Address,
  ownerTokenAta: Address,
  farmState: Address,
  farmVault: Address,
  tokenMint: Address,
  scopePrices: Option<Address>,
  amount: BN,
): IInstruction {
  let accounts: StakeAccounts = {
    owner: owner,
    userState: userState,
    farmState: farmState,
    farmVault: farmVault,
    userAta: ownerTokenAta,
    tokenMint: tokenMint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
    scopePrices,
  };

  let args: StakeArgs = {
    amount,
  };

  return stakeIx(args, accounts);
}

export function unstake(
  owner: TransactionSigner,
  userState: Address,
  farmState: Address,
  scopePrices: Option<Address>,
  amount: BN,
): IInstruction {
  let accounts: UnstakeAccounts = {
    owner: owner,
    userState: userState,
    farmState: farmState,
    scopePrices,
  };

  let args: UnstakeArgs = {
    stakeSharesScaled: amount,
  };

  return unstakeIx(args, accounts);
}

export function harvestReward(
  owner: TransactionSigner,
  userState: Address,
  userRewardAta: Address,
  globalConfig: Address,
  treasuryVault: Address,
  farmState: Address,
  rewardMint: Address,
  rewardVault: Address,
  farmVaultAuthority: Address,
  scopePrices: Option<Address>,
  tokenProgram: Address,
  rewardIndex: number,
): IInstruction {
  let accounts: HarvestRewardAccounts = {
    owner: owner,
    userState: userState,
    farmState: farmState,
    globalConfig: globalConfig,
    rewardMint,
    rewardsVault: rewardVault,
    rewardsTreasuryVault: treasuryVault,
    userRewardAta: userRewardAta,
    farmVaultsAuthority: farmVaultAuthority,
    tokenProgram,
    scopePrices,
  };

  let args: HarvestRewardArgs = {
    rewardIndex: new BN(rewardIndex),
  };

  return harvestRewardIx(args, accounts);
}

export function withdrawTreasury(
  globalAdmin: TransactionSigner,
  globalConfig: Address,
  treasuryVault: Address,
  treasuryVaultAuthority: Address,
  globalAdminWithdrawAta: Address,
  amount: BN,
  rewardMint: Address,
): IInstruction {
  let accounts: WithdrawTreasuryAccounts = {
    globalAdmin,
    globalConfig: globalConfig,
    rewardTreasuryVault: treasuryVault,
    treasuryVaultAuthority: treasuryVaultAuthority,
    withdrawDestinationTokenAccount: globalAdminWithdrawAta,
    rewardMint: rewardMint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  };

  let args: WithdrawTreasuryArgs = {
    amount,
  };

  return withdrawTreasuryIx(args, accounts);
}

export function refreshUserState(
  userState: Address,
  farmState: Address,
  scopePrices: Option<Address>,
): IInstruction {
  let accounts: RefreshUserStateAccounts = {
    userState,
    farmState,
    scopePrices,
  };

  return refreshUserStateIx(accounts);
}

export function withdrawUnstakedDeposit(
  owner: TransactionSigner,
  userState: Address,
  farmState: Address,
  userAta: Address,
  farmVault: Address,
  farmVaultsAuthority: Address,
): IInstruction {
  let accounts: WithdrawUnstakedDepositsAccounts = {
    owner,
    userState,
    farmState,
    userAta,
    farmVault,
    farmVaultsAuthority,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  };

  return withdrawUnstakedDepositsIx(accounts);
}

export function withdrawFromFarmVault(
  withdrawAuthority: TransactionSigner,
  farmState: Address,
  withdrawerTokenAccount: Address,
  farmVault: Address,
  farmVaultsAuthority: Address,
  amount: BN,
): IInstruction {
  let accounts: WithdrawFromFarmVaultAccounts = {
    farmState,
    withdrawAuthority,
    withdrawerTokenAccount,
    farmVault,
    farmVaultsAuthority,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  };

  let args: WithdrawFromFarmVaultArgs = {
    amount,
  };

  return withdrawFromFarmVaultIx(args, accounts);
}

export function depositToFarmVault(
  depositor: TransactionSigner,
  farmState: Address,
  farmVault: Address,
  depositorAta: Address,
  amount: BN,
): IInstruction {
  let accounts: DepositToFarmVaultAccounts = {
    depositor,
    farmState,
    farmVault,
    depositorAta,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  };

  let args: DepositToFarmVaultArgs = {
    amount,
  };

  return depositToFarmVaultIx(args, accounts);
}

export function serializeConfigValue(
  reward_index: bigint,
  value: bigint,
): Uint8Array {
  let buffer: Buffer;
  buffer = Buffer.alloc(16);
  buffer.writeBigUint64LE(reward_index, 0);
  buffer.writeBigUInt64LE(value, 8);
  return Uint8Array.from(buffer);
}
export function serializeRewardCurvePoint(
  reward_index: number,
  points: RewardCurvePoint[],
): Uint8Array {
  let buffer: Buffer;
  buffer = Buffer.alloc(8 + 4 + 16 * points.length);
  buffer.writeBigUint64LE(BigInt(reward_index), 0);
  buffer.writeUInt32LE(points.length, 8);
  for (let i = 0; i < points.length; i++) {
    buffer.writeBigUint64LE(BigInt(points[i].startTs), 12 + 16 * i);
    buffer.writeBigUint64LE(BigInt(points[i].rps), 20 + 16 * i);
  }
  return Uint8Array.from(buffer);
}
