import {
  Address,
  getAddressEncoder,
  IInstruction,
  Option,
  TransactionSigner,
} from "@solana/kit";

import {
  FarmConfigOption,
  GlobalConfigOption,
} from "../@codegen/farms/types";
import {
  getGlobalConfigValue,
  getUserStatePDA,
  GlobalConfigFlagValueType,
} from "./utils";
import { RewardCurvePoint } from "../Farms";
import { SYSTEM_PROGRAM_ADDRESS } from "@solana-program/system";
import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { SYSVAR_RENT_ADDRESS } from "@solana/sysvars";
import {
  getInitializeGlobalConfigInstruction,
  getUpdateGlobalConfigInstruction,
  getUpdateGlobalConfigAdminInstruction,
  getUpdateSecondDelegatedAuthorityInstruction,
  getUpdateFarmAdminInstruction,
  getInitializeFarmInstruction,
  getInitializeFarmDelegatedInstruction,
  getInitializeRewardInstruction,
  getAddRewardsInstruction,
  getWithdrawRewardInstruction,
  getCloseEmptyUserStateInstruction,
  getUpdateFarmConfigInstruction,
  getRefreshFarmInstruction,
  getInitializeUserInstruction,
  getTransferOwnershipInstruction,
  getStakeInstruction,
  getUnstakeInstruction,
  getHarvestRewardInstruction,
  getWithdrawTreasuryInstruction,
  getRefreshUserStateInstruction,
  getWithdrawUnstakedDepositsInstruction,
  getWithdrawFromFarmVaultInstruction,
  getDepositToFarmVaultInstruction,
  getRewardUserOnceInstruction,
} from "../@codegen/farms/instructions";
import { FARMS_PROGRAM_ADDRESS } from "../@codegen/farms/programs";

const addressEncoder = getAddressEncoder();

function optionToAddress(opt: Option<Address>): Address | undefined {
  if (opt.__option === "Some") {
    return opt.value;
  }
  return undefined;
}

export function initializeGlobalConfig(
  globalAdmin: TransactionSigner,
  globalConfig: Address,
  treasuryVaultAuthority: Address,
): IInstruction {
  return getInitializeGlobalConfigInstruction({
    globalAdmin,
    globalConfig,
    treasuryVaultsAuthority: treasuryVaultAuthority,
    systemProgram: SYSTEM_PROGRAM_ADDRESS,
  });
}

export function updateGlobalConfig(
  globalAdmin: TransactionSigner,
  globalConfig: Address,
  mode: GlobalConfigOption,
  flagValue: string,
  flagValueType: GlobalConfigFlagValueType,
): IInstruction {
  let formattedValue = getGlobalConfigValue(flagValueType, flagValue);

  return getUpdateGlobalConfigInstruction({
    globalAdmin,
    globalConfig,
    mode,
    value: Uint8Array.from(formattedValue),
  });
}

export function updateGlobalConfigAdmin(
  pendingGlobalAdmin: TransactionSigner,
  globalConfig: Address,
): IInstruction {
  return getUpdateGlobalConfigAdminInstruction({
    pendingGlobalAdmin,
    globalConfig,
  });
}

export function updateSecondDelegatedAuthority(
  globalConfigAdmin: TransactionSigner,
  globalConfig: Address,
  farm: Address,
  newSecondAuthority: Address,
): IInstruction {
  return getUpdateSecondDelegatedAuthorityInstruction({
    globalAdmin: globalConfigAdmin,
    farmState: farm,
    globalConfig,
    newSecondDelegatedAuthority: newSecondAuthority,
  });
}

export function updateFarmAdmin(
  pendingFarmAdmin: TransactionSigner,
  farm: Address,
): IInstruction {
  return getUpdateFarmAdminInstruction({
    pendingFarmAdmin,
    farmState: farm,
  });
}

export function initializeFarm(
  globalConfig: Address,
  farmAdmin: TransactionSigner,
  farmState: Address,
  farmVault: Address,
  farmVaultAuthority: Address,
  tokenMint: Address,
): IInstruction {
  return getInitializeFarmInstruction({
    farmAdmin,
    farmState,
    globalConfig,
    farmVault,
    farmVaultsAuthority: farmVaultAuthority,
    tokenMint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
    systemProgram: SYSTEM_PROGRAM_ADDRESS,
    rent: SYSVAR_RENT_ADDRESS,
  });
}

