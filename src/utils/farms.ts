import { Address } from "@solana/kit";
import Decimal from "decimal.js";
import { FarmAndKey, FarmState, lamportsToCollDecimal, RewardType } from "..";
import { U64_MAX } from "./consts";
import { DEFAULT_PUBLIC_KEY } from "./pubkey";

export interface IFarmResponse {
  config: FarmConfig;
  state: FarmState;
}

export interface ILogger {
  log: (...args: any[]) => void;
  debug: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
}

export const noOpLogger: ILogger = {
  log: () => {},
  debug: () => {},
  warn: () => {},
  error: () => {},
};

export interface ReserveInfo {
  address: Address;
  symbol: string;
  farmCollateral: Address;
  farmDebt: Address;
}

export interface MarketWithReserves {
  address: Address;
  marketName: string;
  reserves: ReserveInfo[];
}

export interface StrategyInfo {
  address: Address;
  farm: Address;
}

export interface VaultInfo {
  address: Address;
  vaultFarm: Address;
}

export function getAllFarmConfigsAndStates({
  allFarms,
  logger,
  markets,
  strategies,
  vaults,
}: {
  allFarms: FarmAndKey[];
  logger: ILogger;
  markets: MarketWithReserves[];
  strategies: StrategyInfo[];
  vaults: VaultInfo[];
}): {
  collateralFarms: IFarmResponse[];
  debtFarms: IFarmResponse[];
  strategyFarms: IFarmResponse[];
  earnVaultFarms: IFarmResponse[];
  standaloneFarms: IFarmResponse[];
} {
  const fetchedFarmsForStratsAndReserves = new Set<Address>([]);

  const collateralFarms: IFarmResponse[] = [];
  const debtFarms: IFarmResponse[] = [];
  const strategyFarms: IFarmResponse[] = [];
  const earnVaultFarms: IFarmResponse[] = [];
  const standaloneFarms: IFarmResponse[] = [];

  for (const market of markets) {
    for (const reserve of market.reserves) {
      if (reserve.farmCollateral !== DEFAULT_PUBLIC_KEY) {
        fetchedFarmsForStratsAndReserves.add(reserve.farmCollateral);
        const farmStateCollateral = allFarms.find(
          (farm) => farm.key === reserve.farmCollateral,
        )?.farmState;
        if (farmStateCollateral) {
          const farmConfig = getFarmConfigType(
            reserve.farmCollateral,
            farmStateCollateral,
            {
              type: "reserve",
              reserve: reserve.address,
              reserveSymbol: reserve.symbol,
              market: market.address,
              marketName: market.marketName,
              strategy: undefined,
              vault: undefined,
            },
          );
          if (farmConfig.scopePrices !== DEFAULT_PUBLIC_KEY) {
            logger.log(
              `farmPk: ${farmConfig.farmPubkey}  scopePrice: ${farmConfig.scopePrices}`,
            );
          }
          collateralFarms.push({
            config: farmConfig,
            state: farmStateCollateral,
          });
        } else {
          logger.log("Could not fetch farm", reserve.farmCollateral);
        }
      }
      if (reserve.farmDebt !== DEFAULT_PUBLIC_KEY) {
        fetchedFarmsForStratsAndReserves.add(reserve.farmDebt);
        const farmStateDebt = allFarms.find(
          (farm) => farm.key === reserve.farmDebt,
        )?.farmState;
        if (farmStateDebt) {
          const farmConfig = getFarmConfigType(
            reserve.farmDebt,
            farmStateDebt,
            {
              type: "reserve",
              reserve: reserve.address,
              reserveSymbol: reserve.symbol,
              market: market.address,
              marketName: market.marketName,
              strategy: undefined,
              vault: undefined,
            },
          );
          if (farmConfig.scopePrices !== DEFAULT_PUBLIC_KEY) {
            logger.log(
              `farmPk: ${farmConfig.farmPubkey}  scopePrice: ${farmConfig.scopePrices}`,
            );
          }
          debtFarms.push({
            config: farmConfig,
            state: farmStateDebt,
          });
        } else {
          logger.log("Could not fetch farm", reserve.farmDebt);
        }
      }
    }
  }

  for (const strategy of strategies) {
    const farmAddress = strategy.farm;
    if (farmAddress !== DEFAULT_PUBLIC_KEY) {
      fetchedFarmsForStratsAndReserves.add(farmAddress);
      const farmState = allFarms.find(
        (farm) => farm.key === farmAddress,
      )?.farmState;
      if (farmState) {
        const farmConfig = getFarmConfigType(farmAddress, farmState, {
          type: "strategy",
          reserve: undefined,
          reserveSymbol: undefined,
          market: undefined,
          marketName: undefined,
          strategy: strategy.address,
          vault: undefined,
        });
        // in case strategy is not set on farm side, we override value so we set on next upsert
        farmConfig.strategyId = strategy.address;
        if (farmConfig.scopePrices !== DEFAULT_PUBLIC_KEY) {
          logger.log(
            `farmPk: ${farmConfig.farmPubkey}  scopePrice: ${farmConfig.scopePrices}`,
          );
        }
        strategyFarms.push({
          config: farmConfig,
          state: farmState,
        });
      } else {
        logger.log("Could not fetch farm", farmAddress);
      }
    }
  }

  for (const vault of vaults) {
    const farmAddress = vault.vaultFarm;
    if (farmAddress !== DEFAULT_PUBLIC_KEY) {
      fetchedFarmsForStratsAndReserves.add(farmAddress);

      const farmState = allFarms.find(
        (farm) => farm.key === farmAddress,
      )?.farmState;
      if (farmState) {
        const farmConfig = getFarmConfigType(farmAddress, farmState, {
          type: "earnVault",
          reserve: undefined,
          reserveSymbol: undefined,
          market: undefined,
          marketName: undefined,
          strategy: undefined,
          vault: vault.address,
        });
        // in case vaultId is not set on farm side, we override value so we set on next upsert
        farmConfig.vaultId = vault.address;
        if (farmConfig.scopePrices !== DEFAULT_PUBLIC_KEY) {
          logger.log(
            `farmPk: ${farmConfig.farmPubkey}  scopePrice: ${farmConfig.scopePrices}`,
          );
        }
        earnVaultFarms.push({
          config: farmConfig,
          state: farmState,
        });
      } else {
        logger.log("Could not fetch farm", farmAddress);
      }
    }
  }

  for (const farmAndKey of allFarms) {
    // skip farms already processed as part of reserves, strategies, or vaults
    if (fetchedFarmsForStratsAndReserves.has(farmAndKey.key)) {
      continue;
    }

    const farmConfig = getFarmConfigType(farmAndKey.key, farmAndKey.farmState, {
      type: "standalone",
      reserve: undefined,
      reserveSymbol: undefined,
      market: undefined,
      marketName: undefined,
      strategy: undefined,
      vault: undefined,
    });
    if (farmConfig.scopePrices !== DEFAULT_PUBLIC_KEY) {
      logger.log(
        `farmPk: ${farmConfig.farmPubkey}  scopePrice: ${farmConfig.scopePrices}`,
      );
    }
    standaloneFarms.push({
      config: farmConfig,
      state: farmAndKey.farmState,
    });
  }

  return {
    collateralFarms,
    debtFarms,
    strategyFarms,
    earnVaultFarms,
    standaloneFarms,
  };
}

