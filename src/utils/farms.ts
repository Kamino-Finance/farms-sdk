import {
  getMarketsFromApi,
  KaminoManager,
  KaminoMarket,
  U64_MAX,
} from "@kamino-finance/klend-sdk";
import { Kamino } from "@kamino-finance/kliquidity-sdk";
import { Address, address, Rpc, SolanaRpcApi } from "@solana/kit";
import Decimal from "decimal.js";
import { FarmAndKey, FarmState, lamportsToCollDecimal, RewardType } from "..";
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

export async function getAllFarmConfigsAndStates({
  allFarms,
  klendProgramId,
  rpc,
  logger,
}: {
  allFarms: FarmAndKey[];
  klendProgramId: Address;
  rpc: Rpc<SolanaRpcApi>;
  logger: ILogger;
}): Promise<{
  collateralFarms: IFarmResponse[];
  debtFarms: IFarmResponse[];
  strategyFarms: IFarmResponse[];
  earnVaultFarms: IFarmResponse[];
  standaloneFarms: IFarmResponse[];
}> {
  const lendingMarkets = await getMarketsFromApiData(klendProgramId);

  const fetchedFarmsForStratsAndReserves = new Set<Address>([]);

  // Download for lending based on API markets - all reserve farms
  const maxConcurrent = 30; // Increased for better performance

  const collateralFarms: IFarmResponse[] = [];
  const debtFarms: IFarmResponse[] = [];
  const strategyFarms: IFarmResponse[] = [];
  const earnVaultFarms: IFarmResponse[] = [];
  const standaloneFarms: IFarmResponse[] = [];

  // Process markets in parallel
  const marketPromises: Promise<void>[] = [];
  for (let m = 0; m < lendingMarkets.length; m++) {
    const market = lendingMarkets[m];
    const processMarket = async () => {
      const kaminoMarket = await KaminoMarket.load(
        rpc,
        market.key,
        450,
        klendProgramId,
      );

      if (!kaminoMarket) {
        throw new Error("Kamino market not found");
      }

      // Collect all reserve farm fetching tasks
      const reservePromises: Promise<void>[] = [];
      for (const reserve of kaminoMarket.reserves.values()) {
        const processReserve = async () => {
          if (reserve.state.farmCollateral !== DEFAULT_PUBLIC_KEY) {
            fetchedFarmsForStratsAndReserves.add(reserve.state.farmCollateral);
            const farmStateCollateral = allFarms.find(
              (farm) => farm.key === reserve.state.farmCollateral,
            )?.farmState;
            if (farmStateCollateral) {
              const farmConfig = getFarmConfigType(
                reserve.state.farmCollateral,
                farmStateCollateral,
                {
                  type: "reserve",
                  reserve: reserve.address,
                  reserveSymbol: reserve.symbol,
                  market: market.key,
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
              logger.log("Could not fetch farm", reserve.state.farmCollateral);
            }
          }
          if (reserve.state.farmDebt !== DEFAULT_PUBLIC_KEY) {
            fetchedFarmsForStratsAndReserves.add(reserve.state.farmDebt);
            const farmStateDebt = allFarms.find(
              (farm) => farm.key === reserve.state.farmDebt,
            )?.farmState;
            if (farmStateDebt) {
              const farmConfig = getFarmConfigType(
                reserve.state.farmDebt,
                farmStateDebt,
                {
                  type: "reserve",
                  reserve: reserve.address,
                  reserveSymbol: reserve.symbol,
                  market: market.key,
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
              logger.log("Could not fetch farm", reserve.state.farmDebt);
            }
          }
        };

        reservePromises.push(
          processReserve().catch((err) => {
            logger.error(`Error processing reserve ${reserve.address}:`, err);
          }),
        );

        // Process in batches
        if (reservePromises.length >= maxConcurrent) {
          await Promise.all(reservePromises);
          reservePromises.length = 0;
        }
      }
      // Wait for remaining promises
      if (reservePromises.length > 0) {
        await Promise.all(reservePromises);
      }
    };

    marketPromises.push(
      processMarket().catch((err) => {
        logger.error(`Error processing market ${market.marketName}:`, err);
      }),
    );

    // Process markets in batches
    if (
      marketPromises.length >= maxConcurrent ||
      m === lendingMarkets.length - 1
    ) {
      await Promise.all(marketPromises);
      marketPromises.length = 0;
    }
  }

  // Download for yvaults all strategy farms
  const kamino = new Kamino("mainnet-beta", rpc);

  let strategies = await kamino.getAllStrategiesWithFilters({
    strategyCreationStatus: "LIVE",
  });

  const strategyPromises: Promise<void>[] = [];
  for (let i = 0; i < strategies.length; i++) {
    const strategy = strategies[i];
    const processStrategy = async () => {
      const farmAddress = strategy?.strategy?.farm;
      if (!farmAddress) {
        logger.warn(`Strategy ${strategy?.address} has no farm`);
        return;
      }
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
    };

    strategyPromises.push(
      processStrategy().catch((err) => {
        logger.error(`Error processing strategy ${strategy.address}:`, err);
      }),
    );

    // Process in batches
    if (
      strategyPromises.length >= maxConcurrent ||
      i === strategies.length - 1
    ) {
      await Promise.all(strategyPromises);
      strategyPromises.length = 0;
    }
  }

  // download all vault farms
  const manager = new KaminoManager(rpc, 400);
  const vaults = await manager.getAllVaults();
  const vaultPromises: Promise<void>[] = [];
  for (let i = 0; i < vaults.length; i++) {
    const vault = vaults[i];
    const processVault = async () => {
      const farmAddress = vault?.state?.vaultFarm;
      if (!farmAddress) {
        logger.warn(`Vault ${vault?.address} has no farm`);
        return;
      }
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
    };

    vaultPromises.push(
      processVault().catch((err) => {
        logger.error(`Error processing vault ${vault.address}:`, err);
      }),
    );

    // Process in batches
    if (vaultPromises.length >= maxConcurrent || i === vaults.length - 1) {
      await Promise.all(vaultPromises);
      vaultPromises.length = 0;
    }
  }

  // Download all standalone farms
  for (const farmAndKey of allFarms) {
    // skip farms already downloaded as part of reserves or strategies
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

export async function getMarketsFromApiData(
  programId: Address,
): Promise<{ marketName: string; key: Address }[]> {
  const markets: { marketName: string; key: Address }[] = [];
  await getMarketsFromApi({ programId, source: "API" }).then(
    function (response) {
      for (const marketData of response) {
        markets.push({
          marketName: marketData.description.replace(" ", "-"),
          key: address(marketData.lendingMarket),
        });
      }
    },
  );

  return markets;
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
