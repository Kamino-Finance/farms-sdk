import BN from "bn.js";
import {
  Address,
  address,
  Base58EncodedBytes,
  GetProgramAccountsDatasizeFilter,
  GetProgramAccountsMemcmpFilter,
  IInstruction,
  none,
  Option,
  Rpc,
  Slot,
  SolanaRpcApi,
  some,
  TransactionSigner,
  UnixTimestamp,
} from "@solana/kit";
import {
  calculateCurrentRewardPerToken,
  calculatePendingRewards,
  checkIfAccountExists,
  isValidPubkey,
  collToLamportsDecimal,
  createKeypairRentExemptIx,
  DEFAULT_PUBLIC_KEY,
  getFarmAuthorityPDA,
  getFarmVaultPDA,
  getRewardVaultPDA,
  getTreasuryAuthorityPDA,
  getTreasuryVaultPDA,
  getUserStatePDA,
  GlobalConfigFlagValueType,
  lamportsToCollDecimal,
  scaleDownWads,
  SIZE_FARM_STATE,
  SIZE_GLOBAL_CONFIG,
  decimalToBN,
} from "./utils";
import {
  FarmIncentives,
  IncentiveRewardStats,
  UserFarm,
  UserAndKey,
  FarmAndKey,
} from "./models";
import { FarmState, GlobalConfig, UserState } from "./@codegen/farms/accounts";
import * as farmOperations from "./utils/operations";
import Decimal from "decimal.js";
import {
  FarmConfigOption,
  FarmConfigOptionKind,
  GlobalConfigOptionKind,
  LockingMode,
  RewardInfo,
  RewardType,
  TimeUnit,
} from "./@codegen/farms/types/index";
import { PROGRAM_ID } from "./@codegen/farms/programId";
import { OraclePrices } from "@kamino-finance/scope-sdk/dist/@codegen/scope/accounts";
import { chunks } from "./utils/arrayUtils";
import { batchFetch } from "./utils/batch";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddress,
} from "./utils/token";
import {
  SECONDS_IN_A_DAY,
  SECONDS_IN_A_MONTH,
  SECONDS_IN_A_WEEK,
  SECONDS_IN_A_YEAR,
} from "./consts";

import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { getScopePricesFromFarm } from "./utils/option";
import { getRewardsApyForStrategy } from "./utils";
import { Connection } from "@solana/web3.js";
import { U64_MAX } from "./utils/consts";
import { decompress } from "fzstd";
import { backOff, IBackOffOptions } from "exponential-backoff";
import { ZERO_BN } from "@kamino-finance/kliquidity-sdk";

export interface UserPointsBreakdown {
  totalPoints: Decimal;
  currentBoost: Decimal;
  currentPointsPerDay: Decimal;
  perPositionBoost: Map<Address, Decimal>;
  perPositionPointsPerDay: Map<Address, Decimal>;
}

export interface RewardCurvePoint {
  startTs: number;
  rps: number;
}

const SOLANA_API_RETRY: Partial<IBackOffOptions> = {
  maxDelay: 10 * 1000,
  numOfAttempts: 3,
  retry: (e: any, attemptNumber: number) => {
    // silent retry
    return true;
  },
};

export class Farms {
  private readonly _connection: Rpc<SolanaRpcApi>;
  private readonly _farmsProgramId: Address;

  constructor(
    connection: Rpc<SolanaRpcApi>,
    farmsProgramId: Address = PROGRAM_ID,
  ) {
    this._connection = connection;
    this._farmsProgramId = farmsProgramId;
  }

  getConnection() {
    return this._connection;
  }

  getProgramID() {
    return this._farmsProgramId;
  }

  async getAllUserStatesForUser(user: Address): Promise<Array<UserAndKey>> {
    let filters: (
      | GetProgramAccountsDatasizeFilter
      | GetProgramAccountsMemcmpFilter
    )[] = [];

    filters.push({
      memcmp: {
        bytes: user.toString() as Base58EncodedBytes,
        offset: 48n,
        encoding: "base58",
      },
    });

    filters.push({ dataSize: BigInt(UserState.layout.span + 8) });

    return (
      await this._connection
        .getProgramAccounts(this._farmsProgramId, {
          filters,
          encoding: "base64",
        })
        .send()
    ).map((x) => {
      const userAndKey: UserAndKey = {
        userState: UserState.decode(Buffer.from(x.account.data[0], "base64")),
        key: x.pubkey,
      };
      return userAndKey;
    });
  }

  async getUserStatesForUserAndFarm(
    user: Address,
    farm: Address,
  ): Promise<Array<UserAndKey>> {
    let filters: (
      | GetProgramAccountsDatasizeFilter
      | GetProgramAccountsMemcmpFilter
    )[] = [];

    filters.push({
      memcmp: {
        bytes: user.toString() as Base58EncodedBytes,
        offset: 48n,
        encoding: "base58",
      },
    });
    filters.push({
      memcmp: {
        bytes: farm.toString() as Base58EncodedBytes,
        offset: 16n,
        encoding: "base58",
      },
    });

    filters.push({ dataSize: BigInt(UserState.layout.span + 8) });

    return (
      await this._connection
        .getProgramAccounts(this._farmsProgramId, {
          filters,
          encoding: "base64",
        })
        .send()
    ).map((x) => {
      const userAndKey: UserAndKey = {
        userState: UserState.decode(Buffer.from(x.account.data[0], "base64")),
        key: x.pubkey,
      };
      return userAndKey;
    });
  }

  async getAllUserStates(): Promise<UserAndKey[]> {
    return (
      await this._connection
        .getProgramAccounts(this._farmsProgramId, {
          filters: [{ dataSize: BigInt(UserState.layout.span + 8) }],
          encoding: "base64",
        })
        .send()
    ).map((x) => {
      const userAndKey: UserAndKey = {
        userState: UserState.decode(Buffer.from(x.account.data[0], "base64")),
        key: x.pubkey,
      };
      return userAndKey;
    });
  }

  async getAllUserStatesWithFilter(
    isFarmDelegated: boolean,
  ): Promise<UserAndKey[]> {
    return (
      await this._connection
        .getProgramAccounts(this._farmsProgramId, {
          filters: [
            { dataSize: BigInt(UserState.layout.span + 8) },
            {
              memcmp: {
                offset: 80n,
                bytes: (isFarmDelegated ? "2" : "1") as Base58EncodedBytes,
                encoding: "base58",
              },
            },
          ],
          encoding: "base64",
        })
        .send()
    ).map((x) => {
      const userAndKey: UserAndKey = {
        userState: UserState.decode(Buffer.from(x.account.data[0], "base64")),
        key: x.pubkey,
      };
      return userAndKey;
    });
  }

  /**
   * Get all farms user states from an async generator filled with batches of max 100 user states each
   * @example
   * const userStateGenerator = farms.batchGetAllUserStates();
   * for await (const userStates of userStateGenerator) {
   *   console.log('got a batch of user states:', userStates.length);
   * }
   * @param isFarmDelegated - Optional filter to get only user states for farms that are delegated or not
   */
  async *batchGetAllUserStates(
    isFarmDelegated?: boolean,
  ): AsyncGenerator<UserAndKey[], void, unknown> {
    // Get all farms first and then get user states for each farm
    let farms = await this.getAllFarmStates();

    if (isFarmDelegated !== undefined) {
      farms = farms.filter(
        (farm) => Boolean(farm.farmState.isFarmDelegated) === isFarmDelegated,
      );
    }

    for (const farm of farms) {
      const farmUserStates = await backOff(
        () => this.getAllUserStatesForFarm(farm.key),
        SOLANA_API_RETRY,
      );

      if (farmUserStates.length > 0) {
        // Process in smaller batches to avoid memory issues
        for (const batch of chunks(farmUserStates, 100)) {
          yield batch;
        }
      }
    }
  }

  async getAllUserStatesForFarm(farm: Address): Promise<UserAndKey[]> {
    return (
      await this._connection
        .getProgramAccounts(this._farmsProgramId, {
          filters: [
            { dataSize: BigInt(UserState.layout.span + 8) },
            {
              memcmp: {
                offset: 8n + 8n,
                bytes: farm.toString() as Base58EncodedBytes,
                encoding: "base58",
              },
            },
          ],
          encoding: "base64+zstd",
        })
        .send()
    ).map((x) => {
      const compressedData = Buffer.from(x.account.data[0], "base64");
      const decompressedData = decompress(compressedData);

      const userAndKey: UserAndKey = {
        userState: UserState.decode(Buffer.from(decompressedData)),
        key: x.pubkey,
      };
      return userAndKey;
    });
  }