export function initializeFarmDelegated(
  globalConfig: Address,
  farmAdmin: TransactionSigner,
  farmState: Address,
  farmVaultAuthority: Address,
  farmDelegate: TransactionSigner,
): IInstruction {
  return getInitializeFarmDelegatedInstruction({
    farmAdmin,
    farmState,
    globalConfig,
    farmVaultsAuthority: farmVaultAuthority,
    systemProgram: SYSTEM_PROGRAM_ADDRESS,
    rent: SYSVAR_RENT_ADDRESS,
    farmDelegate,
  });
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
  return getInitializeRewardInstruction({
    farmAdmin,
    farmState,
    globalConfig,
    rewardVault,
    farmVaultsAuthority: farmVaultAuthority,
    treasuryVaultsAuthority: treasuryVaultAuthority,
    rewardTreasuryVault: treasuryVault,
    rewardMint,
    tokenProgram,
    systemProgram: SYSTEM_PROGRAM_ADDRESS,
    rent: SYSVAR_RENT_ADDRESS,
  });
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
  amount: bigint,
): IInstruction {
  return getAddRewardsInstruction({
    payer,
    farmState,
    rewardVault,
    farmVaultsAuthority: farmVaultAuthority,
    payerRewardTokenAta: payerRewardAta,
    rewardMint,
    tokenProgram,
    scopePrices: optionToAddress(scopePrices),
    amount,
    rewardIndex: BigInt(rewardIndex),
  });
}

export function rewardUserOnce(
  delegateAuthority: TransactionSigner,
  farmState: Address,
  userState: Address,
  rewardIndex: number,
  amount: bigint,
  expectedRewardsIssuedCumulative: bigint,
  userStateId: bigint,
): IInstruction {
  return getRewardUserOnceInstruction({
    delegateAuthority,
    farmState,
    userState,
    amount,
    rewardIndex: BigInt(rewardIndex),
    expectedRewardsIssuedCumulative,
    userStateId,
  });
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
  amount: bigint,
): IInstruction {
  return getWithdrawRewardInstruction({
    farmAdmin: admin,
    farmState,
    rewardVault,
    rewardMint,
    farmVaultsAuthority: farmVaultAuthority,
    adminRewardTokenAta: adminRewardAta,
    tokenProgram,
    scopePrices: optionToAddress(scopePrices),
    amount,
    rewardIndex: BigInt(rewardIndex),
  });
}

export function closeEmptyUserState(
  signer: TransactionSigner,
  userState: Address,
  farmState: Address,
  rentReceiver: Address,
): IInstruction {
  return getCloseEmptyUserStateInstruction({
    signer,
    userState,
    farmState,
    rentReceiver,
    systemProgram: SYSTEM_PROGRAM_ADDRESS,
  });
}

export function updateFarmConfig(
  farmAdmin: TransactionSigner,
  farmState: Address,
  scopePrices: Option<Address>,
  rewardIndex: number,
  mode: FarmConfigOption,
  value: number | Address | number[] | RewardCurvePoint[] | bigint,
): IInstruction {
  let data: Uint8Array = new Uint8Array();
  let buffer: Buffer;
  switch (mode) {
    case FarmConfigOption.LockingStartTimestamp:
    case FarmConfigOption.LockingDuration:
    case FarmConfigOption.DepositCapAmount:
    case FarmConfigOption.LockingEarlyWithdrawalPenaltyBps:
    case FarmConfigOption.LockingMode:
    case FarmConfigOption.ScopeOracleMaxAge:
      buffer = Buffer.alloc(8);
      buffer.writeBigUint64LE(BigInt(value as number), 0);
      data = Uint8Array.from(buffer);
      break;
    case FarmConfigOption.ScopeOraclePriceId: // bigint arg
      buffer = Buffer.alloc(8);
      buffer.writeBigUint64LE(value as bigint, 0);
      data = Uint8Array.from(buffer);
      break;
    case FarmConfigOption.DepositWarmupPeriod:
    case FarmConfigOption.WithdrawCooldownPeriod:
      buffer = Buffer.alloc(4);
      buffer.writeInt32LE(value as number, 0);
      data = Uint8Array.from(buffer);
      break;
    case FarmConfigOption.UpdateIsHarvestingPermissionless:
      buffer = Buffer.alloc(1);
      buffer.writeUInt8(value as number, 0);
      data = Uint8Array.from(buffer);
      break;
    case FarmConfigOption.UpdateStrategyId:
    case FarmConfigOption.UpdatePendingFarmAdmin:
    case FarmConfigOption.ScopePricesAccount:
    case FarmConfigOption.SlashedAmountSpillAddress:
    case FarmConfigOption.WithdrawAuthority:
    case FarmConfigOption.UpdateDelegatedRpsAdmin:
    case FarmConfigOption.UpdateVaultId:
    case FarmConfigOption.UpdateDelegatedAuthority:
      data = Buffer.from(addressEncoder.encode(value as Address));
      break;
    case FarmConfigOption.UpdateRewardScheduleCurvePoints:
      let points = value as RewardCurvePoint[];
      data = serializeRewardCurvePoint(rewardIndex, points);
      break;
    case FarmConfigOption.UpdateIsRewardUserOnceEnabled:
      buffer = Buffer.alloc(1);
      buffer.writeUInt8(value as number, 0);
      data = Uint8Array.from(buffer);
      break;
    default:
      data = serializeConfigValue(BigInt(rewardIndex), BigInt(value as number));
      break;
  }

  return getUpdateFarmConfigInstruction({
    signer: farmAdmin,
    farmState,
    scopePrices: optionToAddress(scopePrices),
    mode,
    data,
  });
}

