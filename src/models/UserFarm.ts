import { Address } from "@solana/kit";
import Decimal from "decimal.js";
import { RewardInfo } from "../@codegen/farms/types";
import { UserState } from "../@codegen/farms/accounts";

export type UserFarm = {
  userStateAddress: Address;
  farm: Address;
  stakedToken: Address;
  activeStakeByDelegatee: Map<Address, Decimal>; // key is the delegate address
  pendingDepositStakeByDelegatee: Map<Address, Decimal>; // key is the delegate address
  pendingWithdrawalUnstakeByDelegatee: Map<Address, Decimal>; // key is the delegate address
  pendingRewards: PendingReward[];
  delegateAuthority: Address;
  strategyId: Address;
  userState: UserState;
};

export type PendingReward = {
  rewardTokenMint: Address;
  rewardTokenProgramId: Address;
  rewardType: RewardInfo["rewardType"];
  cumulatedPendingRewards: Decimal;
  pendingRewardsByDelegatee: Map<Address, Decimal>;
};

export type IncentiveRewardStats = {
  rewardMint: Address;
  rewardDecimals: Decimal;
  value: Decimal;
  yearlyRewards: Decimal;
  monthlyRewards: Decimal;
  weeklyRewards: Decimal;
  dailyRewards: Decimal;
  incentivesApy: number;
  hasRewardAvailable: boolean;
};

export type FarmIncentives = {
  incentivesStats: IncentiveRewardStats[];
  totalIncentivesApy: number;
};