  async getFarmsForMint(mint: Address): Promise<Array<FarmAndKey>> {
    let filters: (
      | GetProgramAccountsDatasizeFilter
      | GetProgramAccountsMemcmpFilter
    )[] = [];

    filters.push({
      memcmp: {
        bytes: mint.toString() as Base58EncodedBytes,
        offset: 72n,
        encoding: "base58",
      },
    });

    filters.push({ dataSize: BigInt(FarmState.layout.span + 8) });

    return (
      await this._connection
        .getProgramAccounts(this._farmsProgramId, {
          filters,
          encoding: "base64",
        })
        .send()
    ).map((x) => {
      const farmAndKey: FarmAndKey = {
        farmState: FarmState.decode(Buffer.from(x.account.data[0], "base64")),
        key: x.pubkey,
      };
      return farmAndKey;
    });
  }

  async getAllFarmStates(): Promise<FarmAndKey[]> {
    return (
      await this._connection
        .getProgramAccounts(this._farmsProgramId, {
          filters: [{ dataSize: BigInt(FarmState.layout.span + 8) }],
          encoding: "base64",
        })
        .send()
    )
      .map((x) => {
        try {
          const farmAndKey: FarmAndKey = {
            farmState: FarmState.decode(
              Buffer.from(x.account.data[0], "base64"),
            ),
            key: x.pubkey,
          };

          return farmAndKey;
        } catch (err) {
          return null;
        }
      })
      .filter((x) => x !== null) as FarmAndKey[];
  }

  async getAllFarmStatesByPubkeys(keys: Address[]): Promise<FarmAndKey[]> {
    const farmAndKeys: FarmAndKey[] = [];

    const farmStates = await batchFetch(
      keys,
      async (chunk) => await this.fetchMultipleFarmStatesWithCheckedSize(chunk),
    );

    farmStates.forEach((farmState, index) => {
      if (farmState) {
        farmAndKeys.push({ farmState: farmState, key: keys[index] });
      }
    });

    return farmAndKeys;
  }

  async getStakedAmountForFarm(farm: Address): Promise<Decimal> {
    const farmState = await FarmState.fetch(this._connection, farm);
    if (!farmState) {
      throw Error("No Farm found");
    }

    return lamportsToCollDecimal(
      new Decimal(scaleDownWads(farmState.totalActiveStakeScaled)),
      farmState.token.decimals.toNumber(),
    );
  }

  async getStakedAmountForMintForFarm(
    _mint: Address,
    farm: Address,
  ): Promise<Decimal> {
    return this.getStakedAmountForFarm(farm);
  }

  async getStakedAmountForMint(mint: Address): Promise<Decimal> {
    const farms = await this.getFarmsForMint(mint);

    let totalStaked = new Decimal(0);
    for (let index = 0; index < farms.length; index++) {
      totalStaked = totalStaked.add(
        lamportsToCollDecimal(
          new Decimal(farms[index].farmState.totalStakedAmount.toString()),
          farms[index].farmState.token.decimals.toNumber(),
        ),
      );
    }

    return totalStaked;
  }

  async getLockupDurationAndExpiry(
    farm: Address,
    user: Address,
    timestampNow: number,
  ): Promise<{
    lockupRemainingDuration: number;
    farmLockupOriginalDuration: number;
    farmLockupExpiry: number;
  }> {
    let userStateAddress = await getUserStatePDA(
      this._farmsProgramId,
      farm,
      user,
    );

    let userState = await UserState.fetch(this._connection, userStateAddress);

    let farmState = await FarmState.fetch(this._connection, farm);
    if (!farmState) {
      throw new Error("Error fetching farm state");
    }

    let lockingMode = farmState?.lockingMode.toNumber();
    let lockingDuration = farmState?.lockingDuration.toNumber();
    let penalty = farmState.lockingEarlyWithdrawalPenaltyBps.toNumber();

    if (penalty !== 0 && penalty !== 10000) {
      throw "Early withdrawal penalty is not supported yet";
    }

    if (penalty > 10000) {
      throw "Early withdrawal penalty is too high";
    }
    let lockingStart = 0;

    if (lockingMode == LockingMode.None.discriminator) {
      return {
        farmLockupOriginalDuration: 0,
        farmLockupExpiry: 0,
        lockupRemainingDuration: 0,
      };
    }

    if (lockingMode == LockingMode.WithExpiry.discriminator) {
      // Locking starts globally for the entire farm
      lockingStart = farmState?.lockingStartTimestamp.toNumber();
    }
    if (lockingMode == LockingMode.Continuous.discriminator) {
      // Locking starts for each user individually at each stake
      // if the user has a state, else now
      if (userState === null) {
        lockingStart = timestampNow;
      } else {
        if (!userState) {
          throw new Error("Error fetching user state");
        }
        lockingStart = userState.lastStakeTs.toNumber();
      }
    }

    const timestampBeginning = lockingStart;
    const timestampMaturity = lockingStart + lockingDuration;

    if (timestampNow >= timestampMaturity) {
      // Time has passed, no remaining
      return {
        farmLockupOriginalDuration: farmState.lockingDuration.toNumber(),
        farmLockupExpiry: timestampMaturity,
        lockupRemainingDuration: 0,
      };
    }

    if (timestampNow < timestampBeginning) {
      // Time has not started, no remaining
      return {
        farmLockupOriginalDuration: farmState.lockingDuration.toNumber(),
        farmLockupExpiry: timestampMaturity,
        lockupRemainingDuration: 0,
      };
    }

    const timeRemaining = timestampMaturity - timestampNow;
    const remainingLockedDurationSeconds = Math.max(timeRemaining, 0);

    return {
      farmLockupOriginalDuration: farmState.lockingDuration.toNumber(),
      farmLockupExpiry: timestampMaturity,
      lockupRemainingDuration: remainingLockedDurationSeconds,
    };
  }

  async getUserStateKeysForDelegatedFarm(
    user: Address,
    farm: Address,
    delegatees?: Address[],
  ): Promise<Array<UserAndKey>> {
    if (delegatees) {
      return this.getUserStateKeysForDelegatedFarmDeterministic(
        user,
        farm,
        delegatees,
      );
    }
    const userStates = await this.getUserStatesForUserAndFarm(user, farm);
    const userStateKeysForFarm: UserAndKey[] = [];

    for (let index = 0; index < userStates.length; index++) {
      if (userStates[index].userState.farmState === farm) {
        userStateKeysForFarm.push(userStates[index]);
      }
    }

    if (userStateKeysForFarm.length === 0) {
      throw Error("No user state found for user " + user + " for farm " + farm);
    } else {
      return userStateKeysForFarm;
    }
  }

  async getUserStateKeysForDelegatedFarmDeterministic(
    user: Address,
    farm: Address,
    delegatees: Address[],
  ): Promise<Array<UserAndKey>> {
    const userStateKeysForFarm: UserAndKey[] = [];
    const userStateAddresses: Address[] = await Promise.all(
      delegatees.map(async (delegate) => {
        return await getUserStatePDA(this._farmsProgramId, farm, delegate);
      }),
    );

    const userStates = await UserState.fetchMultiple(
      this._connection,
      userStateAddresses,
    );

    userStates.forEach((userState, index) => {
      if (userState && userState.farmState === farm) {
        userStateKeysForFarm.push({
          key: userStateAddresses[index],
          userState: userState,
        });
      }
    });

    if (userStateKeysForFarm.length === 0) {
      throw Error("No user state found for user " + user + " for farm " + farm);
    } else {
      return userStateKeysForFarm;
    }
  }

  async getOraclePrices(farmState: FarmState): Promise<OraclePrices | null> {
    let oraclePrices: OraclePrices | null = null;

    if (farmState.scopePrices !== DEFAULT_PUBLIC_KEY) {
      oraclePrices = await OraclePrices.fetch(
        this._connection,
        farmState.scopePrices,
      );
      if (!oraclePrices) {
        throw new Error("Error fetching oracle prces");
      }
    }

    return oraclePrices;
  }

  filterFarmsForStrategies(
    farmStates: FarmAndKey[],
    strategiesToInclude?: Set<Address>,
  ): FarmAndKey[] {
    if (strategiesToInclude) {
      return farmStates.filter((farmState) =>
        strategiesToInclude.has(farmState.farmState.strategyId),
      );
    }
    return farmStates;
  }

