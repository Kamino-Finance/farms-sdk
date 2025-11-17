import { backOff } from "exponential-backoff";
import axios from "axios";
import {
  calculateVestingAtTime,
  VestingCalculation,
  VestingConfig,
} from "./vestingUtils";
import { Farms } from "../Farms";
import { FarmState, UserState } from "../@codegen/farms/accounts";
import { address, Address } from "@solana/kit";
import Decimal from "decimal.js";
import { getTokenAccountBalanceLamports, getUserStatePDA } from "./utils";
import { DEFAULT_PUBLIC_KEY } from "./pubkey";

export async function getSeasonFarmsFromCDN() {
  return (
    await backOff(
      () =>
        axios.get<SeasonFarmsCdnResponse>(
          "https://cdn.kamino.finance/resources.json",
        ),
      {
        maxDelay: 1000,
        numOfAttempts: 5,
        startingDelay: 10,
      },
    )
  ).data["mainnet-beta"].seasonFarms;
}

export interface SeasonFarmsCdnResponse {
  "mainnet-beta": {
    seasonFarms: SeasonFarm[];
  };
}

export interface SeasonFarm {
  farmAddress: string;
  season: string;
  rewardMint: string;
  vestingConfig: VestingConfig;
}

export interface SeasonFarmData {
  seasonFarm: SeasonFarm;
  farmState: FarmState;
  userStates: Map<Address, UserState>;
  stats: SeasonFarmStats;
}

export interface UserAllocation {
  address: Address;
  allocationLamports: number;
}

export async function getExistingUserStatesMapForFarm(
  farmsClient: Farms,
  farm: Address,
): Promise<Map<Address, UserState>> {
  const userStates = await farmsClient.getAllUserStatesForFarm(farm);
  const userStatesMap: Map<Address, UserState> = new Map();
  for (const { key, userState } of userStates) {
    userStatesMap.set(key, userState);
  }

  return userStatesMap;
}

export function getUserStateDefaultLastClaimTs(
  farmState: FarmState,
  userState: UserState,
): number {
  const firstEmptyRewardIndex = farmState.rewardInfos.findIndex(
    (rewardInfo) => {
      return rewardInfo.token.mint === DEFAULT_PUBLIC_KEY;
    },
  );
  if (firstEmptyRewardIndex === -1) {
    throw new Error("No empty reward slot found in farm state");
  }
  return userState.lastClaimTs[firstEmptyRewardIndex].toNumber();
}

export function getRewardIndexInFarm(
  farmState: FarmState,
  rewardMint: string,
): number {
  return farmState.rewardInfos.findIndex((rewardInfo) => {
    return rewardInfo.token.mint === rewardMint;
  });
}

