import { AnchorProvider, BN, Idl, Program, Provider } from "@coral-xyz/anchor";
import FARMS_IDL from "./rpc_client/farms.json";

// @ts-ignore
import { binary_to_base58 } from "base58-js";

import {
  Connection,
  GetProgramAccountsFilter,
  PublicKey,
  sendAndConfirmTransaction,
  Signer,
  Transaction,
  TransactionInstruction,
  TransactionSignature,
} from "@solana/web3.js";
import {
  calculateCurrentRewardPerToken,
  calculateNewRewardToBeIssued,
  calculatePendingRewards,
  checkIfAccountExists,
  createAssociatedTokenAccountIdempotentInstruction,
  getReadOnlyWallet,
  scopePriceForFarm,
  SIZE_FARM_STATE,
  SIZE_GLOBAL_CONFIG,
} from "./utils";
import {
  getAssociatedTokenAddress,
  getTreasuryVaultPDA,
  getUserStatePDA,
  collToLamportsDecimal,
  getFarmVaultPDA,
  getFarmAuthorityPDA,
  getRewardVaultPDA,
  lamportsToCollDecimal,
  getTreasuryAuthorityPDA,
  createKeypairRentExemptIx,
  scaleDownWads,
  createAddExtraComputeUnitsTransaction,
} from "./utils";
import { UserState, UserStateFields } from "./rpc_client/accounts";
import { UserFarm } from "./models";
import {
  FarmState,
  FarmStateFields,
  GlobalConfig,
} from "./rpc_client/accounts";
import * as farmOperations from "./utils/operations";
import Decimal from "decimal.js";
import { Keypair, VersionedTransaction } from "@solana/web3.js";
import {
  GlobalConfigOptionKind,
  FarmConfigOptionKind,
  TimeUnit,
  LockingMode,
  RewardType,
  RewardInfo,
  FarmConfigOption,
} from "./rpc_client/types/index";
import { FarmAndKey, UserAndKey } from "./models";
import { PROGRAM_ID } from "./rpc_client/programId";
import { OraclePrices } from "@hubbleprotocol/scope-sdk";
import { chunks } from "./utils/arrayUtils";
import {
  KaminoMarket,
  KaminoReserve,
  lamportsToNumberDecimal,
  ObligationTypeTag,
  Position,
  PubkeyHashMap,
  PublicKeySet,
  U64_MAX,
} from "@kamino-finance/klend-sdk";
import { ReserveFarmKind } from "@kamino-finance/klend-sdk/dist/idl_codegen/types";
import {
  createAddExtraComputeUnitFeeTransaction,
  unwrap,
} from "./commands/utils";
import { getMintDecimals } from "@project-serum/serum/lib/market";
import {
  signSendAndConfirmRawTransactionWithRetry,
  Web3Client,
} from "./utils/sendTransactionsUtils";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

export const farmsId = new PublicKey(
  "FarmsPZpWu9i7Kky8tPN37rs2TpmMrAZrC7S7vJa91Hr",
);

export interface UserPointsBreakdown {
  totalPoints: Decimal;
  currentBoost: Decimal;
  currentPointsPerDay: Decimal;
  perPositionBoost: PubkeyHashMap<PublicKey, Decimal>;
  perPositionPointsPerDay: PubkeyHashMap<PublicKey, Decimal>;
}

export interface RewardCurvePoint {
  startTs: number;
  rps: number;
}

export class Farms {
  private readonly _connection: Connection;
  private readonly _provider: Provider;
  private readonly _farmsProgram: Program;
  private readonly _farmsProgramId: PublicKey;

  constructor(connection: Connection) {
    this._connection = connection;
    this._provider = new AnchorProvider(connection, getReadOnlyWallet(), {
      commitment: connection.commitment,
    });
    this._farmsProgramId = farmsId;
    this._farmsProgram = new Program(
      FARMS_IDL as Idl,
      this._farmsProgramId,
      this._provider,
    );
  }

  getConnection() {
    return this._connection;
  }

  getProgramID() {
    return this._farmsProgramId;
  }

  getProgram() {
    return this._farmsProgram;
  }

  async getAllUserStatesForUser(user: PublicKey): Promise<Array<UserAndKey>> {
    let filters: GetProgramAccountsFilter[] = [];

    filters.push({
      memcmp: {
        bytes: user.toBase58(),
        offset: 48,
      },
    });

    filters.push({
      dataSize: UserState.layout.span + 8,
    });

    const userStates = (
      await this._farmsProgram.account.userState.all(filters)
    ).map((x) => {
      let res: UserAndKey = {
        userState: new UserState(x.account as unknown as UserStateFields),
        key: x.publicKey,
      };
      return res;
    });

    return userStates;
  }

  async getAllUserStates(): Promise<UserAndKey[]> {
    return (
      await this._farmsProgram.account.userState.all([
        {
          dataSize: UserState.layout.span + 8,
        },
      ])
    ).map((x) => {
      const userAndKey: UserAndKey = {
        userState: new UserState(x.account as unknown as UserStateFields),
        key: x.publicKey,
      };
      return userAndKey;
    });
  }