  filterFarmsForVaults(
    farmStates: FarmAndKey[],
    vaultsToInclude?: Set<Address>,
  ): FarmAndKey[] {
    if (vaultsToInclude) {
      return farmStates.filter((farmState) =>
        vaultsToInclude.has(farmState.farmState.vaultId),
      );
    }
    return farmStates;
  }

  async getFarmStatesFromUserStates(
    userStates: UserAndKey[],
    strategiesToInclude?: Set<Address>,
    vaultsToInclude?: Set<Address>,
  ): Promise<FarmAndKey[]> {
    const farmPks = new Set<Address>();
    for (let i = 0; i < userStates.length; i++) {
      farmPks.add(userStates[i].userState.farmState);
    }
    const farmStates = await batchFetch(
      Array.from(farmPks),
      async (chunk) => await this.getAllFarmStatesByPubkeys(chunk),
    );

    if (!farmStates) {
      throw new Error("Error fetching farms");
    }

    let farmStatesFiltered = this.filterFarmsForStrategies(
      farmStates,
      strategiesToInclude,
    );

    farmStatesFiltered = this.filterFarmsForVaults(
      farmStatesFiltered,
      vaultsToInclude,
    );

    return farmStates;
  }

  getUserPendingRewards(
    userState: UserState,
    farmState: FarmState,
    timestamp: Decimal,
    oraclePrices: OraclePrices | null,
  ): { userPendingRewardAmounts: Array<Decimal>; hasReward: boolean } {
    // calculate userState pending rewards
    const userPendingRewardAmounts: Array<Decimal> = [];
    let hasReward = false;

    for (
      let indexReward = 0;
      indexReward < farmState.rewardInfos.length;
      indexReward++
    ) {
      userPendingRewardAmounts[indexReward] = calculatePendingRewards(
        farmState,
        userState,
        indexReward,
        timestamp,
        oraclePrices,
      );

      if (userPendingRewardAmounts[indexReward].gt(0)) {
        hasReward = true;
      }
    }

    return { userPendingRewardAmounts, hasReward };
  }

  async getAllFarmsForUser(
    user: Address,
    timestamp: Decimal,
    strategiesToInclude?: Set<Address>,
    vaultsToInclude?: Set<Address>,
  ): Promise<Map<Address, UserFarm>> {
    const userStates = await this.getAllUserStatesForUser(user);

    const farmStatesFiltered = await this.getFarmStatesFromUserStates(
      userStates,
      strategiesToInclude,
      vaultsToInclude,
    );

    if (farmStatesFiltered.length === 0) {
      // Return empty if no serializable farm states found
      return new Map<Address, UserFarm>();
    }

    const userFarms = new Map<Address, UserFarm>();

    for (let userState of userStates) {
      let farmState = farmStatesFiltered.find(
        (farmState) => farmState.key === userState.userState.farmState,
      );

      if (!farmState) {
        // Skip farms that are not serializable anymore
        continue;
      }

      let oraclePrices = await this.getOraclePrices(farmState.farmState);

      const { userPendingRewardAmounts, hasReward } =
        this.getUserPendingRewards(
          userState.userState,
          farmState.farmState,
          timestamp,
          oraclePrices,
        );

      // add new userFarm state if non empty (has rewards or stake) and not already present
      if (!userFarms.has(userState.userState.farmState)) {
        const userFarm: UserFarm = {
          userStateAddress: userState.key,
          farm: userState.userState.farmState,
          strategyId: farmState.farmState.strategyId,
          delegateAuthority: farmState.farmState.delegateAuthority,
          stakedToken: farmState.farmState.token.mint,
          userState: userState.userState,
          activeStakeByDelegatee: new Map<Address, Decimal>(),
          pendingDepositStakeByDelegatee: new Map<Address, Decimal>(),
          pendingWithdrawalUnstakeByDelegatee: new Map<Address, Decimal>(),
          pendingRewards: new Array(farmState.farmState.rewardInfos.length)
            .fill(undefined)
            .map(function (value, index) {
              return {
                rewardTokenMint: DEFAULT_PUBLIC_KEY,
                rewardTokenProgramId:
                  farmState!.farmState.rewardInfos[index].token.tokenProgram,
                rewardType:
                  farmState?.farmState.rewardInfos[index].rewardType || 0,
                cumulatedPendingRewards: new Decimal(0),
                pendingRewardsByDelegatee: new Map<Address, Decimal>(),
              };
            }),
        };
        if (
          new Decimal(scaleDownWads(userState.userState.activeStakeScaled)).gt(
            0,
          ) ||
          hasReward
        ) {
          // active stake by delegatee
          userFarm.activeStakeByDelegatee.set(
            userState.userState.delegatee,
            lamportsToCollDecimal(
              new Decimal(scaleDownWads(userState.userState.activeStakeScaled)),
              farmState.farmState.token.decimals.toNumber(),
            ),
          );

          // pendingDepositStake by delegatee
          userFarm.pendingDepositStakeByDelegatee.set(
            userState.userState.delegatee,
            new Decimal(
              scaleDownWads(userState.userState.pendingDepositStakeScaled),
            ),
          );

          // pendingWithdrawalUnstake by delegatee
          userFarm.pendingWithdrawalUnstakeByDelegatee.set(
            userState.userState.delegatee,
            new Decimal(
              scaleDownWads(userState.userState.pendingWithdrawalUnstakeScaled),
            ),
          );

          // cumulating rewards
          for (
            let indexReward = 0;
            indexReward < farmState.farmState.rewardInfos.length;
            indexReward++
          ) {
            userFarm.pendingRewards[indexReward].rewardTokenMint =
              farmState.farmState.rewardInfos[indexReward].token.mint;

            userFarm.pendingRewards[indexReward].cumulatedPendingRewards =
              userFarm.pendingRewards[indexReward].cumulatedPendingRewards.add(
                userPendingRewardAmounts[indexReward],
              );

            userFarm.pendingRewards[indexReward].pendingRewardsByDelegatee.set(
              userState.userState.delegatee,
              userPendingRewardAmounts[indexReward],
            );
          }

          // set updated userFarm
          userFarms.set(userState.userState.farmState, userFarm);
        } else {
          // skip as we are not accounting for empty userFarms
          continue;
        }
      }
    }

    return userFarms;
  }

  async getRewardsAPYForStrategy(
    strategy: Address,
    rpcEndpoint: string,
  ): Promise<FarmIncentives> {
    const legacyConnection = new Connection(rpcEndpoint);
    const farmIncentives = await getRewardsApyForStrategy(
      this.getConnection(),
      legacyConnection,
      strategy,
    );
    return farmIncentives;
  }