export async function getSeasonFarmsData(
  farmsClient: Farms,
  userAllocations: UserAllocation[],
): Promise<SeasonFarmData[]> {
  const seasonFarms = await getSeasonFarmsFromCDN();

  const totalUsersAllocations = userAllocations.reduce(
    (acc, ua) => acc + ua.allocationLamports,
    0,
  );

  const statsTimestampSeconds = Date.now() / 1000;

  const seasonFarmsData: SeasonFarmData[] = [];

  for (const seasonFarm of seasonFarms) {
    const seasonFarmAddress = address(seasonFarm.farmAddress);
    const farmState = await FarmState.fetch(
      farmsClient.getConnection(),
      seasonFarmAddress,
    );
    if (!farmState) {
      throw new Error(`Farm not found: ${seasonFarm.farmAddress}`);
    }
    const rewardIndex = getRewardIndexInFarm(farmState, seasonFarm.rewardMint);
    if (rewardIndex === -1) {
      console.warn(
        `Skipping farm ${seasonFarm.farmAddress}: Reward mint ${seasonFarm.rewardMint} not found in farm reward infos`,
      );
      continue;
    }

    const rewardDecimals =
      farmState.rewardInfos[rewardIndex].token.decimals.toNumber();
    const rewardDecimalFactor = new Decimal(10).pow(rewardDecimals);

    const totalFarmVestingCalculation = calculateVestingAtTime(
      new Decimal(totalUsersAllocations),
      statsTimestampSeconds,
      seasonFarm.vestingConfig,
    );

    const farmRewardVaultBalanceLamports = await getTokenAccountBalanceLamports(
      farmsClient.getConnection(),
      farmState.rewardInfos[rewardIndex].rewardsVault,
    );
    const farmRewardVaultBalance = new Decimal(
      farmRewardVaultBalanceLamports,
    ).div(rewardDecimalFactor);

    const farmRewardsIssuedCumulative = new Decimal(
      farmState.rewardInfos[rewardIndex].rewardsIssuedCumulative.toString(),
    ).div(rewardDecimalFactor);

    const farmRewardsIssuedUnclaimed = new Decimal(
      farmState.rewardInfos[rewardIndex].rewardsIssuedUnclaimed.toString(),
    ).div(rewardDecimalFactor);

    // this will not decrease from claims - this only increases when rewards are issued via the refresh rewards process, which will do nothing for season farms, hence rewardsAvailable will show us how much was topped up in total to the farm
    const rewardsAvailable = new Decimal(
      farmState.rewardInfos[rewardIndex].rewardsAvailable.toString(),
    ).div(rewardDecimalFactor);
    const rewardsClaimedFromVault = rewardsAvailable.minus(
      farmRewardVaultBalance,
    );
    const rewardsClaimedFromFarmAccounting = farmRewardsIssuedCumulative.minus(
      farmRewardsIssuedUnclaimed,
    );
    const doRewardsClaimedMatch = rewardsClaimedFromVault.equals(
      rewardsClaimedFromFarmAccounting,
    );

    const totalClaimableAllocation =
      totalFarmVestingCalculation.claimableAmount.div(rewardDecimalFactor);
    const isTotalIssuedCummulativeLessOrThanClaimable =
      farmRewardsIssuedCumulative.lessThanOrEqualTo(totalClaimableAllocation);
    const isTotalIssuedUnclaimedLessOrThanClaimable =
      farmRewardsIssuedUnclaimed.lessThanOrEqualTo(totalClaimableAllocation);
    const pctRewardsAvailableInVaultToUnclaimed =
      farmRewardsIssuedUnclaimed.greaterThan(0)
        ? farmRewardVaultBalance.div(farmRewardsIssuedUnclaimed).mul(100)
        : new Decimal(0);

    const userStates = await getExistingUserStatesMapForFarm(
      farmsClient,
      seasonFarmAddress,
    );

    const vestingEndTsSeconds =
      seasonFarm.vestingConfig.vestingStartTimestampSeconds +
      seasonFarm.vestingConfig.vestingDurationSeconds;

    const hasVestingStarted =
      statsTimestampSeconds >=
      seasonFarm.vestingConfig.vestingStartTimestampSeconds;
    const hasVestingEnded = statsTimestampSeconds >= vestingEndTsSeconds;

    const userStats: UserStats[] = [];

    let numberOfUserStatesUninitialized = 0;
    let numberOfUsersClaimed = 0;
    let numberOfFullyVestedUsers = 0;
    let numberOfUsersForfited = 0;
    let numberOfUsersWithUnexpectedUnclaimedAmounts = 0;
    let numberOfUsersWithUnexpectedCumulativeAmounts = 0;
    let totalForfeitures = new Decimal(0);
    for (const ua of userAllocations) {
      let isUserFullyVested = false;
      let isUserInitialized = true;
      let hasUserClaimed = false;
      let hasUserForfited = false;
      let isUserRewardsIssuedUnclaimedExpected = false;
      let isUserRewardsIssuedCumulativeExpected = false;
      const userStatePda = await getUserStatePDA(
        farmsClient.getProgramID(),
        seasonFarmAddress,
        ua.address,
      );
      const userState = userStates.get(userStatePda);
      if (!userState) {
        numberOfUserStatesUninitialized += 1;
        isUserInitialized = false;
        continue;
      }
      const userAllocationDecimal = new Decimal(ua.allocationLamports).div(
        rewardDecimalFactor,
      );

      const userAllocationVestingCalculation = calculateVestingAtTime(
        new Decimal(ua.allocationLamports),
        statsTimestampSeconds,
        seasonFarm.vestingConfig,
      );
      const userTotalClaimableAtStatsTs =
        userAllocationVestingCalculation.claimableAmount.div(
          rewardDecimalFactor,
        );
      const userDefaultLastClaimTs = getUserStateDefaultLastClaimTs(
        farmState,
        userState,
      );
      if (
        userState.lastClaimTs[rewardIndex].toNumber() > userDefaultLastClaimTs
      ) {
        const userTotalClaimedDecimal = new Decimal(
          userState.rewardsIssuedCumulative[rewardIndex].toString(),
        ).div(rewardDecimalFactor);
        const userForfeitureDecimal = userAllocationDecimal.sub(
          userTotalClaimedDecimal,
        );
        totalForfeitures = totalForfeitures.plus(userForfeitureDecimal);
        if (userForfeitureDecimal.greaterThan(0)) {
          hasUserForfited = true;
          numberOfUsersForfited += 1;
        }
        numberOfUsersClaimed += 1;
        hasUserClaimed = true;
        const userRewardsIssuedUnclaimed = new Decimal(
          userState.rewardsIssuedUnclaimed[rewardIndex].toString(),
        ).div(rewardDecimalFactor);
        isUserRewardsIssuedUnclaimedExpected =
          userRewardsIssuedUnclaimed.equals(0);
      } else {
        const userRewardsIssuedUnclaimed = new Decimal(
          userState.rewardsIssuedUnclaimed[rewardIndex].toString(),
        ).div(rewardDecimalFactor);
        isUserRewardsIssuedUnclaimedExpected =
          userRewardsIssuedUnclaimed.lessThanOrEqualTo(
            userTotalClaimableAtStatsTs,
          );
      }
      isUserRewardsIssuedCumulativeExpected = new Decimal(
        userState.rewardsIssuedCumulative[rewardIndex].toString(),
      )
        .div(rewardDecimalFactor)
        .lessThanOrEqualTo(userTotalClaimableAtStatsTs);

      const hasClaimedAfterVestingEnd =
        userState.lastClaimTs[rewardIndex].toNumber() > vestingEndTsSeconds;
      const userRewardsIssuedUnclaimed = new Decimal(
        userState.rewardsIssuedUnclaimed[rewardIndex].toString(),
      ).div(rewardDecimalFactor);
      const isFullyVestedAndAwarded =
        userTotalClaimableAtStatsTs.equals(userRewardsIssuedUnclaimed) &&
        userTotalClaimableAtStatsTs.equals(userAllocationDecimal) &&
        statsTimestampSeconds > vestingEndTsSeconds &&
        userState.lastClaimTs[rewardIndex].toNumber() ===
          userDefaultLastClaimTs;

      if (isFullyVestedAndAwarded || hasClaimedAfterVestingEnd) {
        numberOfFullyVestedUsers += 1;
        isUserFullyVested = true;
      }

      numberOfUsersWithUnexpectedUnclaimedAmounts +=
        isUserRewardsIssuedUnclaimedExpected ? 0 : 1;
      numberOfUsersWithUnexpectedCumulativeAmounts +=
        isUserRewardsIssuedCumulativeExpected ? 0 : 1;

      userStats.push({
        userAddress: ua.address,
        userAllocation: userAllocationDecimal,
        isUserInitialized,
        hasUserClaimed,
        hasUserForfited,
        isUserFullyVested,
        userTotalClaimableAtStatsTs,
        isUserRewardsIssuedUnclaimedExpected,
        isUserRewardsIssuedCumulativeExpected,
      });
    }

    seasonFarmsData.push({
      seasonFarm: seasonFarm,
      farmState,
      userStates,
      stats: {
        statsTimestampSeconds,
        hasVestingStarted,
        hasVestingEnded,
        farmRewardVaultBalance,
        rewardsClaimedFromVault,
        rewardsClaimedFromFarmAccounting,
        totalClaimableAllocation,
        farmRewardsIssuedCumulative,
        farmRewardsIssuedUnclaimed,
        pctRewardsAvailableInVaultToUnclaimed,
        doRewardsClaimedMatch,
        isTotalIssuedCummulativeLessOrThanClaimable,
        isTotalIssuedUnclaimedLessOrThanClaimable,
        totalUsers: userAllocations.length,
        numberOfFullyVestedUsers,
        numberOfUserStatesUninitialized,
        numberOfUsersWithUnexpectedUnclaimedAmounts,
        numberOfUsersForfited,
        numberOfUsersClaimed,
        numberOfUsersWithUnexpectedCumulativeAmounts,
        totalForfeitures,
        userStats,
        totalFarmVestingCalculation,
      },
    });
  }

  return seasonFarmsData;
}