export type FarmConfig = {
  farmMetadata: FarmMetadata;
  farmPubkey: Address;
  stakingTokenMint: Address;
  withdrawAuthority: Address;
  globalConfig: Address;
  strategyId: Address;
  vaultId: Address;
  depositCapAmount: number;
  rewards: Array<
    | {
        rewardTokenMint: Address;
        rewardType: string;
        rewardPerSecondDecimals: number;
        minClaimDurationSeconds: number;
        rewardCurve: Array<
          | {
              startTs: number;
              rps: number;
            }
          | undefined
        >;
        rewardAvailable: number;
        rewardToTopUp: number;
        rewardToTopUpDurationDays: number;
      }
    | undefined
  >;
  farmAdmin: Address;
  delegateAuthority: Address;
  pendingFarmAdmin: Address;
  scopePrices: Address;
  scopePriceOracleId: string;
  isRewardUserOnceEnabled: number;
  scopeOracleMaxAge: number;
  lockingMode: number;
  lockingStart: number;
  lockingDuration: number;
  lockingEarlyWithdrawalPenaltyBps: number;
  depositWarmupPeriod: number;
  withdrawCooldownPeriod: number;
  slashedAmountSpillAddress: Address;
  delegatedRpsAdmin: Address;
  secondDelegatedAuthority: Address;
};