  async getAllFarmsForUserMultiState(
    user: Address,
    timestamp: Decimal,
    strategiesToInclude?: Set<Address>,
    vaultsToInclude?: Set<Address>,
  ): Promise<Map<Address, UserFarm[]>> {
    const userStates = await this.getAllUserStatesForUser(user);

    const farmStatesFiltered = await this.getFarmStatesFromUserStates(
      userStates,
      strategiesToInclude,
      vaultsToInclude,
    );

    if (farmStatesFiltered.length === 0) {
      // Return empty if no serializable farm states found
      return new Map<Address, UserFarm[]>();
    }

    const userFarmsByFarm = new Map<Address, UserFarm[]>();

    for (let userState of userStates) {
      let farmState = farmStatesFiltered.find(
        (farmState) => farmState.key === userState.userState.farmState,
      );

      if (!farmState) {
        // Skip farms that are not serializable anymore
        continue;
      }

      let oraclePrices = await this.getOraclePrices(farmState.farmState);

      const { userPendingRewardAmounts, hasReward } =
        this.getUserPendingRewards(
          userState.userState,
          farmState.farmState,
          timestamp,
          oraclePrices,
        );

      // Only add if there's a reward or active stake
      if (
        !new Decimal(scaleDownWads(userState.userState.activeStakeScaled)).gt(
          0,
        ) &&
        !hasReward
      ) {
        continue;
      }

      // Create a new UserFarm instance
      const userFarm: UserFarm = {
        userStateAddress: userState.key,
        farm: userState.userState.farmState,
        strategyId: farmState.farmState.strategyId,
        delegateAuthority: farmState.farmState.delegateAuthority,
        stakedToken: farmState.farmState.token.mint,
        userState: userState.userState,
        activeStakeByDelegatee: new Map<Address, Decimal>(),
        pendingDepositStakeByDelegatee: new Map<Address, Decimal>(),
        pendingWithdrawalUnstakeByDelegatee: new Map<Address, Decimal>(),
        pendingRewards: new Array(farmState.farmState.rewardInfos.length)
          .fill(undefined)
          .map(function (value, index) {
            return {
              rewardTokenMint:
                farmState!.farmState.rewardInfos[index].token.mint,
              rewardTokenProgramId:
                farmState!.farmState.rewardInfos[index].token.tokenProgram,
              rewardType:
                farmState?.farmState.rewardInfos[index].rewardType || 0,
              cumulatedPendingRewards: new Decimal(0),
              pendingRewardsByDelegatee: new Map<Address, Decimal>(),
            };
          }),
      };

      // active stake by delegatee
      userFarm.activeStakeByDelegatee.set(
        userState.userState.delegatee,
        lamportsToCollDecimal(
          new Decimal(scaleDownWads(userState.userState.activeStakeScaled)),
          farmState.farmState.token.decimals.toNumber(),
        ),
      );

      // pendingDepositStake by delegatee
      userFarm.pendingDepositStakeByDelegatee.set(
        userState.userState.delegatee,
        new Decimal(
          scaleDownWads(userState.userState.pendingDepositStakeScaled),
        ),
      );

      // pendingWithdrawalUnstake by delegatee
      userFarm.pendingWithdrawalUnstakeByDelegatee.set(
        userState.userState.delegatee,
        new Decimal(
          scaleDownWads(userState.userState.pendingWithdrawalUnstakeScaled),
        ),
      );

      // cumulating rewards
      for (
        let indexReward = 0;
        indexReward < farmState.farmState.rewardInfos.length;
        indexReward++
      ) {
        userFarm.pendingRewards[indexReward].rewardTokenMint =
          farmState.farmState.rewardInfos[indexReward].token.mint;

        userFarm.pendingRewards[indexReward].cumulatedPendingRewards =
          userPendingRewardAmounts[indexReward];

        userFarm.pendingRewards[indexReward].pendingRewardsByDelegatee.set(
          userState.userState.delegatee,
          userPendingRewardAmounts[indexReward],
        );
      }

      // Add the userFarm to the array for the corresponding farm
      if (!userFarmsByFarm.has(userState.userState.farmState)) {
        userFarmsByFarm.set(userState.userState.farmState, [userFarm]);
      } else {
        userFarmsByFarm.get(userState.userState.farmState)!.push(userFarm);
      }
    }

    return userFarmsByFarm;
  }

  async getUserStateKeyForUndelegatedFarm(
    user: Address,
    farmAddress: Address,
  ): Promise<UserAndKey> {
    const userStateAddress = await getUserStatePDA(
      this._farmsProgramId,
      farmAddress,
      user,
    );

    const userState = await UserState.fetch(this._connection, userStateAddress);
    if (!userState) {
      throw new Error(`User state not found ${userStateAddress.toString()}`);
    }

    return { key: userStateAddress, userState: userState };
  }

  async getUserTokensInUndelegatedFarm(
    user: Address,
    farm: Address,
    tokenDecimals: number,
  ): Promise<Decimal> {
    const userState = await this.getUserStateKeyForUndelegatedFarm(user, farm);

    return lamportsToCollDecimal(
      new Decimal(scaleDownWads(userState.userState.activeStakeScaled)),
      tokenDecimals,
    );
  }

  async getUserForUndelegatedFarm(
    user: Address,
    farmAddress: Address,
    timestamp: Decimal,
  ): Promise<UserFarm> {
    const farmState = await FarmState.fetch(this._connection, farmAddress);
    if (!farmState) {
      throw new Error(`Farm not found ${farmAddress.toString()}`);
    }

    const userStateAddress = await getUserStatePDA(
      this._farmsProgramId,
      farmAddress,
      user,
    );

    const userState = await UserState.fetch(this._connection, userStateAddress);
    if (!userState) {
      throw new Error(`User state not found ${userStateAddress.toString()}`);
    }

    const userFarm: UserFarm = {
      userStateAddress: userStateAddress,
      farm: farmAddress,
      userState,
      strategyId: farmState.strategyId,
      delegateAuthority: farmState.delegateAuthority,
      stakedToken: farmState.token.mint,
      activeStakeByDelegatee: new Map<Address, Decimal>(),
      pendingDepositStakeByDelegatee: new Map<Address, Decimal>(),
      pendingWithdrawalUnstakeByDelegatee: new Map<Address, Decimal>(),
      pendingRewards: new Array(farmState.rewardInfos.length)
        .fill(undefined)
        .map(function (value, index) {
          return {
            rewardTokenMint: DEFAULT_PUBLIC_KEY,
            rewardTokenProgramId:
              farmState?.rewardInfos[index].token.tokenProgram,
            rewardType: farmState?.rewardInfos[index].rewardType || 0,
            cumulatedPendingRewards: new Decimal(0),
            pendingRewardsByDelegatee: new Map<Address, Decimal>(),
          };
        }),
    };

    // active stake
    userFarm.activeStakeByDelegatee.set(
      user,
      lamportsToCollDecimal(
        new Decimal(scaleDownWads(userState.activeStakeScaled)),
        farmState.token.decimals.toNumber(),
      ),
    );

    // pendingDepositStake
    userFarm.pendingDepositStakeByDelegatee.set(
      user,
      new Decimal(scaleDownWads(userState.pendingDepositStakeScaled)),
    );

    // pendingWithdrawalUnstake
    userFarm.pendingWithdrawalUnstakeByDelegatee.set(
      user,
      new Decimal(scaleDownWads(userState.pendingWithdrawalUnstakeScaled)),
    );

    // get oraclePrices
    let oraclePrices: OraclePrices | null = null;
    if (farmState.scopePrices !== DEFAULT_PUBLIC_KEY) {
      oraclePrices = await OraclePrices.fetch(
        this._connection,
        farmState.scopePrices,
      );
      if (!oraclePrices) {
        throw new Error("Error fetching oracle prices");
      }
    }

    const userPendingRewardAmounts: Decimal[] = [];
    for (
      let indexReward = 0;
      indexReward < farmState.rewardInfos.length;
      indexReward++
    ) {
      // calculate pending rewards
      userPendingRewardAmounts[indexReward] = calculatePendingRewards(
        farmState,
        userState,
        indexReward,
        timestamp,
        oraclePrices,
      );

      userFarm.pendingRewards[indexReward].rewardTokenMint =
        farmState.rewardInfos[indexReward].token.mint;

      userFarm.pendingRewards[indexReward].cumulatedPendingRewards =
        userPendingRewardAmounts[indexReward];

      userFarm.pendingRewards[indexReward].pendingRewardsByDelegatee.set(
        user,
        userPendingRewardAmounts[indexReward],
      );
    }

    return userFarm;
  }

  async createNewUserIx(
    authority: TransactionSigner,
    farm: Address,
    user: Address = authority.address,
    delegatee: Address = user,
  ): Promise<IInstruction> {
    const userState = await getUserStatePDA(this._farmsProgramId, farm, user);

    const ix = farmOperations.initializeUser(
      farm,
      user,
      userState,
      authority,
      delegatee,
    );

    return ix;
  }

  async stakeIx(
    user: TransactionSigner,
    farm: Address,
    amountLamports: Decimal,
    stakeTokenMint: Address,
    scopePrices: Option<Address>,
  ): Promise<IInstruction> {
    const farmVault = await getFarmVaultPDA(
      this._farmsProgramId,
      farm,
      stakeTokenMint,
    );
    const userStatePk = await getUserStatePDA(
      this._farmsProgramId,
      farm,
      user.address,
    );
    const userTokenAta = await getAssociatedTokenAddress(
      user.address,
      stakeTokenMint,
      TOKEN_PROGRAM_ADDRESS,
    );

    const ix = farmOperations.stake(
      user,
      userStatePk,
      userTokenAta,
      farm,
      farmVault,
      stakeTokenMint,
      scopePrices,
      decimalToBN(amountLamports),
    );
    return ix;
  }

  async unstakeIx(
    user: TransactionSigner,
    farm: Address,
    amountLamports: Decimal,
    scopePrices: Option<Address>,
  ): Promise<IInstruction> {
    const userStatePk = await getUserStatePDA(
      this._farmsProgramId,
      farm,
      user.address,
    );

    const ix = farmOperations.unstake(
      user,
      userStatePk,
      farm,
      scopePrices,
      decimalToBN(amountLamports),
    );
    return ix;
  }