export function refreshFarm(
  farmState: Address,
  scopePrices: Option<Address>,
): IInstruction {
  return getRefreshFarmInstruction({
    farmState,
    scopePrices: optionToAddress(scopePrices),
  });
}

export function initializeUser(
  farmState: Address,
  owner: Address,
  userState: Address,
  authority: TransactionSigner,
  delegatee: Address = owner,
): IInstruction {
  return getInitializeUserInstruction({
    authority,
    payer: authority,
    delegatee,
    owner,
    userState,
    farmState,
    systemProgram: SYSTEM_PROGRAM_ADDRESS,
    rent: SYSVAR_RENT_ADDRESS,
  });
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
  return getTransferOwnershipInstruction({
    oldOwner,
    payer,
    newOwner,
    oldUserState,
    newUserState,
    farmState,
    systemProgram: SYSTEM_PROGRAM_ADDRESS,
    rent: SYSVAR_RENT_ADDRESS,
    scopePrices: optionToAddress(scopePrices),
  });
}

export function stake(
  owner: TransactionSigner,
  userState: Address,
  ownerTokenAta: Address,
  farmState: Address,
  farmVault: Address,
  tokenMint: Address,
  scopePrices: Option<Address>,
  amount: bigint,
): IInstruction {
  return getStakeInstruction({
    owner,
    userState,
    farmState,
    farmVault,
    userAta: ownerTokenAta,
    tokenMint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
    scopePrices: optionToAddress(scopePrices),
    amount,
  });
}

export function unstake(
  owner: TransactionSigner,
  userState: Address,
  farmState: Address,
  scopePrices: Option<Address>,
  amount: bigint,
): IInstruction {
  return getUnstakeInstruction({
    owner,
    userState,
    farmState,
    scopePrices: optionToAddress(scopePrices),
    stakeSharesScaled: amount,
  });
}

export function harvestReward(
  payer: TransactionSigner,
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
  return getHarvestRewardInstruction({
    payer,
    userState,
    farmState,
    globalConfig,
    rewardMint,
    rewardsVault: rewardVault,
    rewardsTreasuryVault: treasuryVault,
    userRewardTokenAccount: userRewardAta,
    farmVaultsAuthority: farmVaultAuthority,
    tokenProgram,
    scopePrices: optionToAddress(scopePrices),
    rewardIndex: BigInt(rewardIndex),
  });
}

export function withdrawTreasury(
  globalAdmin: TransactionSigner,
  globalConfig: Address,
  treasuryVault: Address,
  treasuryVaultAuthority: Address,
  globalAdminWithdrawAta: Address,
  amount: bigint,
  rewardMint: Address,
): IInstruction {
  return getWithdrawTreasuryInstruction({
    globalAdmin,
    globalConfig,
    rewardTreasuryVault: treasuryVault,
    treasuryVaultAuthority,
    withdrawDestinationTokenAccount: globalAdminWithdrawAta,
    rewardMint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
    amount,
  });
}

export function refreshUserState(
  userState: Address,
  farmState: Address,
  scopePrices: Option<Address>,
): IInstruction {
  return getRefreshUserStateInstruction({
    userState,
    farmState,
    scopePrices: optionToAddress(scopePrices),
  });
}

export function withdrawUnstakedDeposit(
  owner: TransactionSigner,
  userState: Address,
  farmState: Address,
  userAta: Address,
  farmVault: Address,
  farmVaultsAuthority: Address,
): IInstruction {
  return getWithdrawUnstakedDepositsInstruction({
    owner,
    userState,
    farmState,
    userAta,
    farmVault,
    farmVaultsAuthority,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
}

export function withdrawFromFarmVault(
  withdrawAuthority: TransactionSigner,
  farmState: Address,
  withdrawerTokenAccount: Address,
  farmVault: Address,
  farmVaultsAuthority: Address,
  amount: bigint,
): IInstruction {
  return getWithdrawFromFarmVaultInstruction({
    farmState,
    withdrawAuthority,
    withdrawerTokenAccount,
    farmVault,
    farmVaultsAuthority,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
    amount,
  });
}

export function depositToFarmVault(
  depositor: TransactionSigner,
  farmState: Address,
  farmVault: Address,
  depositorAta: Address,
  amount: bigint,
): IInstruction {
  return getDepositToFarmVaultInstruction({
    depositor,
    farmState,
    farmVault,
    depositorAta,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
    amount,
  });
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