export interface SeasonFarmStats {
  statsTimestampSeconds: number;
  hasVestingStarted: boolean;
  hasVestingEnded: boolean;

  farmRewardVaultBalance: Decimal;
  rewardsClaimedFromVault: Decimal;
  rewardsClaimedFromFarmAccounting: Decimal;
  totalClaimableAllocation: Decimal;
  farmRewardsIssuedCumulative: Decimal;
  farmRewardsIssuedUnclaimed: Decimal;

  pctRewardsAvailableInVaultToUnclaimed: Decimal;

  doRewardsClaimedMatch: boolean;
  isTotalIssuedCummulativeLessOrThanClaimable: boolean;
  isTotalIssuedUnclaimedLessOrThanClaimable: boolean;

  totalUsers: number;
  numberOfUserStatesUninitialized: number;
  numberOfFullyVestedUsers: number;
  numberOfUsersWithUnexpectedUnclaimedAmounts: number;
  numberOfUsersForfited: number;
  numberOfUsersClaimed: number;
  numberOfUsersWithUnexpectedCumulativeAmounts: number;

  totalForfeitures: Decimal;

  userStats: UserStats[];

  totalFarmVestingCalculation: VestingCalculation;
}

export interface UserStats {
  userAddress: Address;
  userAllocation: Decimal;
  isUserInitialized: boolean;
  hasUserClaimed: boolean;
  hasUserForfited: boolean;
  isUserFullyVested: boolean;

  userTotalClaimableAtStatsTs: Decimal;

  isUserRewardsIssuedUnclaimedExpected: boolean;
  isUserRewardsIssuedCumulativeExpected: boolean;
}