  async withdrawUnstakedDepositIx(
    user: TransactionSigner,
    userState: Address,
    farmState: Address,
    stakeTokenMint: Address,
  ): Promise<IInstruction> {
    const userTokenAta = await getAssociatedTokenAddress(
      user.address,
      stakeTokenMint,
      TOKEN_PROGRAM_ADDRESS,
    );
    const farmVault = await getFarmVaultPDA(
      this._farmsProgramId,
      farmState,
      stakeTokenMint,
    );
    const farmVaultsAuthority = await getFarmAuthorityPDA(
      this._farmsProgramId,
      farmState,
    );

    return farmOperations.withdrawUnstakedDeposit(
      user,
      userState,
      farmState,
      userTokenAta,
      farmVault,
      farmVaultsAuthority,
    );
  }

  async claimForUserForFarmRewardIx(
    user: TransactionSigner,
    farm: Address,
    rewardMint: Address,
    isDelegated: boolean,
    rewardIndex = -1,
    delegatees?: Address[],
  ): Promise<[[Address, IInstruction][], IInstruction[]]> {
    const ixns: IInstruction[] = [];
    const ataIxns: [Address, IInstruction][] = [];

    const userStatesAndKeys = isDelegated
      ? await this.getUserStateKeysForDelegatedFarm(
          user.address,
          farm,
          delegatees,
        )
      : [await this.getUserStateKeyForUndelegatedFarm(user.address, farm)];
    const farmState = await FarmState.fetch(this._connection, farm);
    if (!farmState) {
      throw new Error(`Farm not found ${farm.toString()}`);
    }

    const treasuryVault = await getTreasuryVaultPDA(
      this._farmsProgramId,
      farmState.globalConfig,
      rewardMint,
    );

    // find rewardIndex if not defined
    if (rewardIndex === -1) {
      rewardIndex = farmState.rewardInfos.findIndex(
        (r) => r.token.mint === rewardMint,
      );
    }

    const rewardsTokenProgram =
      farmState.rewardInfos[rewardIndex].token.tokenProgram;
    const userRewardAta = await getAssociatedTokenAddress(
      user.address,
      rewardMint,
      rewardsTokenProgram,
    );
    const ataExists = await checkIfAccountExists(
      this._connection,
      userRewardAta,
    );

    if (!ataExists) {
      const [, ix] = await createAssociatedTokenAccountIdempotentInstruction(
        user,
        rewardMint,
        rewardsTokenProgram,
        user.address,
        userRewardAta,
      );
      ataIxns.push([rewardMint, ix]);
    }

    for (
      let userStateIndex = 0;
      userStateIndex < userStatesAndKeys.length;
      userStateIndex++
    ) {
      const ix = farmOperations.harvestReward(
        user,
        userStatesAndKeys[userStateIndex].key,
        userRewardAta,
        farmState.globalConfig,
        treasuryVault,
        farm,
        rewardMint,
        farmState.rewardInfos[rewardIndex].rewardsVault,
        farmState.farmVaultsAuthority,
        getScopePricesFromFarm(farmState),
        rewardsTokenProgram,
        rewardIndex,
      );
      ixns.push(ix);
    }
    return [ataIxns, ixns];
  }

  async claimForUserForFarmAllRewardsIx(
    user: TransactionSigner,
    farm: Address,
    isDelegated: boolean,
    delegatees?: Address[],
  ): Promise<Array<IInstruction>> {
    const farmState = await FarmState.fetch(this._connection, farm);
    const userStatesAndKeys = isDelegated
      ? await this.getUserStateKeysForDelegatedFarm(
          user.address,
          farm,
          delegatees,
        )
      : [await this.getUserStateKeyForUndelegatedFarm(user.address, farm)];
    const ixs = new Array<IInstruction>();
    // hardcoded as a hotfix for JTO release;
    // TODO: replace by proper fix
    const jitoFarm = address("Cik985zLyHYdv5Hs73BUWUcMHMhgfBNwbcCYyvBjV2tt");

    if (!farmState) {
      throw new Error(`Farm not found ${farm.toString()}`);
    }

    for (
      let userStateIndex = 0;
      userStateIndex < userStatesAndKeys.length;
      userStateIndex++
    ) {
      for (
        let rewardIndex = 0;
        rewardIndex < farmState.numRewardTokens.toNumber();
        rewardIndex++
      ) {
        if (
          jitoFarm !== farm &&
          farmState.rewardInfos[rewardIndex].rewardType ==
            RewardType.Constant.discriminator
        ) {
          continue;
        }
        const rewardMint = farmState.rewardInfos[rewardIndex].token.mint;
        const rewardTokenProgram =
          farmState.rewardInfos[rewardIndex].token.tokenProgram;

        const userRewardAta = await getAssociatedTokenAddress(
          user.address,
          rewardMint,
          rewardTokenProgram,
        );
        const treasuryVault = await getTreasuryVaultPDA(
          this._farmsProgramId,
          farmState.globalConfig,
          rewardMint,
        );
        const ataExists = await checkIfAccountExists(
          this._connection,
          userRewardAta,
        );

        if (!ataExists) {
          const [, ix] =
            await createAssociatedTokenAccountIdempotentInstruction(
              user,
              rewardMint,
              rewardTokenProgram,
              user.address,
              userRewardAta,
            );

          ixs.push(ix);
        }
        ixs.push(
          farmOperations.harvestReward(
            user,
            userStatesAndKeys[userStateIndex].key,
            userRewardAta,
            farmState.globalConfig,
            treasuryVault,
            farm,
            rewardMint,
            farmState.rewardInfos[rewardIndex].rewardsVault,
            farmState.farmVaultsAuthority,
            getScopePricesFromFarm(farmState),
            rewardTokenProgram,
            rewardIndex,
          ),
        );
      }
    }

    return ixs;
  }

  async transferOwnershipIx(
    user: TransactionSigner,
    userState: Address,
    newUser: Address,
  ): Promise<IInstruction> {
    const userStateData = await UserState.fetch(
      this._connection,
      userState,
      this._farmsProgramId,
    );
    if (!userStateData) {
      throw new Error(`User state not found ${userState.toString()}`);
    }
    const farmState = await FarmState.fetch(
      this._connection,
      userStateData.farmState,
      this._farmsProgramId,
    );
    if (!farmState) {
      throw new Error(
        `Farm state not found ${userStateData.farmState.toString()}`,
      );
    }

    this.validateFarmStateForTransferOwnership(farmState);

    const newOwnerUserState = await getUserStatePDA(
      PROGRAM_ID,
      userStateData.farmState,
      newUser,
    );

    return farmOperations.transferOwnership(
      user,
      userState,
      newUser,
      userStateData.farmState,
      newOwnerUserState,
      getScopePricesFromFarm(farmState),
    );
  }

  validateFarmStateForTransferOwnership(farmState: FarmState): void {
    if (farmState.lockingMode.toNumber() !== LockingMode.None.discriminator) {
      throw new Error(
        "Transfer ownership is not allowed for farms with a locking mode",
      );
    }

    if (farmState.isFarmDelegated) {
      throw new Error("Transfer ownership is not allowed for delegated farms");
    }

    if (farmState.withdrawalCooldownPeriod > 0) {
      throw new Error(
        "Transfer ownership is not allowed for farms with a withdrawal cooldown period",
      );
    }
  }

  async transferOwnershipAllUserStatesIx(
    user: TransactionSigner,
    newUser: Address,
  ): Promise<Array<IInstruction>> {
    const userStates = await this.getAllUserStatesForUser(user.address);

    const farms = await this.getFarmStatesFromUserStates(userStates);

    const ixs = new Array<IInstruction>();
    for (let index = 0; index < userStates.length; index++) {
      const farmAddress = userStates[index].userState.farmState;
      const farmState = farms.find((farm) => farm.key === farmAddress);

      if (!farmState) {
        throw new Error(
          `Farm state not found for user state ${userStates[index].key}`,
        );
      }

      this.validateFarmStateForTransferOwnership(farmState.farmState);

      const newOwnerUserState = await getUserStatePDA(
        PROGRAM_ID,
        farmAddress,
        newUser,
      );

      ixs[index] = farmOperations.transferOwnership(
        user,
        userStates[index].key,
        newUser,
        farmAddress,
        newOwnerUserState,
        getScopePricesFromFarm(farmState.farmState),
      );
    }

    return ixs;
  }