  async getAllUserStatesWithFilter(
    isFarmDelegated: boolean,
  ): Promise<UserAndKey[]> {
    return (
      await this._farmsProgram.account.userState.all([
        {
          dataSize: UserState.layout.span + 8,
        },
        {
          memcmp: { bytes: isFarmDelegated ? "2" : "1", offset: 80 },
        },
      ])
    ).map((x) => {
      const userAndKey: UserAndKey = {
        userState: new UserState(x.account as unknown as UserStateFields),
        key: x.publicKey,
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
   */
  async *batchGetAllUserStates(): AsyncGenerator<UserAndKey[], void, unknown> {
    const userStatePubkeys = await this._connection.getProgramAccounts(
      this._farmsProgramId,
      {
        filters: [
          {
            dataSize: UserState.layout.span + 8,
          },
        ],
        dataSlice: {
          offset: 0,
          length: 0,
        },
      },
    );

    for (const batch of chunks(
      userStatePubkeys.map((x) => x.pubkey),
      100,
    )) {
      const userStateAccounts =
        await this._connection.getMultipleAccountsInfo(batch);
      const userStateBatch: UserAndKey[] = [];
      for (let i = 0; i < userStateAccounts.length; i++) {
        const userState = userStateAccounts[i];
        const pubkey = batch[i];
        if (userState === null) {
          continue;
        }

        const userStateAccount = UserState.decode(userState.data);

        if (!userStateAccount) {
          throw Error(
            `Could not decode user state account ${pubkey.toString()}`,
          );
        }

        userStateBatch.push({ key: pubkey, userState: userStateAccount });
      }
      yield userStateBatch;
    }
  }

  async getAllUserStatesForFarm(farm: PublicKey): Promise<UserAndKey[]> {
    return (
      await this._farmsProgram.account.userState.all([
        {
          dataSize: UserState.layout.span + 8,
        },
        {
          memcmp: {
            offset: 8 + 8,
            bytes: farm.toBase58(),
          },
        },
      ])
    ).map((x) => {
      const userAndKey: UserAndKey = {
        userState: new UserState(x.account as unknown as UserStateFields),
        key: x.publicKey,
      };
      return userAndKey;
    });
  }

  async getFarmsForMint(mint: PublicKey): Promise<Array<FarmAndKey>> {
    let filters: GetProgramAccountsFilter[] = [];

    filters.push({
      memcmp: {
        bytes: mint.toBase58(),
        offset: 72,
      },
    });

    filters.push({
      dataSize: FarmState.layout.span + 8,
    });

    const farms = (await this._farmsProgram.account.farmState.all(filters)).map(
      (x) => {
        let res: FarmAndKey = {
          farmState: new FarmState(x.account as unknown as FarmStateFields),
          key: x.publicKey,
        };
        return res;
      },
    );

    return farms;
  }

  async getAllFarmStates(): Promise<FarmAndKey[]> {
    return (
      await this._farmsProgram.account.farmState.all([
        {
          dataSize: FarmState.layout.span + 8,
        },
      ])
    ).map((x): FarmAndKey => {
      const farmAndKey: FarmAndKey = {
        farmState: new FarmState(x.account as unknown as FarmStateFields),
        key: x.publicKey,
      };
      return farmAndKey;
    });
  }

  async getAllFarmStatesByPubkeys(keys: PublicKey[]): Promise<FarmAndKey[]> {
    const farmAndKeys: FarmAndKey[] = [];

    const farmStates = await this.fetchMultipleFarmStatesWithCheckedSize(keys);

    farmStates.forEach((farmState, index) => {
      if (farmState) {
        farmAndKeys.push({
          farmState: farmState,
          key: keys[index],
        });
      }
    });

    return farmAndKeys;
  }

  async getStakedAmountForMintForFarm(
    mint: PublicKey,
    farm: PublicKey,
  ): Promise<Decimal> {
    const farms = await this.getFarmsForMint(mint);

    for (let index = 0; index < farms.length; index++) {
      if (farms[index].key.equals(farm)) {
        return lamportsToCollDecimal(
          new Decimal(
            scaleDownWads(farms[index].farmState.totalActiveStakeScaled),
          ),
          farms[index].farmState.token.decimals.toNumber(),
        );
      }
    }
    throw Error("No Farm found");
  }

  async getStakedAmountForMint(mint: PublicKey): Promise<Decimal> {
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
    farm: PublicKey,
    user: PublicKey,
  ): Promise<{
    lockupRemainingDuration: number;
    farmLockupOriginalDuration: number;
    farmLockupExpiry: number;
  }> {
    let userStateAddress = getUserStatePDA(this._farmsProgramId, farm, user);

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
    const slot = await this._connection.getSlot();
    const timestampNow = (await this._connection.getBlockTime(slot))!;

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
    user: PublicKey,
    farm: PublicKey,
    delegatees?: PublicKey[],
  ): Promise<Array<UserAndKey>> {
    if (delegatees) {
      return this.getUserStateKeysForDelegatedFarmDeterministic(
        user,
        farm,
        delegatees,
      );
    }
    const userStates = await this.getAllUserStatesForUser(user);
    const userStateKeysForFarm: UserAndKey[] = [];

    for (let index = 0; index < userStates.length; index++) {
      if (userStates[index].userState.farmState.equals(farm)) {
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
    user: PublicKey,
    farm: PublicKey,
    delegatees: PublicKey[],
  ): Promise<Array<UserAndKey>> {
    const userStateAddresses: PublicKey[] = [];
    const userStateKeysForFarm: UserAndKey[] = [];
    delegatees.forEach((delegatee) => {
      const userStateAddress = getUserStatePDA(
        this._farmsProgramId,
        farm,
        delegatee,
      );

      userStateAddresses.push(userStateAddress);
    });

    const userStates = await UserState.fetchMultiple(
      this._connection,
      userStateAddresses,
    );

    userStates.forEach((userState, index) => {
      if (userState && userState.farmState.equals(farm)) {
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

  async getAllFarmsForUser(
    user: PublicKey,
    strategiesToInclude?: PublicKeySet<PublicKey>,
  ): Promise<PubkeyHashMap<PublicKey, UserFarm>> {
    const userStates = await this.getAllUserStatesForUser(user);

    const farmPks = new Array<PublicKey>();
    for (let i = 0; i < userStates.length; i++) {
      farmPks[i] = userStates[i].userState.farmState;
    }

    const farmStates = await this.getAllFarmStatesByPubkeys(farmPks);

    if (!farmStates) {
      throw new Error("Error fetching farms");
    }

    let farmStatesFiltered: FarmAndKey[] = [];

    if (strategiesToInclude) {
      farmStatesFiltered = farmStates.filter((farmStates) => {
        if (strategiesToInclude.contains(farmStates.farmState.strategyId)) {
          return true;
        }
        return false;
      });
    } else {
      farmStatesFiltered = farmStates;
    }

    if (farmStatesFiltered.length === 0) {
      // Return empty if no serializable farm states found
      return new PubkeyHashMap<PublicKey, UserFarm>();
    }

    const timestamp = new Decimal(
      (await this._connection.getBlockTime(await this._connection.getSlot()))!,
    );

    const userFarms = new PubkeyHashMap<PublicKey, UserFarm>();

    for (let userState of userStates) {
      const userPendingRewardAmounts: Decimal[] = [];
      let farmState = farmStatesFiltered.find((farmState) =>
        farmState.key.equals(userState.userState.farmState),
      );

      if (!farmState) {
        // Skip farms that are not serializable anymore
        continue;
      }

      let oraclePrices: OraclePrices | null = null;
      if (!farmState.farmState.scopePrices.equals(PublicKey.default)) {
        oraclePrices = await OraclePrices.fetch(
          this._connection,
          farmState.farmState.scopePrices,
        );
        if (!oraclePrices) {
          throw new Error("Error fetching oracle prices");
        }
      }

      let hasReward = false;

      // calculate userState pending rewards
      for (
        let indexReward = 0;
        indexReward < farmState.farmState.rewardInfos.length;
        indexReward++
      ) {
        userPendingRewardAmounts[indexReward] = calculatePendingRewards(
          farmState.farmState,
          userState.userState,
          indexReward,
          timestamp,
          oraclePrices,
        );
        if (userPendingRewardAmounts[indexReward].gt(0)) {
          hasReward = true;
        }
      }

      // add new userFarm state if non empty (has rewards or stake) and not already present
      if (!userFarms.has(userState.userState.farmState)) {
        const userFarm: UserFarm = {
          userStateAddress: userState.key,
          farm: userState.userState.farmState,
          strategyId: farmState.farmState.strategyId,
          delegateAuthority: farmState.farmState.delegateAuthority,
          stakedToken: farmState.farmState.token.mint,
          activeStakeByDelegatee: new PubkeyHashMap<PublicKey, Decimal>(),
          pendingDepositStakeByDelegatee: new PubkeyHashMap<
            PublicKey,
            Decimal
          >(),
          pendingWithdrawalUnstakeByDelegatee: new PubkeyHashMap<
            PublicKey,
            Decimal
          >(),
          pendingRewards: new Array(farmState.farmState.rewardInfos.length)
            .fill(undefined)
            .map(function (value, index) {
              return {
                rewardTokenMint: new PublicKey(0),
                rewardTokenProgramId:
                  farmState!.farmState.rewardInfos[index].token.tokenProgram,
                rewardType:
                  farmState?.farmState.rewardInfos[index].rewardType || 0,
                cumulatedPendingRewards: new Decimal(0),
                pendingRewardsByDelegatee: new PubkeyHashMap<
                  PublicKey,
                  Decimal
                >(),
              };
            }),
        };
        if (
          new Decimal(scaleDownWads(userState.userState.activeStakeScaled)).gt(
            0,
          ) ||
          hasReward
        ) {
          userFarms.set(userState.userState.farmState, userFarm);
        } else {
          // skip as we are not accounting for empty userFarms
          continue;
        }
      }

      // add new userFarm state if non empty (has rewards or stake) and not already present
      const refUserFarm = userFarms.get(userState.userState.farmState);

      if (!refUserFarm) {
        throw new Error("User farm state not loaded properly ");
      }

      const updatedUserFarm = { ...refUserFarm };

      if (
        updatedUserFarm.activeStakeByDelegatee.has(
          userState.userState.delegatee,
        )
      ) {
        console.error(
          "Delegatee for user for farm already present. There should be only one delegatee for this user for this farm",
        );
        continue;
      }

      // active stake by delegatee
      updatedUserFarm.activeStakeByDelegatee.set(
        userState.userState.delegatee,
        lamportsToCollDecimal(
          new Decimal(scaleDownWads(userState.userState.activeStakeScaled)),
          farmState.farmState.token.decimals.toNumber(),
        ),
      );

      // pendingDepositStake by delegatee
      updatedUserFarm.pendingDepositStakeByDelegatee.set(
        userState.userState.delegatee,
        new Decimal(
          scaleDownWads(userState.userState.pendingDepositStakeScaled),
        ),
      );

      // pendingWithdrawalUnstake by delegatee
      updatedUserFarm.pendingWithdrawalUnstakeByDelegatee.set(
        userState.userState.delegatee,
        new Decimal(
          scaleDownWads(userState.userState.pendingWithdrawalUnstakeScaled),
        ),
      );

      // cummulating rewards
      for (
        let indexReward = 0;
        indexReward < farmState.farmState.rewardInfos.length;
        indexReward++
      ) {
        updatedUserFarm.pendingRewards[indexReward].rewardTokenMint =
          farmState.farmState.rewardInfos[indexReward].token.mint;

        updatedUserFarm.pendingRewards[indexReward].cumulatedPendingRewards =
          updatedUserFarm.pendingRewards[
            indexReward
          ].cumulatedPendingRewards.add(userPendingRewardAmounts[indexReward]);

        updatedUserFarm.pendingRewards[
          indexReward
        ].pendingRewardsByDelegatee.set(
          userState.userState.delegatee,
          userPendingRewardAmounts[indexReward],
        );
      }

      // set updated userFarm
      userFarms.set(userState.userState.farmState, updatedUserFarm);
    }

    return userFarms;
  }

  async getUserStateKeyForUndelegatedFarm(
    user: PublicKey,
    farmAddress: PublicKey,
  ): Promise<UserAndKey> {
    const userStateAddress = getUserStatePDA(
      this._farmsProgramId,
      farmAddress,
      user,
    );

    const userState = await UserState.fetch(this._connection, userStateAddress);
    if (!userState) {
      throw new Error(`User state not found ${userStateAddress.toString()}`);
    }

    return {
      key: userStateAddress,
      userState: userState,
    };
  }

  async getUserForUndelegatedFarm(
    user: PublicKey,
    farmAddress: PublicKey,
  ): Promise<UserFarm> {
    const farmState = await FarmState.fetch(this._connection, farmAddress);
    if (!farmState) {
      throw new Error(`Farm not found ${farmAddress.toString()}`);
    }

    const userStateAddress = getUserStatePDA(
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
      strategyId: farmState.strategyId,
      delegateAuthority: farmState.delegateAuthority,
      stakedToken: farmState.token.mint,
      activeStakeByDelegatee: new PubkeyHashMap<PublicKey, Decimal>(),
      pendingDepositStakeByDelegatee: new PubkeyHashMap<PublicKey, Decimal>(),
      pendingWithdrawalUnstakeByDelegatee: new PubkeyHashMap<
        PublicKey,
        Decimal
      >(),
      pendingRewards: new Array(farmState.rewardInfos.length)
        .fill(undefined)
        .map(function (value, index) {
          return {
            rewardTokenMint: new PublicKey(0),
            rewardTokenProgramId:
              farmState?.rewardInfos[index].token.tokenProgram,
            rewardType: farmState?.rewardInfos[index].rewardType || 0,
            cumulatedPendingRewards: new Decimal(0),
            pendingRewardsByDelegatee: new PubkeyHashMap<PublicKey, Decimal>(),
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
    const timestamp = new Decimal(
      (await this._connection.getBlockTime(await this._connection.getSlot()))!,
    );

    let oraclePrices: OraclePrices | null = null;
    if (!farmState.scopePrices.equals(PublicKey.default)) {
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

  async executeTransaction(
    ix: TransactionInstruction[],
    signer: Keypair,
    extraSigners: Signer[] = [],
    web3Client?: Web3Client,
    priorityFeeMultiplier: number = 0,
  ): Promise<TransactionSignature> {
    const microLamport = 10 ** 6; // 1 lamport
    const computeUnits = 200_000;
    const microLamportsPrioritizationFee = microLamport / computeUnits;

    const tx = new Transaction();
    let { blockhash } = await this._connection.getLatestBlockhash();
    if (priorityFeeMultiplier) {
      const priorityFeeIxn = createAddExtraComputeUnitFeeTransaction(
        computeUnits,
        microLamportsPrioritizationFee * priorityFeeMultiplier,
      );
      tx.add(...priorityFeeIxn);
    }
    tx.recentBlockhash = blockhash;
    tx.feePayer = signer.publicKey;
    tx.add(...ix);
    let sig: TransactionSignature;
    if (web3Client) {
      sig = await signSendAndConfirmRawTransactionWithRetry({
        mainConnection: web3Client.sendConnection,
        extraConnections: web3Client.sendConnectionsExtra,
        tx: new VersionedTransaction(tx.compileMessage()),
        signers: [signer, ...extraSigners],
        commitment: "confirmed",
        sendTransactionOptions: {
          skipPreflight: true,
          preflightCommitment: "confirmed",
        },
      });
    } else {
      sig = await sendAndConfirmTransaction(
        this._connection,
        tx,
        [signer, ...extraSigners],
        { skipPreflight: true, commitment: "confirmed" },
      );
    }

    return sig;
  }

  async createNewUserIx(
    user: PublicKey,
    farm: PublicKey,
  ): Promise<TransactionInstruction> {
    const userState = getUserStatePDA(this._farmsProgramId, farm, user);

    const ix = farmOperations.initializeUser(farm, user, userState);

    return ix;
  }

  async createNewUser(
    user: Keypair,
    farm: PublicKey,
    priorityFeeMultiplier: number,
    web3Client?: Web3Client,
  ): Promise<TransactionSignature> {
    const ix = await this.createNewUserIx(user.publicKey, farm);

    let sig = await this.executeTransaction(
      [ix],
      user,
      [],
      web3Client,
      priorityFeeMultiplier,
    );
    const userState = getUserStatePDA(
      this._farmsProgramId,
      farm,
      user.publicKey,
    );
    if (process.env.DEBUG === "true") {
      console.log("Initialize User: " + userState);
      console.log("Refresh Farm txn: " + sig.toString());
    }

    return sig;
  }

  async stakeIx(
    user: PublicKey,
    farm: PublicKey,
    amountLamports: Decimal,
    stakeTokenMint: PublicKey,
    scopePrices: PublicKey,
  ): Promise<TransactionInstruction> {
    const farmVault = getFarmVaultPDA(
      this._farmsProgramId,
      farm,
      stakeTokenMint,
    );
    const userStatePk = getUserStatePDA(this._farmsProgramId, farm, user);
    const userTokenAta = await getAssociatedTokenAddress(
      user,
      stakeTokenMint,
      TOKEN_PROGRAM_ID,
    );

    const ix = farmOperations.stake(
      user,
      userStatePk,
      userTokenAta,
      farm,
      farmVault,
      stakeTokenMint,
      scopePrices,
      new BN(amountLamports.toString()),
    );
    return ix;
  }

  async stake(
    user: Keypair,
    farm: PublicKey,
    amountLamports: Decimal,
    stakeTokenMint: PublicKey,
    priorityFeeMultiplier: number,
    web3Client?: Web3Client,
  ): Promise<TransactionSignature> {
    const ix = await this.stakeIx(
      user.publicKey,
      farm,
      amountLamports,
      stakeTokenMint,
      PROGRAM_ID,
    );

    let increaseComputeIx = createAddExtraComputeUnitsTransaction(
      user.publicKey,
      400_000,
    );

    let sig = await this.executeTransaction(
      [increaseComputeIx, ix],
      user,
      [],
      web3Client,
      priorityFeeMultiplier,
    );

    if (process.env.DEBUG === "true") {
      console.log("User " + " stake " + amountLamports);
      console.log("Stake txn: " + sig.toString());
    }

    return sig;
  }

  async unstakeIx(
    user: PublicKey,
    farm: PublicKey,
    amountLamports: string,
    scopePrices: PublicKey,
  ): Promise<TransactionInstruction> {
    const userStatePk = getUserStatePDA(this._farmsProgramId, farm, user);

    const ix = farmOperations.unstake(
      user,
      userStatePk,
      farm,
      scopePrices,
      new BN(amountLamports),
    );
    return ix;
  }

  async unstake(
    user: Keypair,
    farm: PublicKey,
    sharesAmount: string,
    priorityFeeMultiplier: number,
    web3Client?: Web3Client,
  ): Promise<TransactionSignature> {
    const ix = await this.unstakeIx(
      user.publicKey,
      farm,
      sharesAmount,
      PROGRAM_ID,
    );

    let sig = await this.executeTransaction(
      [ix],
      user,
      [],
      web3Client,
      priorityFeeMultiplier,
    );

    if (process.env.DEBUG === "true") {
      console.log("Unstake " + sharesAmount);
      console.log("Unstake txn: " + sig.toString());
    }

    return sig;
  }

  async withdrawUnstakedDepositIx(
    user: PublicKey,
    userState: PublicKey,
    farmState: PublicKey,
    stakeTokenMint: PublicKey,
  ): Promise<TransactionInstruction> {
    const userTokenAta = await getAssociatedTokenAddress(
      user,
      stakeTokenMint,
      TOKEN_PROGRAM_ID,
    );
    const farmVault = getFarmVaultPDA(
      this._farmsProgramId,
      farmState,
      stakeTokenMint,
    );
    const farmVaultsAuthority = getFarmAuthorityPDA(
      this._farmsProgramId,
      farmState,
    );

    const ix = farmOperations.withdrawUnstakedDeposit(
      user,
      userState,
      farmState,
      userTokenAta,
      farmVault,
      farmVaultsAuthority,
    );

    return ix;
  }

  async withdrawUnstakedDeposit(
    user: Keypair,
    farmState: PublicKey,
    tokenMint: PublicKey,
    userState: PublicKey,
    priorityFeeMultiplier: number,
    web3Client?: Web3Client,
  ): Promise<TransactionSignature> {
    const ix = await this.withdrawUnstakedDepositIx(
      user.publicKey,
      userState,
      farmState,
      tokenMint,
    );

    let sig = await this.executeTransaction(
      [ix],
      user,
      [],
      web3Client,
      priorityFeeMultiplier,
    );
    if (process.env.DEBUG === "true") {
      console.log("User " + userState + " withdraw unstaked deposit ");
      console.log("Withdraw Unstaked Deposit txn: " + sig.toString());
    }

    return sig;
  }

  async claimForUserForFarmRewardIx(
    user: PublicKey,
    farm: PublicKey,
    rewardMint: PublicKey,
    isDelegated: boolean,
    rewardIndex = -1,
    delegatees?: PublicKey[],
  ): Promise<
    [[PublicKey, TransactionInstruction][], TransactionInstruction[]]
  > {
    const ixns: TransactionInstruction[] = [];
    const ataIxns: [PublicKey, TransactionInstruction][] = [];

    const userStatesAndKeys = isDelegated
      ? await this.getUserStateKeysForDelegatedFarm(user, farm, delegatees)
      : [await this.getUserStateKeyForUndelegatedFarm(user, farm)];
    const farmState = await FarmState.fetch(this._connection, farm);
    if (!farmState) {
      throw new Error(`Farm not found ${farm.toString()}`);
    }

    const treasuryVault = getTreasuryVaultPDA(
      this._farmsProgramId,
      farmState.globalConfig,
      rewardMint,
    );

    // find rewardIndex if not defined
    if (rewardIndex === -1) {
      rewardIndex = farmState.rewardInfos.findIndex((r) =>
        r.token.mint.equals(rewardMint),
      );
    }

    const rewardsTokenProgram =
      farmState.rewardInfos[rewardIndex].token.tokenProgram;
    const userRewardAta = await getAssociatedTokenAddress(
      user,
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
        user,
        rewardsTokenProgram,
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
        farmState.scopePrices.equals(PublicKey.default)
          ? PROGRAM_ID
          : farmState.scopePrices,
        rewardsTokenProgram,
        rewardIndex,
      );
      ixns.push(ix);
    }
    return [ataIxns, ixns];
  }

  async claimForUserForFarmReward(
    user: Keypair,
    farm: PublicKey,
    rewardMint: PublicKey,
    isDelegated: boolean,
    rewardIndex = -1,
    priorityFeeMultiplier: number,
    web3Client?: Web3Client,
  ): Promise<TransactionSignature> {
    const [_ataIxns, ixns] = await this.claimForUserForFarmRewardIx(
      user.publicKey,
      farm,
      rewardMint,
      isDelegated,
      rewardIndex,
    );

    let sig = await this.executeTransaction(
      ixns,
      user,
      [],
      web3Client,
      priorityFeeMultiplier,
    );

    if (process.env.DEBUG === "true") {
      console.log("Harvest reward " + rewardIndex);
      console.log("HarvestReward txn: " + sig.toString());
    }

    return sig;
  }

  async claimForUserForFarmAllRewardsIx(
    user: PublicKey,
    farm: PublicKey,
    isDelegated: boolean,
    delegatees?: PublicKey[],
  ): Promise<Array<TransactionInstruction>> {
    const farmState = await FarmState.fetch(this._connection, farm);
    const userStatesAndKeys = isDelegated
      ? await this.getUserStateKeysForDelegatedFarm(user, farm, delegatees)
      : [await this.getUserStateKeyForUndelegatedFarm(user, farm)];
    const ixs = new Array<TransactionInstruction>();
    // hardcoded as a hotfix for JTO release;
    // TODO: replace by proper fix
    const jitoFarm = new PublicKey(
      "Cik985zLyHYdv5Hs73BUWUcMHMhgfBNwbcCYyvBjV2tt",
    );

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
          !jitoFarm.equals(farm) &&
          farmState.rewardInfos[rewardIndex].rewardType ==
            RewardType.Constant.discriminator
        ) {
          continue;
        }
        const rewardMint = farmState.rewardInfos[rewardIndex].token.mint;
        const rewardTokenProgram =
          farmState.rewardInfos[rewardIndex].token.tokenProgram;

        const userRewardAta = await getAssociatedTokenAddress(
          user,
          rewardMint,
          rewardTokenProgram,
        );
        const treasuryVault = getTreasuryVaultPDA(
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
              user,
              rewardTokenProgram,
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
            farmState.scopePrices.equals(PublicKey.default)
              ? PROGRAM_ID
              : farmState.scopePrices,
            rewardTokenProgram,
            rewardIndex,
          ),
        );
      }
    }

    return ixs;
  }

  async claimForUserForFarmAllRewards(
    user: Keypair,
    farm: PublicKey,
    isDelegated: boolean,
    priorityFeeMultiplier: number,
    web3Client?: Web3Client,
  ): Promise<Array<TransactionSignature>> {
    const ixs = await this.claimForUserForFarmAllRewardsIx(
      user.publicKey,
      farm,
      isDelegated,
    );
    const sigs = new Array<TransactionSignature>();

    for (let i = 0; i < ixs.length; i++) {
      sigs[i] = await this.executeTransaction(
        [ixs[i]],
        user,
        [],
        web3Client,
        priorityFeeMultiplier,
      );
    }

    return sigs;
  }

  async transferOwnershipIx(
    user: PublicKey,
    userState: PublicKey,
    newUser: PublicKey,
  ): Promise<TransactionInstruction> {
    const ix = farmOperations.transferOwnership(user, userState, newUser);

    return ix;
  }

  async transferOwnership(
    user: Keypair,
    userState: PublicKey,
    newUser: PublicKey,
    priorityFeeMultiplier: number,
    web3Client?: Web3Client,
  ): Promise<TransactionSignature> {
    const ix = await this.transferOwnershipIx(
      user.publicKey,
      userState,
      newUser,
    );

    let sig = await this.executeTransaction(
      [ix],
      user,
      [],
      web3Client,
      priorityFeeMultiplier,
    );

    if (process.env.DEBUG === "true") {
      console.log(
        "Transfer User " +
          userState +
          " ownership from " +
          user.publicKey +
          " to " +
          newUser,
      );
      console.log("Transfer User Ownership txn: " + sig.toString());
    }

    return sig;
  }

  async transferOwnershipAllUserStatesIx(
    user: PublicKey,
    newUser: PublicKey,
  ): Promise<Array<TransactionInstruction>> {
    const userStates = await this.getAllUserStatesForUser(user);

    const ixs = new Array<TransactionInstruction>();
    for (let index = 0; index < userStates.length; index++) {
      ixs[index] = farmOperations.transferOwnership(
        user,
        userStates[index].key,
        newUser,
      );
    }

    return ixs;
  }

  async transferOwnershipAllUserStates(
    user: Keypair,
    newUser: PublicKey,
    priorityFeeMultiplier: number,
    web3Client?: Web3Client,
  ): Promise<Array<TransactionSignature>> {
    const ixs = await this.transferOwnershipAllUserStatesIx(
      user.publicKey,
      newUser,
    );

    const sigs = new Array<TransactionSignature>();
    for (let i = 0; i < ixs.length; i++) {
      sigs[i] = await this.executeTransaction(
        [ixs[i]],
        user,
        [],
        web3Client,
        priorityFeeMultiplier,
      );
    }

    return sigs;
  }

  async createFarmIx(
    admin: PublicKey,
    farm: Keypair,
    globalConfig: PublicKey,
    stakeTokenMint: PublicKey,
  ): Promise<TransactionInstruction[]> {
    const farmVault = getFarmVaultPDA(
      this._farmsProgramId,
      farm.publicKey,
      stakeTokenMint,
    );
    const farmVaultAuthority = getFarmAuthorityPDA(
      this._farmsProgramId,
      farm.publicKey,
    );

    let ixs: TransactionInstruction[] = [];
    ixs.push(
      await createKeypairRentExemptIx(
        this._provider.connection,
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
        farm.publicKey,
        farmVault,
        farmVaultAuthority,
        stakeTokenMint,
      ),
    );
    return ixs;
  }

  async createFarm(
    admin: Keypair,
    globalConfig: PublicKey,
    farm: Keypair,
    mint: PublicKey,
    mode: string = "execute",
    priorityFeeMultiplier: number,
    web3Client?: Web3Client,
  ): Promise<TransactionSignature> {
    const ix = await this.createFarmIx(
      mode === "multisig"
        ? new PublicKey(process.env.MULTISIG!)
        : admin.publicKey,
      farm,
      globalConfig,
      mint,
    );

    const log = "Initialize Farm: " + farm.toString();

    return this.processTxn(
      admin,
      ix,
      mode,
      priorityFeeMultiplier,
      log,
      [farm],
      web3Client,
    );
  }

  async addRewardToFarmIx(
    admin: PublicKey,
    globalConfig: PublicKey,
    farm: PublicKey,
    mint: PublicKey,
    tokenProgram: PublicKey,
  ): Promise<TransactionInstruction> {
    const globalConfigState = await GlobalConfig.fetch(
      this._connection,
      globalConfig,
    );
    if (!globalConfigState) {
      throw new Error("Could not fetch global config");
    }
    const treasuryVault = getTreasuryVaultPDA(
      this._farmsProgramId,
      globalConfig,
      mint,
    );
    let farmVaultAuthority = getFarmAuthorityPDA(this._farmsProgramId, farm);

    const rewardVault = getRewardVaultPDA(this._farmsProgramId, farm, mint);

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

  async addRewardToFarm(
    admin: Keypair,
    globalConfig: PublicKey,
    farm: PublicKey,
    mint: PublicKey,
    tokenProgram: PublicKey,
    mode: string = "execute",
    priorityFeeMultiplier: number,
    web3Client?: Web3Client,
  ): Promise<TransactionSignature> {
    const ix = await this.addRewardToFarmIx(
      mode === "multisig"
        ? new PublicKey(process.env.MULTISIG!)
        : admin.publicKey,
      globalConfig,
      farm,
      mint,
      tokenProgram,
    );

    const log = "Initialize Reward: " + mint;

    return this.processTxn(
      admin,
      [ix],
      mode,
      priorityFeeMultiplier,
      log,
      [],
      web3Client,
    );
  }

  async addRewardAmountToFarmIx(
    payer: PublicKey,
    farm: PublicKey,
    mint: PublicKey,
    amount: Decimal,
    rewardIndexOverride: number = -1,
    decimalsOverride: number = -1,
    tokenProgramOverride: PublicKey = TOKEN_PROGRAM_ID,
    scopePricesOverride: PublicKey = PROGRAM_ID,
  ): Promise<TransactionInstruction> {
    let decimals = decimalsOverride;

    let rewardIndex = rewardIndexOverride;
    let scopePrices = scopePricesOverride;
    let tokenProgram = tokenProgramOverride;
    if (rewardIndex == -1) {
      const farmState = await FarmState.fetch(this._connection, farm);
      if (!farmState) {
        throw new Error(`Could not fetch farm state ${farm.toBase58()}`);
      }
      scopePrices = farmState.scopePrices.equals(PublicKey.default)
        ? PROGRAM_ID
        : farmState.scopePrices;

      for (let i = 0; farmState.rewardInfos.length; i++) {
        if (farmState.rewardInfos[i].token.mint.equals(mint)) {
          if (
            !farmState.rewardInfos[i].token.tokenProgram.equals(
              PublicKey.default,
            )
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
      throw new Error(`Could not find reward token ${mint.toBase58()}`);
    }

    let amountLamports = new BN(
      collToLamportsDecimal(amount, decimals).floor().toString(),
    );

    const payerRewardAta = await getAssociatedTokenAddress(
      payer,
      mint,
      tokenProgram,
    );
    let rewardVault = getRewardVaultPDA(this._farmsProgramId, farm, mint);
    let farmVaultsAuthority = getFarmAuthorityPDA(this._farmsProgramId, farm);

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
    payer: PublicKey,
    farm: PublicKey,
    mint: PublicKey,
    amount: Decimal,
    rewardIndexOverride: number = -1,
    decimalsOverride: number = -1,
    tokenProgramOverride: PublicKey = TOKEN_PROGRAM_ID,
    scopePricesOverride: PublicKey = PROGRAM_ID,
  ): Promise<TransactionInstruction> {
    let decimals = decimalsOverride;
    let tokenProgram = tokenProgramOverride;

    let rewardIndex = rewardIndexOverride;
    let scopePrices = scopePricesOverride;
    if (rewardIndex == -1) {
      const farmState = await FarmState.fetch(this._connection, farm);
      if (!farmState) {
        throw new Error(`Could not fetch farm state ${farm.toBase58()}`);
      }
      scopePrices = farmState.scopePrices.equals(PublicKey.default)
        ? PROGRAM_ID
        : farmState.scopePrices;

      for (let i = 0; farmState.rewardInfos.length; i++) {
        if (farmState.rewardInfos[i].token.mint.equals(mint)) {
          rewardIndex = i;
          decimals = farmState.rewardInfos[i].token.decimals.toNumber();
          tokenProgram = farmState.rewardInfos[i].token.tokenProgram;
          break;
        }
      }
    }

    if (decimals == -1) {
      throw new Error(`Could not find reward token ${mint.toBase58()}`);
    }

    let amountLamports = new BN(
      collToLamportsDecimal(amount, decimals).floor().toString(),
    );

    const payerRewardAta = await getAssociatedTokenAddress(
      payer,
      mint,
      tokenProgram,
    );
    let rewardVault = getRewardVaultPDA(this._farmsProgramId, farm, mint);
    let farmVaultsAuthority = getFarmAuthorityPDA(this._farmsProgramId, farm);

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
    return ix;
  }

  async addRewardAmountToFarm(
    payer: Keypair,
    farm: PublicKey,
    mint: PublicKey,
    amount: Decimal,
    mode: string,
    priorityFeeMultiplier: number,
    web3Client?: Web3Client,
  ): Promise<TransactionSignature> {
    const ix = await this.addRewardAmountToFarmIx(
      mode === "multisig"
        ? new PublicKey(process.env.MULTISIG!)
        : payer.publicKey,
      farm,
      mint,
      amount,
    );

    const log = "Add Reward: " + mint + " amount: " + amount;

    return this.processTxn(
      payer,
      [ix],
      mode,
      priorityFeeMultiplier,
      log,
      [],
      web3Client,
    );
  }

  async updateFarmConfigIx(
    admin: PublicKey,
    farm: PublicKey,
    mint: PublicKey,
    mode: FarmConfigOptionKind,
    value: number | PublicKey | number[] | RewardCurvePoint[] | BN,
    rewardIndexOverride: number = -1,
    scopePricesOverride: PublicKey = PROGRAM_ID,
    newFarm: boolean = false,
  ): Promise<TransactionInstruction> {
    let rewardIndex = rewardIndexOverride;
    let scopePrices = scopePricesOverride;
    if (rewardIndex == -1 && !newFarm) {
      const farmState = await FarmState.fetch(this._connection, farm);
      if (!farmState) {
        throw new Error(`Could not fetch farm state ${farm.toBase58()}`);
      }

      if (!farmState.scopePrices.equals(PublicKey.default)) {
        scopePrices = farmState.scopePrices;
      }

      for (let i = 0; farmState.rewardInfos.length; i++) {
        if (farmState.rewardInfos[i].token.mint.equals(mint)) {
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

  async updateFarmConfig(
    admin: Keypair,
    farm: PublicKey,
    mint: PublicKey,
    updateMode: FarmConfigOptionKind,
    value: number | PublicKey,
    mode: string = "execute",
    priorityFeeMultiplier: number,
    web3Client?: Web3Client,
  ): Promise<TransactionSignature> {
    const ix = await this.updateFarmConfigIx(
      mode === "multisig"
        ? new PublicKey(process.env.MULTISIG!)
        : admin.publicKey,
      farm,
      mint,
      updateMode,
      value,
    );

    const log =
      "Update Reward: " +
      mint +
      " mode: " +
      updateMode.discriminator +
      " value: " +
      value;

    return this.processTxn(
      admin,
      [ix],
      mode,
      priorityFeeMultiplier,
      log,
      [],
      web3Client,
    );
  }

  async refreshFarmIx(
    farm: PublicKey,
    scopePrices: PublicKey,
  ): Promise<TransactionInstruction> {
    const ix = farmOperations.refreshFarm(farm, scopePrices);

    return ix;
  }

  async refreshFarm(
    payer: Keypair,
    farm: PublicKey,
    priorityFeeMultiplier: number,
    web3Client?: Web3Client,
  ): Promise<TransactionSignature> {
    const farmState = await FarmState.fetch(this._connection, farm);
    if (!farmState) {
      throw new Error(`Could not fetch farm state ${farm.toBase58()}`);
    }

    const ix = await this.refreshFarmIx(
      farm,
      farmState.scopePrices.equals(PublicKey.default)
        ? PROGRAM_ID
        : farmState.scopePrices,
    );

    let sig = await this.executeTransaction(
      [ix],
      payer,
      [],
      web3Client,
      priorityFeeMultiplier,
    );

    if (process.env.DEBUG === "true") {
      console.log("Refresh Farm: " + farm);
      console.log("Refresh Farm txn: " + sig.toString());
    }

    return sig;
  }

  async refreshUserIx(
    userState: PublicKey,
    farmState: PublicKey,
    scopePrices: PublicKey,
  ): Promise<TransactionInstruction> {
    const ix = farmOperations.refreshUserState(
      userState,
      farmState,
      scopePrices,
    );

    return ix;
  }

  async refreshUser(
    payer: Keypair,
    userState: PublicKey,
    farmState: PublicKey,
    scopePrices: PublicKey,
    priorityFeeMultiplier: number,
    web3Client?: Web3Client,
  ): Promise<TransactionSignature> {
    const ix = await this.refreshUserIx(userState, farmState, scopePrices);

    let sig = await this.executeTransaction(
      [ix],
      payer,
      [],
      web3Client,
      priorityFeeMultiplier,
    );

    if (process.env.DEBUG === "true") {
      console.log("Refresh User: " + userState);
      console.log("Refresh User txn: " + sig.toString());
    }

    return sig;
  }

  async createGlobalConfigIxs(
    admin: PublicKey,
    globalConfig: Keypair,
  ): Promise<TransactionInstruction[]> {
    let ixs: TransactionInstruction[] = [];

    ixs.push(
      await createKeypairRentExemptIx(
        this._provider.connection,
        admin,
        globalConfig,
        SIZE_GLOBAL_CONFIG,
        this._farmsProgramId,
      ),
    );

    const treasuryVaultAuthority = getTreasuryAuthorityPDA(
      this._farmsProgramId,
      globalConfig.publicKey,
    );

    ixs.push(
      farmOperations.initializeGlobalConfig(
        admin,
        globalConfig.publicKey,
        treasuryVaultAuthority,
      ),
    );

    return ixs;
  }

  async createGlobalConfig(
    admin: Keypair,
    globalConfig: Keypair,
    priorityFeeMultiplier: number,
    web3Client?: Web3Client,
  ): Promise<TransactionSignature> {
    const ix = await this.createGlobalConfigIxs(admin.publicKey, globalConfig);
    const sig = await this.executeTransaction(
      ix,
      admin,
      [globalConfig],
      web3Client,
      priorityFeeMultiplier,
    );

    if (process.env.DEBUG === "true") {
      console.log("Initialize Global Config: " + globalConfig.toString());
      console.log("Initialize Global Config txn: " + sig.toString());
    }

    return sig;
  }

  async updateGlobalConfigIx(
    admin: PublicKey,
    globalConfig: PublicKey,
    mode: GlobalConfigOptionKind,
    flagValue: string,
    flagValueType: string,
  ): Promise<TransactionInstruction> {
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
    admin: PublicKey,
    globalConfig: PublicKey,
  ): Promise<TransactionInstruction> {
    const ix = farmOperations.updateGlobalConfigAdmin(admin, globalConfig);

    return ix;
  }

  async updateFarmAdminIx(
    admin: PublicKey,
    farm: PublicKey,
  ): Promise<TransactionInstruction> {
    const ix = farmOperations.updateFarmAdmin(admin, farm);

    return ix;
  }

  async updateGlobalConfig(
    admin: Keypair,
    globalConfig: PublicKey,
    updateMode: GlobalConfigOptionKind,
    flagValue: string,
    flagValueType: string,
    mode: string,
    priorityFeeMultiplier: number,
    web3Client?: Web3Client,
  ): Promise<TransactionSignature> {
    const ix = await this.updateGlobalConfigIx(
      mode === "multisig"
        ? new PublicKey(process.env.MULTISIG!)
        : admin.publicKey,
      globalConfig,
      updateMode,
      flagValue,
      flagValueType,
    );

    const log =
      "Update Global Config: " +
      globalConfig.toString() +
      " mode: " +
      updateMode.discriminator +
      " value: " +
      flagValue;

    return this.processTxn(
      admin,
      [ix],
      mode,
      priorityFeeMultiplier,
      log,
      [],
      web3Client,
    );
  }

  async updateGlobalConfigAdmin(
    admin: Keypair,
    globalConfig: PublicKey,
    mode: string,
    priorityFeeMultiplier: number,
    web3Client?: Web3Client,
  ): Promise<TransactionSignature> {
    const ix = await this.updateGlobalConfigAdminIx(
      mode === "multisig"
        ? new PublicKey(process.env.MULTISIG!)
        : admin.publicKey,
      globalConfig,
    );

    const log =
      "Update Global Config Admin for: " +
      globalConfig.toString() +
      " to admin: " +
      admin.publicKey;

    return this.processTxn(
      admin,
      [ix],
      mode,
      priorityFeeMultiplier,
      log,
      [],
      web3Client,
    );
  }

  async updateFarmAdmin(
    admin: Keypair,
    farm: PublicKey,
    mode: string,
    priorityFeeMultiplier: number,
    web3Client?: Web3Client,
  ): Promise<TransactionSignature> {
    const ix = await this.updateFarmAdminIx(
      mode === "multisig"
        ? new PublicKey(process.env.MULTISIG!)
        : admin.publicKey,
      farm,
    );

    const log =
      "Update Farm Admin for: " +
      farm.toString() +
      " to admin: " +
      admin.publicKey;

    return this.processTxn(
      admin,
      [ix],
      mode,
      priorityFeeMultiplier,
      log,
      [],
      web3Client,
    );
  }

  async withdrawTreasuryIx(
    admin: PublicKey,
    globalConfig: PublicKey,
    rewardMint: PublicKey,
    rewardTokenProgram: PublicKey,
    amount: BN,
    withdrawAta?: PublicKey,
  ): Promise<TransactionInstruction> {
    const treasuryVault = getTreasuryVaultPDA(
      this._farmsProgramId,
      globalConfig,
      rewardMint,
    );
    const treasuryVaultAuthority = getTreasuryAuthorityPDA(
      this._farmsProgramId,
      globalConfig,
    );
    if (!withdrawAta) {
      withdrawAta = await getAssociatedTokenAddress(
        admin,
        rewardMint,
        rewardTokenProgram,
      );
    }

    const ix = farmOperations.withdrawTreasury(
      admin,
      globalConfig,
      treasuryVault,
      treasuryVaultAuthority,
      withdrawAta,
      amount,
      rewardMint,
    );

    return ix;
  }

  async withdrawTreasury(
    admin: Keypair,
    globalConfig: PublicKey,
    rewardMint: PublicKey,
    rewardTokenProgram: PublicKey,
    amount: BN,
    priorityFeeMultiplier: number,
    withdrawAta?: PublicKey,
    web3Client?: Web3Client,
  ): Promise<TransactionSignature> {
    const ix = await this.withdrawTreasuryIx(
      admin.publicKey,
      globalConfig,
      rewardMint,
      rewardTokenProgram,
      amount,
      withdrawAta,
    );

    const sig = await this.executeTransaction(
      [ix],
      admin,
      [],
      web3Client,
      priorityFeeMultiplier,
    );

    if (process.env.DEBUG === "true") {
      console.log(
        "Admin " +
          admin.publicKey +
          " withdraw treasury of " +
          rewardMint +
          " an amount of " +
          amount,
      );
      console.log("Withdraw treasury txn: " + sig.toString());
    }

    return sig;
  }

  async getAllPointsData(
    scopePricesPubkey: PublicKey,
    klendProgramId: PublicKey,
    kaminoMarketPubkey: PublicKey,
    pointsMint: PublicKey,
  ): Promise<PubkeyHashMap<PublicKey, UserPointsBreakdown>> {
    const c = this._connection;
    const market = kaminoMarketPubkey;
    const ts = new Decimal(new Date().getTime() / 1000);

    // Fetch all the data
    const scopePrices = unwrap(await OraclePrices.fetch(c, scopePricesPubkey));
    const kaminoMarket: KaminoMarket = unwrap(
      await KaminoMarket.load(c, market, 450, klendProgramId),
    );

    const reservesWithFarms: KaminoReserve[] = [];
    kaminoMarket.reserves.forEach((reserve, _key) => {
      if (
        !reserve.state.farmCollateral.equals(PublicKey.default) ||
        !reserve.state.farmDebt.equals(PublicKey.default)
      ) {
        reservesWithFarms.push(reserve);
      }
    });

    // Final return value
    const userToPointsBreakdown: PubkeyHashMap<PublicKey, UserPointsBreakdown> =
      new PubkeyHashMap();

    const pointsDecimal = await getMintDecimals(c, pointsMint);
    const pointsFactor = 10 ** pointsDecimal;

    const farmPubkeyToFarmStates: PubkeyHashMap<PublicKey, FarmState> =
      new PubkeyHashMap();
    const pointsFarmToReserve: PubkeyHashMap<PublicKey, PublicKey> =
      new PubkeyHashMap();
    const userDollarValueBoosts = new PubkeyHashMap<
      PublicKey,
      [Decimal, Decimal][]
    >();
    const userPerPositionDollarValueBoosts = new PubkeyHashMap<
      PublicKey,
      PubkeyHashMap<PublicKey, [Decimal, Decimal][]>
    >();
    const userBoost = new PubkeyHashMap<PublicKey, Decimal>();

    // Fetch all the farms data
    for (const reserve of reservesWithFarms) {
      const collFarm = reserve.state.farmCollateral;
      const debtFarm = reserve.state.farmDebt;

      if (!collFarm.equals(PublicKey.default)) {
        const collFarmState = await FarmState.fetch(c, collFarm);
        if (collFarmState) {
          const rewardInfo = collFarmState.rewardInfos.find((r) =>
            r.token.mint.equals(pointsMint),
          );
          if (rewardInfo) {
            console.log("Setting coll farm mapping", collFarm.toBase58());
            farmPubkeyToFarmStates.set(collFarm, collFarmState);
            pointsFarmToReserve.set(collFarm, reserve.address);
          }
        }
      }

      if (!debtFarm.equals(PublicKey.default)) {
        const debtFarmState = await FarmState.fetch(c, debtFarm);
        if (debtFarmState) {
          const rewardInfo = debtFarmState.rewardInfos.find((r) =>
            r.token.mint.equals(pointsMint),
          );
          if (rewardInfo) {
            console.log("Setting debt farm mapping", debtFarm.toBase58());
            farmPubkeyToFarmStates.set(debtFarm, debtFarmState);
            pointsFarmToReserve.set(debtFarm, reserve.address);
          }
        }
      }
    }

    const {
      perAssetCollBoosts,
      perAssetDebtBoosts,
      perAssetProductBoosts,
      perProductBoosts,
    } = getAllBoosts(kaminoMarket);

    /// Globally total points for entire market
    {
      let totalPointsEarned = 0;
      let totalPointsPending = 0;
      for (const [_farmPubkey, farmState] of farmPubkeyToFarmStates.entries()) {
        const rewardIndex = farmState.rewardInfos.findIndex((r: RewardInfo) =>
          r.token.mint.equals(pointsMint),
        );

        const rewardInfo: RewardInfo = farmState.rewardInfos[rewardIndex];
        let scopePrice: Decimal | null = scopePriceForFarm(
          farmState,
          scopePrices,
        );

        // TODO: simulate time passing, pending rewards
        const pointsEarned = rewardInfo.rewardsIssuedUnclaimed.toNumber();
        totalPointsEarned += pointsEarned / pointsFactor;

        // To simulate points pending for total farm, we simulate a user that
        // is staking the entire farm
        const pointsPending = calculateNewRewardToBeIssued(
          farmState,
          ts,
          rewardIndex,
          scopePrice,
        );
        totalPointsPending += pointsPending.toNumber() / pointsFactor;
      }
      console.log("Total Points Earned", totalPointsEarned);
      console.log("Total Points Pending", totalPointsPending);
    }

    /// Total points per user
    const userToFarmStates: PubkeyHashMap<
      PublicKey,
      PubkeyHashMap<PublicKey, [UserState, FarmState, Decimal]>
    > = new PubkeyHashMap();
    const userFarmStatesToFarmStates: PubkeyHashMap<PublicKey, UserState> =
      new PubkeyHashMap();

    for (const [farmPubkey, farmState] of farmPubkeyToFarmStates.entries()) {
      const usersForFarms = await this.getAllUserStatesForFarm(farmPubkey);
      const rewardIndex = farmState.rewardInfos.findIndex((r: RewardInfo) =>
        r.token.mint.equals(pointsMint),
      );

      for (const userAndKey of usersForFarms) {
        const { userState, key: userFarmStateKey } = userAndKey;

        const totalPointsForUserForFarm = calculatePendingRewards(
          farmState,
          userState,
          rewardIndex,
          ts,
          scopePrices,
        ).div(pointsFactor);

        if (!userToFarmStates.has(userState.owner)) {
          userToFarmStates.set(userState.owner, new PubkeyHashMap());
        }
        userToFarmStates
          .get(userState.owner)
          ?.set(farmPubkey, [userState, farmState, totalPointsForUserForFarm]);

        userFarmStatesToFarmStates.set(userFarmStateKey, userState);
      }
    }

    // Total per user
    for (const [user, pointsEarnedPerFarm] of userToFarmStates.entries()) {
      userBoost.set(user, new Decimal(0));
      userDollarValueBoosts.set(user, []);
      userPerPositionDollarValueBoosts.set(user, new PubkeyHashMap());

      let totalPointsEarned = 0;
      if (!userToPointsBreakdown.has(user)) {
        userToPointsBreakdown.set(user, newUserPointsBreakdown());
      }
      let currentUserEntry = userToPointsBreakdown.get(user)!;

      for (const [_farm, pointsEntry] of pointsEarnedPerFarm.entries()) {
        const [_userState, _farmState, pointsThisProduct] = pointsEntry;
        totalPointsEarned += pointsThisProduct.toNumber();
      }

      currentUserEntry.totalPoints =
        currentUserEntry.totalPoints.plus(totalPointsEarned);
    }

    // Breakdown per user
    for (const [user, _] of userBoost.entries()) {
      const userObligations = await kaminoMarket.getAllUserObligations(user);
      const userDollarBoosts = userDollarValueBoosts.get(user)!;
      const thisObligationPerDollarBoost: [Decimal, Decimal][] = [];
      let thisUserPointsPerDay = 0;
      for (const obligation of userObligations) {
        let thisUserPointsPerDayPerObligation = 0;
        const tag = obligation.state.tag.toNumber();

        for (const [_key, depositPosition] of obligation.deposits) {
          const mint = depositPosition.mintAddress;
          const sideBoost = perAssetCollBoosts.get(mint)!;
          const productBoost = perProductBoosts.get(tag)!;
          const assetProductBoost = perAssetProductBoosts.get(mint)!.get(tag)!;

          const finalBoost = sideBoost.mul(productBoost).mul(assetProductBoost);

          // Calculate boost avg
          const dollarValue = depositPosition.marketValueRefreshed;
          userDollarBoosts.push([dollarValue, dollarValue.mul(finalBoost)]);
          thisObligationPerDollarBoost.push([
            dollarValue,
            dollarValue.mul(finalBoost),
          ]);

          // Calculate points per day
          const pointsPerDay = calculatePointsPerDay(
            kaminoMarket,
            user,
            mint,
            farmPubkeyToFarmStates,
            pointsMint,
            pointsFactor,
            depositPosition,
            true,
            finalBoost,
            scopePrices,
          );

          console.log("pointsPerDay", pointsPerDay.toFixed());
          thisUserPointsPerDay += pointsPerDay.toNumber();
          thisUserPointsPerDayPerObligation += pointsPerDay.toNumber();
        }

        for (const [_key, borrowPosition] of obligation.borrows) {
          const mint = borrowPosition.mintAddress;
          const sideBoost = perAssetDebtBoosts.get(mint)!;
          const productBoost = perProductBoosts.get(tag)!;
          const assetProductBoost = perAssetProductBoosts.get(mint)!.get(tag)!;

          const dollarValue = borrowPosition.marketValueRefreshed;
          const finalBoost = sideBoost.mul(productBoost).mul(assetProductBoost);
          userDollarBoosts.push([dollarValue, dollarValue.mul(finalBoost)]);
          thisObligationPerDollarBoost.push([
            dollarValue,
            dollarValue.mul(finalBoost),
          ]);

          // Calculate points per day
          const pointsPerDay = calculatePointsPerDay(
            kaminoMarket,
            user,
            mint,
            farmPubkeyToFarmStates,
            pointsMint,
            pointsFactor,
            borrowPosition,
            false,
            finalBoost,
            scopePrices,
          );

          thisUserPointsPerDay += pointsPerDay.toNumber();
          thisUserPointsPerDayPerObligation += pointsPerDay.toNumber();
        }

        userPerPositionDollarValueBoosts
          .get(user)!
          .set(obligation.obligationAddress, thisObligationPerDollarBoost);

        userToPointsBreakdown
          .get(user)!
          .perPositionPointsPerDay.set(
            obligation.obligationAddress,
            new Decimal(thisUserPointsPerDayPerObligation),
          );
      }

      userToPointsBreakdown.get(user)!.currentPointsPerDay = new Decimal(
        thisUserPointsPerDay,
      );
    }

    for (const [user, _] of userBoost.entries()) {
      const avgBoostPerUser = calcAvgBoost(userDollarValueBoosts.get(user)!);
      userToPointsBreakdown.get(user)!.currentBoost = avgBoostPerUser;
      for (const [
        obligation,
        dollarDeposits,
      ] of userPerPositionDollarValueBoosts.get(user)?.entries()!) {
        userToPointsBreakdown
          .get(user)!
          .perPositionBoost.set(obligation, calcAvgBoost(dollarDeposits));
      }
    }

    return userToPointsBreakdown;
  }

  async updateFarmRpsForRewardIx(
    payer: PublicKey,
    rewardMint: PublicKey,
    farm: PublicKey,
    rewardsPerSecond: number,
  ): Promise<TransactionInstruction> {
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
      return info.token.mint.equals(rewardMint);
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
    payer: PublicKey,
    rewardMint: PublicKey,
    farm: PublicKey,
    amountToTopUp: Decimal,
  ): Promise<TransactionInstruction> {
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
      return info.token.mint.equals(rewardMint);
    });

    if (!rewardInfo) {
      throw new Error("Reward not found in farm");
    }

    return await this.addRewardAmountToFarmIx(
      payer,
      farm,
      rewardMint,
      amountToTopUp,
    );
  }

  async processTxn(
    admin: Keypair,
    ixns: TransactionInstruction[],
    mode: string,
    priorityFeeMultiplier: number,
    debugMessage?: string,
    extraSigners?: Signer[],
    web3Client?: Web3Client,
  ): Promise<TransactionSignature> {
    if (mode === "multisig" || mode === "simulate") {
      const { blockhash } = await this._connection.getLatestBlockhash();
      let txn = new Transaction();
      txn.add(...ixns);
      txn.recentBlockhash = blockhash;
      txn.feePayer = admin.publicKey;

      // if simulate is true, always simulate
      if (mode === "simulate") {
        await printSimulateTx(this._connection, txn);
      } else {
        // if simulate is false (multisig is true)
        await printMultisigTx(txn);
      }

      return "";
    } else if (mode === "execute") {
      let sig = await this.executeTransaction(
        ixns,
        admin,
        extraSigners,
        web3Client,
        priorityFeeMultiplier,
      );

      if (process.env.DEBUG === "true" && debugMessage) {
        console.log(debugMessage);
        console.log("txn: " + sig.toString());
      }

      return sig;
    }
    return "";
  }

  async fetchMultipleFarmStatesWithCheckedSize(keys: PublicKey[]) {
    // Custom deserialization to avoid fetching non-serializable accounts
    const farmStateSize = FarmState.layout.span + 8;
    const infos = await this._connection.getMultipleAccountsInfo(keys);
    return infos.map((info) => {
      if (info === null) {
        return null;
      }
      if (info.data.length !== farmStateSize) {
        // check if account matches expected size (deserializable)
        return null;
      }
      if (!info.owner.equals(this._farmsProgramId)) {
        throw new Error("account doesn't belong to this program");
      }

      return FarmState.decode(info.data);
    });
  }
}

export async function getCurrentTimeUnit(
  conn: Connection,
  farm: FarmState,
): Promise<Decimal> {
  const slot = await conn.getSlot();
  const timestamp = await conn.getBlockTime(slot);

  if (farm.timeUnit == TimeUnit.Seconds.discriminator) {
    return new Decimal(timestamp!);
  } else {
    return new Decimal(slot);
  }
}

export async function getCurrentRps(
  conn: Connection,
  farm: FarmState,
  rewardIndex: number,
): Promise<number> {
  const currentTimeUnit = new Decimal(await getCurrentTimeUnit(conn, farm));
  return calculateCurrentRewardPerToken(
    farm.rewardInfos[rewardIndex],
    currentTimeUnit,
  );
}

export async function printMultisigTx(tx: Transaction) {
  console.log(binary_to_base58(tx.serializeMessage()));
}

export async function printSimulateTx(conn: Connection, tx: Transaction) {
  console.log(
    "Tx in B64",
    `https://explorer.solana.com/tx/inspector?message=${encodeURIComponent(
      tx.serializeMessage().toString("base64"),
    )}`,
  );

  let res = await conn.simulateTransaction(tx);
  console.log("Simulate Response", res);
  console.log("");
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

export const calculatePointsPerDay = (
  kaminoMarket: KaminoMarket,
  user: PublicKey,
  mint: PublicKey,
  farmPubkeyToFarmStates: PubkeyHashMap<PublicKey, FarmState>,
  pointsMint: PublicKey,
  pointsFactor: number,
  position: Position,
  isCollateral: boolean,
  finalBoost: Decimal,
  scopePrices: OraclePrices | null,
) => {
  const reserve = kaminoMarket.getReserveByMint(mint)!;
  const farmStateKey = isCollateral
    ? reserve!.state.farmCollateral
    : reserve!.state.farmDebt;
  const farmState = farmPubkeyToFarmStates.get(farmStateKey);
  if (!farmState) {
    return new Decimal(0);
  }
  const lastIssuanceTs = farmState.rewardInfos[0].lastIssuanceTs.toNumber();
  const lastIssuanceTsPlusOneDay = new Decimal(lastIssuanceTs + 86400);
  const rewardIndex = farmState.rewardInfos.findIndex((r: RewardInfo) =>
    r.token.mint.equals(pointsMint),
  );

  const totalRewardsToIssuedForEntireFarm = calculateNewRewardToBeIssued(
    farmState,
    lastIssuanceTsPlusOneDay,
    rewardIndex,
    scopePriceForFarm(farmState, scopePrices),
  ).div(pointsFactor);

  const mintDecimals = reserve.state.liquidity.mintDecimals.toNumber();
  const totalStakedInFarm = lamportsToNumberDecimal(
    new Decimal(farmState.totalStakedAmount.toString()),
    mintDecimals,
  );
  const userTokenAmountStakedInFarm = lamportsToNumberDecimal(
    position.amount,
    mintDecimals,
  );
  const userBoostedStakedAmount = userTokenAmountStakedInFarm.mul(finalBoost);

  const pointsPerDayThisTokenInThisLoan = totalRewardsToIssuedForEntireFarm.mul(
    userBoostedStakedAmount.div(totalStakedInFarm),
  );

  // console.log("Reserve", parseTokenSymbol(reserve.state.config.tokenInfo.name));
  // console.log("TotalStakedInFarm", totalStakedInFarm);
  // console.log("UserStakedInFarm", userTokenAmountStakedInFarm);
  // console.log("UserBoostedStakedInFarm", userBoostedStakedAmount);
  // console.log("User", user.toString());
  // console.log("-----");

  return pointsPerDayThisTokenInThisLoan;
};

export const getAllBoosts = (kaminoMarket: KaminoMarket) => {
  const lendingMarketState = kaminoMarket.state;
  const perAssetCollBoosts: PubkeyHashMap<PublicKey, Decimal> =
    new PubkeyHashMap();
  const perAssetDebtBoosts: PubkeyHashMap<PublicKey, Decimal> =
    new PubkeyHashMap();
  const perAssetProductBoosts: PubkeyHashMap<
    PublicKey,
    Map<number, Decimal>
  > = new PubkeyHashMap();
  const perProductBoosts: Map<number, Decimal> = new Map()
    .set(
      ObligationTypeTag.Vanilla.valueOf(),
      new Decimal(
        lendingMarketState.multiplierPointsTagBoost[
          ObligationTypeTag.Vanilla.valueOf()
        ],
      ),
    )
    .set(
      ObligationTypeTag.Multiply.valueOf(),
      new Decimal(
        lendingMarketState.multiplierPointsTagBoost[
          ObligationTypeTag.Multiply.valueOf()
        ],
      ),
    )
    .set(
      ObligationTypeTag.Leverage.valueOf(),
      new Decimal(
        lendingMarketState.multiplierPointsTagBoost[
          ObligationTypeTag.Leverage.valueOf()
        ],
      ),
    )
    .set(
      ObligationTypeTag.Lending.valueOf(),
      new Decimal(
        lendingMarketState.multiplierPointsTagBoost[
          ObligationTypeTag.Lending.valueOf()
        ],
      ),
    );

  // Collect boosts
  for (const [_key, reserve] of kaminoMarket.reserves) {
    const sideBoosts = reserve.state.config.multiplierSideBoost;
    const tagBoosts = reserve.state.config.multiplierTagBoost;
    const collBoost = sideBoosts[ReserveFarmKind.Collateral.discriminator];
    const debtBoost = sideBoosts[ReserveFarmKind.Debt.discriminator];

    const borrowLendBoost = tagBoosts[ObligationTypeTag.Vanilla.valueOf()];
    const multiplyBoost = tagBoosts[ObligationTypeTag.Multiply.valueOf()];
    const lendingBoost = tagBoosts[ObligationTypeTag.Lending.valueOf()];
    const leverageBoost = tagBoosts[ObligationTypeTag.Leverage.valueOf()];

    perAssetCollBoosts.set(reserve.getLiquidityMint(), new Decimal(collBoost));
    perAssetDebtBoosts.set(reserve.getLiquidityMint(), new Decimal(debtBoost));

    perAssetProductBoosts.set(
      reserve.getLiquidityMint(),
      new Map()
        .set(ObligationTypeTag.Vanilla.valueOf(), borrowLendBoost)
        .set(ObligationTypeTag.Multiply.valueOf(), multiplyBoost)
        .set(ObligationTypeTag.Leverage.valueOf(), lendingBoost)
        .set(ObligationTypeTag.Lending.valueOf(), leverageBoost),
    );
  }

  return {
    perAssetCollBoosts,
    perAssetDebtBoosts,
    perAssetProductBoosts,
    perProductBoosts,
  };
};

const newUserPointsBreakdown = (): UserPointsBreakdown => ({
  totalPoints: new Decimal(0),
  currentBoost: new Decimal(0),
  currentPointsPerDay: new Decimal(0),
  perPositionBoost: new PubkeyHashMap(),
  perPositionPointsPerDay: new PubkeyHashMap(),
});