export type FarmMetadata = {
  type: string; // strategy or reserve or earnVault
  reserve: Address | undefined;
  reserveSymbol: string | undefined;
  market: Address | undefined;
  marketName: string | undefined;
  strategy: Address | undefined;
  vault: Address | undefined;
};

function getRewardType(rewardTypeNumber: number): string {
  switch (rewardTypeNumber) {
    case RewardType.Proportional.discriminator:
      return RewardType.Proportional.kind;
    case RewardType.Constant.discriminator:
      return RewardType.Constant.kind;
    default:
      throw new Error(`Invalid reward type: ${rewardTypeNumber}`);
  }
}

export function getFarmConfigType(
  farmKey: Address,
  farmState: FarmState,
  farmMetadata: FarmMetadata,
): FarmConfig {
  return {
    farmMetadata,
    farmPubkey: farmKey,
    stakingTokenMint: farmState.token.mint,
    withdrawAuthority: farmState.withdrawAuthority,
    globalConfig: farmState.globalConfig,
    strategyId: farmState.strategyId, // reserve farm
    vaultId: farmState.vaultId,
    depositCapAmount: new Decimal(
      farmState.depositCapAmount.toString(),
    ).toNumber(),
    rewards: farmState.rewardInfos
      .map((rewardInfo) => {
        if (rewardInfo.token.mint !== DEFAULT_PUBLIC_KEY) {
          return {
            rewardTokenMint: rewardInfo.token.mint,
            rewardType: getRewardType(rewardInfo.rewardType),
            rewardPerSecondDecimals: rewardInfo.rewardsPerSecondDecimals,
            minClaimDurationSeconds: new Decimal(
              rewardInfo.minClaimDurationSeconds.toString(),
            ).toNumber(),
            rewardCurve: rewardInfo.rewardScheduleCurve.points
              .map((point) => {
                if (
                  new Decimal(point.rewardPerTimeUnit.toString()).toNumber() !==
                    0 ||
                  point.tsStart.toString() !== U64_MAX
                ) {
                  return {
                    startTs: new Decimal(point.tsStart.toString()).toNumber(),
                    rps: new Decimal(
                      point.rewardPerTimeUnit.toString(),
                    ).toNumber(),
                  };
                }
                return undefined;
              })
              .filter((point) => point !== undefined),
            rewardAvailable: lamportsToCollDecimal(
              new Decimal(rewardInfo.rewardsAvailable.toString()),
              rewardInfo.token.decimals.toNumber(),
            )
              .floor()
              .toNumber(),
            rewardToTopUp: 0,
            rewardToTopUpDurationDays: 0,
          };
        }
        return undefined;
      })
      .filter((rewardInfoConfig) => rewardInfoConfig !== undefined),
    farmAdmin: farmState.farmAdmin,
    pendingFarmAdmin: farmState.pendingFarmAdmin,
    delegateAuthority: farmState.delegateAuthority,
    isRewardUserOnceEnabled: farmState.isRewardUserOnceEnabled,
    scopePrices: farmState.scopePrices,
    scopePriceOracleId: farmState.scopeOraclePriceId.toString(),
    scopeOracleMaxAge: new Decimal(
      farmState.scopeOracleMaxAge.toString(),
    ).toNumber(),
    lockingMode: new Decimal(farmState.lockingMode.toString()).toNumber(),
    lockingStart: new Decimal(
      farmState.lockingStartTimestamp.toString(),
    ).toNumber(),
    lockingDuration: new Decimal(
      farmState.lockingDuration.toString(),
    ).toNumber(),
    lockingEarlyWithdrawalPenaltyBps: new Decimal(
      farmState.lockingEarlyWithdrawalPenaltyBps.toString(),
    ).toNumber(),
    depositWarmupPeriod: farmState.depositWarmupPeriod,
    withdrawCooldownPeriod: farmState.withdrawalCooldownPeriod,
    slashedAmountSpillAddress: farmState.slashedAmountSpillAddress,
    delegatedRpsAdmin: farmState.delegatedRpsAdmin,
    secondDelegatedAuthority: farmState.secondDelegatedAuthority,
  };
}