  async createFarmIxs(
    admin: TransactionSigner,
    farm: TransactionSigner,
    globalConfig: Address,
    stakeTokenMint: Address,
  ): Promise<IInstruction[]> {
    const farmVault = await getFarmVaultPDA(
      this._farmsProgramId,
      farm.address,
      stakeTokenMint,
    );
    const farmVaultAuthority = await getFarmAuthorityPDA(
      this._farmsProgramId,
      farm.address,
    );

    let ixs: IInstruction[] = [];
    ixs.push(
      await createKeypairRentExemptIx(
        this.getConnection(),
        admin,
        farm,
        SIZE_FARM_STATE,
        this._farmsProgramId,
      ),
    );

    ixs.push(
      farmOperations.initializeFarm(
        globalConfig,
        admin,
        farm.address,
        farmVault,
        farmVaultAuthority,
        stakeTokenMint,
      ),
    );
    return ixs;
  }

  async createFarmDelegatedIx(
    admin: TransactionSigner,
    farm: TransactionSigner,
    globalConfig: Address,
    farmDelegate: TransactionSigner,
  ): Promise<IInstruction[]> {
    const farmVaultAuthority = await getFarmAuthorityPDA(
      this._farmsProgramId,
      farm.address,
    );

    let ixs: IInstruction[] = [];
    ixs.push(
      await createKeypairRentExemptIx(
        this.getConnection(),
        admin,
        farm,
        SIZE_FARM_STATE,
        this._farmsProgramId,
      ),
    );

    ixs.push(
      farmOperations.initializeFarmDelegated(
        globalConfig,
        admin,
        farm.address,
        farmVaultAuthority,
        farmDelegate,
      ),
    );
    return ixs;
  }

  async addRewardToFarmIx(
    admin: TransactionSigner,
    globalConfig: Address,
    farm: Address,
    mint: Address,
    tokenProgram: Address,
  ): Promise<IInstruction> {
    const globalConfigState = await GlobalConfig.fetch(
      this._connection,
      globalConfig,
    );
    if (!globalConfigState) {
      throw new Error("Could not fetch global config");
    }
    const treasuryVault = await getTreasuryVaultPDA(
      this._farmsProgramId,
      globalConfig,
      mint,
    );
    let farmVaultAuthority = await getFarmAuthorityPDA(
      this._farmsProgramId,
      farm,
    );

    const rewardVault = await getRewardVaultPDA(
      this._farmsProgramId,
      farm,
      mint,
    );

    const ix = farmOperations.initializeReward(
      globalConfig,
      globalConfigState.treasuryVaultsAuthority,
      treasuryVault,
      admin,
      farm,
      rewardVault,
      farmVaultAuthority,
      mint,
      tokenProgram,
    );
    return ix;
  }

  async addRewardAmountToFarmIx(
    payer: TransactionSigner,
    farm: Address,
    mint: Address,
    amount: Decimal,
    rewardIndexOverride: number = -1,
    decimalsOverride: number = -1,
    tokenProgramOverride: Address = TOKEN_PROGRAM_ADDRESS,
    scopePricesOverride: Option<Address> = none(),
  ): Promise<IInstruction> {
    let decimals = decimalsOverride;

    let rewardIndex = rewardIndexOverride;
    let scopePrices = scopePricesOverride;
    let tokenProgram = tokenProgramOverride;
    if (rewardIndex == -1) {
      const farmState = await FarmState.fetch(this._connection, farm);
      if (!farmState) {
        throw new Error(`Could not fetch farm state ${farm}`);
      }
      scopePrices = getScopePricesFromFarm(farmState);

      for (let i = 0; farmState.rewardInfos.length; i++) {
        if (farmState.rewardInfos[i].token.mint === mint) {
          if (
            farmState.rewardInfos[i].token.tokenProgram !== DEFAULT_PUBLIC_KEY
          ) {
            tokenProgram = farmState.rewardInfos[i].token.tokenProgram;
          }
          rewardIndex = i;
          decimals = farmState.rewardInfos[i].token.decimals.toNumber();
          break;
        }
      }
    }

    if (decimals == -1) {
      throw new Error(`Could not find reward token ${mint}`);
    }

    let amountLamports = new BN(
      collToLamportsDecimal(amount, decimals).floor().toString(),
    );

    const payerRewardAta = await getAssociatedTokenAddress(
      payer.address,
      mint,
      tokenProgram,
    );
    let rewardVault = await getRewardVaultPDA(this._farmsProgramId, farm, mint);
    let farmVaultsAuthority = await getFarmAuthorityPDA(
      this._farmsProgramId,
      farm,
    );

    const ix = farmOperations.addReward(
      payer,
      farm,
      rewardVault,
      farmVaultsAuthority,
      payerRewardAta,
      mint,
      scopePrices,
      rewardIndex,
      tokenProgram,
      amountLamports,
    );
    return ix;
  }

  async withdrawRewardAmountFromFarmIx(
    payer: TransactionSigner,
    farm: Address,
    mint: Address,
    amount: Decimal,
    rewardIndexOverride: number = -1,
    decimalsOverride: number = -1,
    tokenProgramOverride: Address = TOKEN_PROGRAM_ADDRESS,
    scopePricesOverride: Option<Address> = none(),
  ): Promise<IInstruction[]> {
    let decimals = decimalsOverride;
    let tokenProgram = tokenProgramOverride;

    let rewardIndex = rewardIndexOverride;
    let scopePrices = scopePricesOverride;
    if (rewardIndex == -1) {
      const farmState = await FarmState.fetch(this._connection, farm);
      if (!farmState) {
        throw new Error(`Could not fetch farm state ${farm}`);
      }
      scopePrices = getScopePricesFromFarm(farmState);

      for (let i = 0; farmState.rewardInfos.length; i++) {
        if (farmState.rewardInfos[i].token.mint === mint) {
          rewardIndex = i;
          decimals = farmState.rewardInfos[i].token.decimals.toNumber();
          tokenProgram = farmState.rewardInfos[i].token.tokenProgram;
          break;
        }
      }
    }

    if (decimals == -1) {
      throw new Error(`Could not find reward token ${mint}`);
    }

    let amountLamports = new BN(
      collToLamportsDecimal(amount, decimals).floor().toString(),
    );

    let rewardVault = await getRewardVaultPDA(this._farmsProgramId, farm, mint);
    let farmVaultsAuthority = await getFarmAuthorityPDA(
      this._farmsProgramId,
      farm,
    );

    const [payerRewardAta, initAtaIdempotentIx] =
      await createAssociatedTokenAccountIdempotentInstruction(
        payer,
        mint,
        tokenProgram,
        payer.address,
      );

    const ix = farmOperations.withdrawReward(
      payer,
      farm,
      mint,
      rewardVault,
      farmVaultsAuthority,
      payerRewardAta,
      scopePrices,
      tokenProgram,
      rewardIndex,
      amountLamports,
    );
    return [initAtaIdempotentIx, ix];
  }

  async updateFarmConfigIx(
    admin: TransactionSigner,
    farm: Address,
    mint: Address,
    mode: FarmConfigOptionKind,
    value: number | Address | number[] | RewardCurvePoint[] | BN,
    rewardIndexOverride: number = -1,
    scopePricesOverride: Option<Address> = none(),
    newFarm: boolean = false,
  ): Promise<IInstruction> {
    let rewardIndex = rewardIndexOverride;
    let scopePrices = scopePricesOverride;
    if (rewardIndex == -1 && !newFarm) {
      const farmState = await FarmState.fetch(this._connection, farm);
      if (!farmState) {
        throw new Error(`Could not fetch farm state ${farm}`);
      }

      if (farmState.scopePrices !== DEFAULT_PUBLIC_KEY) {
        scopePrices = some(farmState.scopePrices);
      }

      for (let i = 0; farmState.rewardInfos.length; i++) {
        if (farmState.rewardInfos[i].token.mint === mint) {
          rewardIndex = i;
          break;
        }
      }
    }

    const ix = farmOperations.updateFarmConfig(
      admin,
      farm,
      scopePrices,
      rewardIndex,
      mode,
      value,
    );
    return ix;
  }

  async refreshFarmIx(
    farm: Address,
    scopePrices: Option<Address>,
  ): Promise<IInstruction> {
    return farmOperations.refreshFarm(farm, scopePrices);
  }

  async refreshUserIx(
    userState: Address,
    farmState: Address,
    scopePrices: Option<Address>,
  ): Promise<IInstruction> {
    return farmOperations.refreshUserState(userState, farmState, scopePrices);
  }

  async createGlobalConfigIxs(
    admin: TransactionSigner,
    globalConfig: TransactionSigner,
  ): Promise<IInstruction[]> {
    let ixs: IInstruction[] = [];

    ixs.push(
      await createKeypairRentExemptIx(
        this.getConnection(),
        admin,
        globalConfig,
        SIZE_GLOBAL_CONFIG,
        this._farmsProgramId,
      ),
    );

    const treasuryVaultAuthority = await getTreasuryAuthorityPDA(
      this._farmsProgramId,
      globalConfig.address,
    );

    ixs.push(
      farmOperations.initializeGlobalConfig(
        admin,
        globalConfig.address,
        treasuryVaultAuthority,
      ),
    );

    return ixs;
  }

  async updateGlobalConfigIx(
    admin: TransactionSigner,
    globalConfig: Address,
    mode: GlobalConfigOptionKind,
    flagValue: string,
    flagValueType: GlobalConfigFlagValueType,
  ): Promise<IInstruction> {
    const ix = farmOperations.updateGlobalConfig(
      admin,
      globalConfig,
      mode,
      flagValue,
      flagValueType,
    );

    return ix;
  }

  async updateGlobalConfigAdminIx(
    admin: TransactionSigner,
    globalConfig: Address,
  ): Promise<IInstruction> {
    return farmOperations.updateGlobalConfigAdmin(admin, globalConfig);
  }

  async updateSecondDelegatedAuthorityIx(
    admin: TransactionSigner,
    globalConfig: Address,
    farm: Address,
    newSecondDelegatedAuthority: Address,
  ): Promise<IInstruction> {
    return farmOperations.updateSecondDelegatedAuthority(
      admin,
      globalConfig,
      farm,
      newSecondDelegatedAuthority,
    );
  }

  async updateFarmAdminIx(
    admin: TransactionSigner,
    farm: Address,
  ): Promise<IInstruction> {
    return farmOperations.updateFarmAdmin(admin, farm);
  }

  async withdrawTreasuryIx(
    admin: TransactionSigner,
    globalConfig: Address,
    rewardMint: Address,
    rewardTokenProgram: Address,
    amount: BN,
    withdrawAta?: Address,
  ): Promise<IInstruction> {
    const treasuryVault = await getTreasuryVaultPDA(
      this._farmsProgramId,
      globalConfig,
      rewardMint,
    );
    const treasuryVaultAuthority = await getTreasuryAuthorityPDA(
      this._farmsProgramId,
      globalConfig,
    );
    if (!withdrawAta) {
      withdrawAta = await getAssociatedTokenAddress(
        admin.address,
        rewardMint,
        rewardTokenProgram,
      );
    }

    return farmOperations.withdrawTreasury(
      admin,
      globalConfig,
      treasuryVault,
      treasuryVaultAuthority,
      withdrawAta,
      amount,
      rewardMint,
    );
  }

  async updateFarmRpsForRewardIx(
    payer: TransactionSigner,
    rewardMint: Address,
    farm: Address,
    rewardsPerSecond: number,
  ): Promise<IInstruction> {
    const farmsClient = new Farms(this._connection);

    const farmState = await FarmState.fetch(
      this._connection,
      farm,
      farmsClient.getProgramID(),
    );

    if (!farmState) {
      throw new Error("Farm not found");
    }

    let rewardIndex: number = 0;

    const rewardInfo = farmState.rewardInfos.find((info, index) => {
      rewardIndex = index;
      return info.token.mint === rewardMint;
    });

    if (!rewardInfo) {
      throw new Error("Reward not found in farm");
    }

    const currentRewardScheduleCruve = rewardInfo.rewardScheduleCurve;

    let newRewardScheduleCurve: RewardCurvePoint[] = [];

    for (let point of currentRewardScheduleCruve.points) {
      if (
        point.tsStart.toString() === U64_MAX &&
        point.rewardPerTimeUnit.toNumber() === 0
      ) {
        newRewardScheduleCurve.push({
          startTs: Date.now(),
          rps: rewardsPerSecond,
        });
        break;
      }
      {
        newRewardScheduleCurve.push({
          startTs: new Decimal(point.tsStart.toString()).toNumber(),
          rps: new Decimal(point.rewardPerTimeUnit.toString()).toNumber(),
        });
      }
    }

    return await this.updateFarmConfigIx(
      payer,
      farm,
      rewardMint,
      FarmConfigOption.fromDecoded({
        [FarmConfigOption.UpdateRewardScheduleCurvePoints.kind]: "",
      }),
      newRewardScheduleCurve,
      rewardIndex,
    );
  }

  async topUpFarmForRewardIx(
    payer: TransactionSigner,
    rewardMint: Address,
    farm: Address,
    amountToTopUp: Decimal,
  ): Promise<IInstruction> {
    const farmState = await FarmState.fetch(
      this._connection,
      farm,
      this.getProgramID(),
    );

    if (!farmState) {
      throw new Error("Farm not found");
    }

    let rewardIndex: number = 0;

    const rewardInfo = farmState.rewardInfos.find((info, index) => {
      rewardIndex = index;
      return info.token.mint === rewardMint;
    });

    if (!rewardInfo) {
      throw new Error("Reward not found in farm");
    }

    return await this.addRewardAmountToFarmIx(
      payer,
      farm,
      rewardMint,
      amountToTopUp,
      rewardIndex,
    );
  }

  async fetchMultipleFarmStatesWithCheckedSize(
    keys: Address[],
  ): Promise<(FarmState | null)[]> {
    // Custom deserialization to avoid fetching non-serializable accounts
    const farmStateSize = BigInt(FarmState.layout.span + 8);
    const infos = await this._connection.getMultipleAccounts(keys).send();
    return infos.value.map((info) => {
      if (info === null) {
        return null;
      }
      if (info.space !== farmStateSize) {
        // check if account matches expected size (deserializable)
        return null;
      }
      if (info.owner !== this._farmsProgramId) {
        throw new Error("account doesn't belong to this program");
      }

      return FarmState.decode(Buffer.from(info.data[0], "base64"));
    });
  }

  private async processRewardInfos(
    farmState: FarmState,
    totalActiveStakeValue: Decimal,
    totalActiveStakeAmount: Decimal,
    getPriceByTokenMintDecimal: (mint: Address) => Promise<Decimal>,
    pricesMap?: Map<Address, Decimal>,
    verbose: boolean = false,
  ): Promise<IncentiveRewardStats[]> {
    return await Promise.all(
      farmState.rewardInfos
        .filter((reward) => isValidPubkey(reward.token.mint))
        .map(async (reward) => {
          const { token: rewardToken } = reward;

          // Find the more recent timestamp and rps
          let rewardAmountPerUnit = this.getRewardPerTimeUnitSecond(reward);

          if (
            rewardAmountPerUnit.eq(0) ||
            reward.rewardsAvailable.eq(ZERO_BN)
          ) {
            return {
              rewardMint: rewardToken.mint,
              rewardDecimals: new Decimal(rewardToken.decimals.toString()),
              value: new Decimal(0),
              yearlyRewards: new Decimal(0),
              monthlyRewards: new Decimal(0),
              weeklyRewards: new Decimal(0),
              dailyRewards: new Decimal(0),
              incentivesApy: 0,
              hasRewardAvailable: false,
            };
          }

          const cachedRewardTokenPrice = pricesMap?.get(rewardToken.mint);
          const rewardTokenPrice = cachedRewardTokenPrice
            ? cachedRewardTokenPrice
            : await getPriceByTokenMintDecimal(rewardToken.mint);

          const { dailyRewards, weeklyRewards, monthlyRewards, yearlyRewards } =
            this.calculateRewardsForPeriods(
              reward,
              reward.rewardType,
              new Decimal(farmState.totalStakedAmount.toString()),
              farmState.token.decimals.toNumber(),
              rewardTokenPrice,
            );

          const rewardValue = yearlyRewards.mul(rewardTokenPrice);
          const incentivesApy = rewardValue
            .div(totalActiveStakeValue)
            .toNumber();

          if (verbose) {
            console.log(`rewardValue ${rewardValue.toString()}`);
            console.log(
              `totalActiveStakeValue ${totalActiveStakeValue.toString()}`,
            );
            console.log(`totalActiveStakeAmount ${totalActiveStakeAmount}`);
          }

          return {
            rewardMint: rewardToken.mint,
            rewardDecimals: new Decimal(rewardToken.decimals.toString()),
            value: rewardValue,
            yearlyRewards,
            monthlyRewards,
            weeklyRewards,
            dailyRewards,
            incentivesApy,
            hasRewardAvailable: reward.rewardsAvailable.gtn(0),
          };
        }),
    );
  }

  async calculateFarmIncentivesApy(
    farm: FarmAndKey,
    getPriceByTokenMintDecimal: (mint: Address) => Promise<Decimal>,
    stakedTokenPrice: Decimal,
    stakedTokenDecimals: number,
    pricesMap?: Map<Address, Decimal>,
  ): Promise<FarmIncentives> {
    const { farmState } = farm;
    const { totalActiveStakeScaled, delegateAuthority } = farmState;
    const totalActiveStakeAmount = lamportsToCollDecimal(
      delegateAuthority === DEFAULT_PUBLIC_KEY
        ? scaleDownWads(totalActiveStakeScaled)
        : totalActiveStakeScaled.toNumber(),
      stakedTokenDecimals,
    );

    const totalActiveStakeValue = totalActiveStakeAmount.mul(stakedTokenPrice);

    const formattedRewardInfos = await this.processRewardInfos(
      farmState,
      totalActiveStakeValue,
      totalActiveStakeAmount,
      getPriceByTokenMintDecimal,
      pricesMap,
    );

    // APYS
    const totalIncentivesApy = formattedRewardInfos.reduce((sum, reward) => {
      sum += reward.hasRewardAvailable ? reward.incentivesApy : 0;
      return sum;
    }, 0);

    return {
      incentivesStats: formattedRewardInfos,
      totalIncentivesApy,
    };
  }

  /**
   * Simulates the farm incentives APY after a stake or unstake operation.
   * @param farm - The farm to simulate the incentives APY for.
   * @param stakedTokenDelta - The difference between the current staked amount and the new staked amount (if positive, it's a stake, if negative, it's an unstake)
   * @param getPriceByTokenMintDecimal - A function to get the price of a token mint.
   * @param stakedTokenPrice - The price of the staked token.
   * @param stakedTokenDecimals - The decimals of the staked token.
   * @param pricesMap - A map of token mints to their prices.
   * @param verbose - Whether to log verbose information.
   * @returns The farm incentives APY after the stake or unstake operation.
   */
  async simulateFarmIncentivesApy(
    farm: FarmAndKey,
    stakedTokenDelta: Decimal,
    getPriceByTokenMintDecimal: (mint: Address) => Promise<Decimal>,
    stakedTokenPrice: Decimal,
    stakedTokenDecimals: number,
    pricesMap?: Map<Address, Decimal>,
    verbose: boolean = false,
  ): Promise<FarmIncentives> {
    const { farmState } = farm;
    const { totalActiveStakeScaled, delegateAuthority } = farmState;
    const totalActiveStakeAmount = lamportsToCollDecimal(
      delegateAuthority === DEFAULT_PUBLIC_KEY
        ? scaleDownWads(totalActiveStakeScaled)
        : totalActiveStakeScaled.toNumber(),
      stakedTokenDecimals,
    );
    const simulatedTotalActiveStakeAmount =
      totalActiveStakeAmount.plus(stakedTokenDelta);

    const simulatedTotalActiveStakeValue =
      simulatedTotalActiveStakeAmount.mul(stakedTokenPrice);

    const formattedRewardInfos = await this.processRewardInfos(
      farmState,
      simulatedTotalActiveStakeValue,
      simulatedTotalActiveStakeAmount,
      getPriceByTokenMintDecimal,
      pricesMap,
      verbose,
    );

    // APYS
    const totalIncentivesApy = formattedRewardInfos.reduce((sum, reward) => {
      sum += reward.hasRewardAvailable ? reward.incentivesApy : 0;
      return sum;
    }, 0);

    return {
      incentivesStats: formattedRewardInfos,
      totalIncentivesApy,
    };
  }

  calculateRewardsForPeriods(
    reward: RewardInfo,
    rewardType: number,
    totalStakedAmount: Decimal,
    stakedTokenDecimals: number,
    price: Decimal,
  ): {
    dailyRewards: Decimal;
    weeklyRewards: Decimal;
    monthlyRewards: Decimal;
    yearlyRewards: Decimal;
  } {
    if (reward.rewardsAvailable.eqn(0)) {
      return {
        dailyRewards: new Decimal(0),
        weeklyRewards: new Decimal(0),
        monthlyRewards: new Decimal(0),
        yearlyRewards: new Decimal(0),
      };
    }

    // Find the more recent timestamp and rps
    let rewardAmountPerUnit = this.getRewardPerTimeUnitSecond(reward);

    if (rewardType === RewardType.Constant.discriminator) {
      const stakedAmountNumber = lamportsToCollDecimal(
        totalStakedAmount,
        stakedTokenDecimals,
      );
      const jtoTokens = collToLamportsDecimal(
        stakedAmountNumber,
        stakedTokenDecimals,
      ).mul(price);
      rewardAmountPerUnit = rewardAmountPerUnit.mul(jtoTokens);
    }

    const dailyReward = rewardAmountPerUnit.mul(SECONDS_IN_A_DAY);
    const weeklyReward = rewardAmountPerUnit.mul(SECONDS_IN_A_WEEK);
    const monthlyReward = rewardAmountPerUnit.mul(SECONDS_IN_A_MONTH);
    const yearlyReward = rewardAmountPerUnit.mul(SECONDS_IN_A_YEAR);

    return {
      dailyRewards: dailyReward,
      weeklyRewards: weeklyReward,
      monthlyRewards: monthlyReward,
      yearlyRewards: yearlyReward,
    };
  }

  getRewardPerTimeUnitSecond(reward: RewardInfo) {
    const now = new Decimal(new Date().getTime()).div(1000);
    let rewardPerTimeUnitSecond = new Decimal(0);
    for (let i = 0; i < reward.rewardScheduleCurve.points.length; i++) {
      const { tsStart: tsStartThisPoint, rewardPerTimeUnit } =
        reward.rewardScheduleCurve.points[i];

      const isLastPoint = i === reward.rewardScheduleCurve.points.length - 1;
      const tsStartNextPoint = isLastPoint
        ? U64_MAX
        : reward.rewardScheduleCurve.points[i + 1].tsStart;

      const thisPeriodStart = new Decimal(tsStartThisPoint.toString());
      const thisPeriodEnd = new Decimal(tsStartNextPoint.toString());
      const rps = new Decimal(rewardPerTimeUnit.toString());

      // Rules:
      // Period is in the past:     If we are after this period, then we don't count it
      // Period is in the future:   If we are before this period, we count it fully
      // Period is in the present:  If we are during this period, we count it partially
      // Period is past locking cutoff: We dismiss it

      if (thisPeriodStart <= now && thisPeriodEnd >= now) {
        // Period is in the present:  If we are during this period, we count the reward based on it
        rewardPerTimeUnitSecond = rps;
        break;
      } else if (thisPeriodStart > now && thisPeriodEnd > now) {
        // Period is in the future: If we are before this period, we count it fully
        rewardPerTimeUnitSecond = rps;
        break;
      }
    }

    const rewardTokenDecimals = reward.token.decimals.toNumber();
    const rewardAmountPerUnitDecimals = new Decimal(10).pow(
      reward.rewardsPerSecondDecimals.toString(),
    );
    const rewardAmountPerUnitLamports = new Decimal(10).pow(
      rewardTokenDecimals.toString(),
    );

    const rpsAdjusted = new Decimal(rewardPerTimeUnitSecond.toString())
      .div(rewardAmountPerUnitDecimals)
      .div(rewardAmountPerUnitLamports);

    return rewardPerTimeUnitSecond ? rpsAdjusted : new Decimal(0);
  }
}

export async function getCurrentTimeUnit(
  farm: FarmState,
  slot: Slot,
  timestamp: UnixTimestamp,
): Promise<Decimal> {
  if (farm.timeUnit == TimeUnit.Seconds.discriminator) {
    return new Decimal(timestamp.toString());
  } else {
    return new Decimal(slot.toString());
  }
}

export async function getCurrentRps(
  farm: FarmState,
  rewardIndex: number,
  slot: Slot,
  timestamp: UnixTimestamp,
): Promise<number> {
  const currentTimeUnit = new Decimal(
    await getCurrentTimeUnit(farm, slot, timestamp),
  );
  return calculateCurrentRewardPerToken(
    farm.rewardInfos[rewardIndex],
    currentTimeUnit,
  );
}

export const calcAvgBoost = (dollarValueBoosts: [Decimal, Decimal][]) => {
  const totalBoostedDollarSumSum = dollarValueBoosts.reduce(
    (acc, [_, boost]) => acc.plus(boost),
    new Decimal(0),
  );
  const totalDollarSum = dollarValueBoosts.reduce(
    (acc, [dollar, _]) => acc.plus(dollar),
    new Decimal(0),
  );
  const avgBoost = totalBoostedDollarSumSum.div(totalDollarSum);
  return avgBoost;
};
